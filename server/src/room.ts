import {
  type Action,
  type GameMode,
  type GameState,
  type PlayerView,
  type RoomInfo,
  type Rng,
  type TableSummary,
  freezeClock,
  gameOfMode,
  modeOfGame,
  pickBotNames,
} from '@okey/shared';
import {
  type AnyGameDefinition,
  type GameDefinition,
  type GameId,
  type TurnClock,
  NOTICE_MS,
  newSeed,
  nextTurnClock,
  seededRng,
} from '@kahve/core';
import { getDefinition } from '@kahve/catalog';

export interface Seat {
  name: string;
  isBot: boolean;
  /** Socket id of the human in this seat, null when disconnected. */
  socketId: string | null;
}

export interface RoomOptions {
  /** Legacy (v1) okey mode; ignored when `game` is given. */
  mode?: GameMode;
  /** Which game this table plays. Wins over `mode`; missing = gameOfMode(mode). */
  game?: GameId;
  /** House rules from the client, normalized by the game's `normalizeOptions`. */
  options?: unknown;
  /** Listed in the salon. */
  isPublic?: boolean;
  /** Sitting down needs this 6-digit password (the table is still listed). */
  password?: string | null;
  botDelayMs?: number;
  /**
   * A human who doesn't move in time gets the game's quick move instead (okey:
   * draw from the deck, throw a tile outside their melds). The first turn of a
   * round gets `firstTurnFactor` x; the game's `refillsClock` actions refill it
   * once per turn. Missing = the game's `clock.baseMs`; 0 disables.
   */
  turnTimeoutMs?: number;
  /**
   * Legacy single random source: deals, bot moves and bot names all draw from it,
   * exactly as before A4. Tables created this way can't be replayed from a seed.
   */
  rng?: Rng;
  /**
   * Seeds the table (used when `rng` is not given; missing = a random seed). Deals come from
   * seededRng(seed), bot moves from their own seeded rng, bot names from Math.random, so
   * `replay(def, options, seed, log)` rebuilds the state from the action log.
   */
  seed?: number;
  /** Tests only: run this definition instead of the catalog's (stub games). */
  definition?: AnyGameDefinition;
  /**
   * How long a new GameNotice (a live penalty) freezes the turn clock and the bots, so everyone can
   * read the panel. Missing = NOTICE_MS when the clock is on, 0 (no freeze) on a table without a clock.
   */
  noticeMs?: number;
}

/** What the table did, in order. Kept on the server only (never sent to clients). */
export type RoomLogEntry<A = unknown> =
  | { t: 'deal'; round: number; names: string[] }
  | { t: 'act'; seat: number; action: A }
  | { t: 'rename'; seat: number; name: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRoom = Room<any, any, any>;
export type RoomListener = (room: AnyRoom) => void;

const BOT_SALT = 0x9e3779b9;

/** A bot taking over (or a human taking a bot's seat) renames the seat in games that keep names in their state. */
function renameInState<S>(def: GameDefinition<S, unknown, unknown, unknown>, state: S, seat: number, name: string): S {
  return def.renameSeat ? def.renameSeat(state, seat, name) : state;
}

/**
 * The host's additions to a view: `noticeMsLeft` during a notice panel and, for games whose view carries the raw
 * `clock` but no `turnMsLeft` (card games), `turnMsLeft` read on the host's clock, so a device whose clock is off
 * still counts down right. Okey views already have `turnMsLeft` and stay as they were.
 * Copied in app/src/net/localHost.ts (proved equal in server/test/local-host-equivalence.test.ts).
 */
export function withHostTimes<V>(view: V, clock: TurnClock | null, now: number, frozenUntil: number): V {
  if (typeof view !== 'object' || view === null) return view;
  let out: V = view;
  if ('clock' in view && !('turnMsLeft' in view)) {
    out = { ...out, turnMsLeft: clock ? Math.max(0, clock.deadline - Math.max(now, frozenUntil)) : null };
  }
  const left = frozenUntil - now;
  return left > 0 ? { ...out, noticeMsLeft: left } : out;
}

/** Rebuilds a seeded table's state from its log (bug reports, bot sims). */
export function replay<S, A>(
  def: GameDefinition<S, A, unknown, unknown>,
  options: unknown,
  seed: number,
  log: readonly RoomLogEntry<A>[],
): S | null {
  const rng = seededRng(seed);
  let state: S | null = null;
  for (const e of log) {
    if (e.t === 'deal') state = def.create(options, e.names, rng, e.round);
    else if (!state) throw new Error('replay: no deal before ' + e.t);
    else if (e.t === 'rename') state = renameInState(def, state, e.seat, e.name);
    else {
      const res = def.apply(state, e.seat, e.action);
      if (!res.ok) throw new Error(`replay: ${res.error}`);
      state = res.state;
    }
  }
  return state;
}

/**
 * One table: seats, the authoritative game state and the turn clock, for any game in the
 * catalog. Type parameters default to okey so `room.game` stays an okey GameState.
 */
export class Room<S = GameState, A = Action, V = PlayerView> {
  readonly seats: (Seat | null)[];
  game: S | null = null;
  round = 0;
  totals: number[];
  hostSeat = 0;
  readonly def: GameDefinition<S, A, V, unknown>;
  readonly gameId: GameId;
  readonly options: unknown;
  readonly mode: GameMode;
  readonly isPublic: boolean;
  readonly password: string | null;
  /** Null for legacy `rng` tables (not replayable). */
  readonly seed: number | null;
  private readonly log: RoomLogEntry<A>[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private clock: TurnClock | null = null;
  private readonly botDelayMs: number;
  private readonly turnTimeoutMs: number;
  private readonly noticeMs: number;
  /** Id of the last GameNotice seen this round (0 = none). */
  private lastNoticeId = 0;
  /** Epoch ms until which the clock and bots are frozen for a notice panel (0 = not frozen). */
  private frozenUntil = 0;
  /** `round` when the current match started (101 matchEnd counts hands from here). */
  private matchStart = 0;
  private readonly dealRng: Rng;
  private readonly botRng: Rng;
  private readonly nameRng: Rng | undefined;

  constructor(
    readonly id: string,
    private readonly onChange: RoomListener,
    opts: RoomOptions = {},
  ) {
    this.gameId = opts.definition?.id ?? opts.game ?? gameOfMode(opts.mode);
    const def = opts.definition ?? getDefinition(this.gameId);
    if (!def) throw new Error(`no playable definition for ${this.gameId}`);
    this.def = def as GameDefinition<S, A, V, unknown>;
    this.options = this.def.normalizeOptions(opts.options);
    const n = this.def.seats(this.options);
    this.seats = Array(n).fill(null);
    this.totals = Array(n).fill(0);
    this.mode = modeOfGame(this.gameId) ?? '101';
    this.botDelayMs = opts.botDelayMs ?? 1000;
    this.turnTimeoutMs = opts.turnTimeoutMs ?? this.def.clock.baseMs;
    this.noticeMs = opts.noticeMs ?? (this.turnTimeoutMs > 0 ? NOTICE_MS : 0);
    if (opts.rng) {
      this.seed = null;
      this.dealRng = this.botRng = this.nameRng = opts.rng;
    } else {
      this.seed = (opts.seed ?? newSeed()) >>> 0;
      this.dealRng = seededRng(this.seed);
      this.botRng = seededRng(this.seed ^ BOT_SALT);
      this.nameRng = undefined;
    }
    this.isPublic = opts.isPublic ?? false;
    this.password = opts.password ?? null;
  }

  get started() {
    return this.game !== null;
  }

  /** The table's history so far (server-side only). */
  actionLog(): readonly RoomLogEntry<A>[] {
    return this.log;
  }

  join(name: string, socketId: string): number | string {
    // Reclaim a disconnected seat with the same name (reconnect).
    const back = this.seats.findIndex((s) => s && !s.isBot && s.socketId === null && s.name === name);
    if (back >= 0) {
      this.seats[back]!.socketId = socketId;
      this.changed();
      this.schedule();
      return back;
    }
    // Take an empty seat, or replace a bot mid-game.
    let seat = this.seats.findIndex((s) => s === null);
    if (seat < 0) seat = this.seats.findIndex((s) => s?.isBot);
    if (seat < 0) return 'Oda dolu';
    if (this.seats.every((s) => s === null || s.isBot)) this.hostSeat = seat;
    this.seats[seat] = { name, isBot: false, socketId };
    this.rename(seat, name);
    this.changed();
    this.schedule();
    return seat;
  }

  /** Socket dropped: keep the seat (bot autoplays it) so the player can come back. */
  disconnect(socketId: string) {
    const seat = this.seatOf(socketId);
    if (seat < 0) return;
    if (!this.game) this.free(seat);
    else this.seats[seat]!.socketId = null;
    this.changed();
    this.schedule();
  }

  /** Left on purpose: before the start the seat frees up; mid-game a bot takes it for good. */
  leave(socketId: string) {
    const seat = this.seatOf(socketId);
    if (seat < 0) return;
    if (!this.game) this.free(seat);
    else {
      const taken = this.seats.flatMap((s, i) => (s && i !== seat ? [s.name] : []));
      const [name] = pickBotNames(1, taken, this.nameRng);
      this.seats[seat] = { name, isBot: true, socketId: null };
      this.rename(seat, name);
    }
    this.changed();
    this.schedule();
  }

  private rename(seat: number, name: string) {
    if (!this.game) return;
    this.game = renameInState(this.def as GameDefinition<S, unknown, unknown, unknown>, this.game, seat, name);
    this.log.push({ t: 'rename', seat, name });
  }

  private free(seat: number) {
    this.seats[seat] = null;
    // The host left before the start: the next person at the table can start it.
    if (seat === this.hostSeat) {
      const next = this.seats.findIndex((s) => s && !s.isBot);
      if (next >= 0) this.hostSeat = next;
    }
  }

  /** Every seat taken by a person at a table that hasn't started: deal. */
  startIfFull(): boolean {
    if (this.game || !this.seats.every((s) => s && !s.isBot)) return false;
    this.start();
    return true;
  }

  /** The table as the salon list shows it. */
  summary(): TableSummary {
    const seats = this.seats.map((s) => (s && !s.isBot ? s.name : null));
    return {
      id: this.id,
      mode: this.mode,
      game: this.gameId,
      seats,
      free: seats.filter((s) => s === null).length,
      started: this.started,
      locked: this.password !== null,
    };
  }

  hasHumans() {
    return this.seats.some((s) => s && !s.isBot && s.socketId !== null);
  }

  seatOf(socketId: string) {
    return this.seats.findIndex((s) => s?.socketId === socketId);
  }

  start(): string | null {
    if (this.game) return 'Oyun zaten başladı';
    const empty = this.seats.flatMap((s, i) => (s ? [] : [i]));
    const taken = this.seats.flatMap((s) => (s ? [s.name] : []));
    const names = pickBotNames(empty.length, taken, this.nameRng);
    empty.forEach((seat, i) => (this.seats[seat] = { name: names[i], isBot: true, socketId: null }));
    this.newRound();
    return null;
  }

  nextRound(): string | null {
    if (!this.game || !this.def.roundOver(this.game)) return 'Tur bitmedi';
    // Match over (düz okey: someone is out of points; 101: matchEnd): a new match starts from scratch.
    if (this.matchOver()) {
      this.totals = this.totals.map(() => 0);
      this.matchStart = this.round;
    }
    this.newRound();
    return null;
  }

  /** The finished round ended the match (101 hands are counted from the start of this match). */
  matchOver(): boolean {
    return (
      !!this.game &&
      this.def.roundOver(this.game) &&
      this.def.matchOver(this.totals, this.round - this.matchStart, this.options)
    );
  }

  private newRound() {
    const names = this.seats.map((s) => s!.name);
    this.game = this.def.create(this.options, names, this.dealRng, this.round);
    this.log.push({ t: 'deal', round: this.round, names });
    this.round++;
    this.lastNoticeId = 0;
    this.frozenUntil = 0;
    this.tick(null);
    this.changed();
    this.schedule();
  }

  act(seat: number, action: A): string | null {
    if (!this.game) return 'Oyun başlamadı';
    const res = this.def.apply(this.game, seat, action);
    if (!res.ok) return res.error;
    this.game = res.state;
    this.log.push({ t: 'act', seat, action });
    this.tick(action);
    this.freezeForNotice();
    if (this.def.roundOver(this.game)) {
      this.def.scoreRound(this.game).forEach((s, i) => (this.totals[i] += s));
    }
    this.changed();
    this.schedule();
    return null;
  }

  info(): RoomInfo {
    return {
      id: this.id,
      mode: this.mode,
      game: this.gameId,
      isPublic: this.isPublic,
      ...(this.password !== null && { password: this.password }),
      seats: this.seats.map((s, seat) =>
        s ? { seat, name: s.name, isBot: s.isBot, connected: s.isBot || s.socketId !== null } : null,
      ),
      hostSeat: this.hostSeat,
      started: this.started,
      round: this.round,
      totals: this.totals,
      matchOver: this.matchOver(),
    };
  }

  viewFor(seat: number): V | null {
    if (!this.game) return null;
    const now = Date.now();
    // During a notice panel the clock reads as it did when the notice came in.
    return withHostTimes(this.def.viewFor(this.game, seat, { clock: this.clock, now: Math.max(now, this.frozenUntil) }), this.clock, now, this.frozenUntil);
  }

  /** Ms left on the current notice panel (0 = not frozen). */
  noticeMsLeft(): number {
    return Math.max(0, this.frozenUntil - Date.now());
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private tick(action: A | null) {
    // A clock started or refilled during a notice panel starts counting when the panel goes away.
    const now = Math.max(Date.now(), this.frozenUntil);
    this.clock =
      this.game && this.turnTimeoutMs > 0
        ? nextTurnClock(this.clock, this.def.turn(this.game), action !== null && this.def.refillsClock(action), now, {
            baseMs: this.turnTimeoutMs,
            firstTurnFactor: this.def.clock.firstTurnFactor,
          })
        : null;
  }

  /**
   * New GameNotices (live penalties): freeze the turn clock and the bots for `noticeMs` per new notice
   * (two penalties in one throw: twice as long). The player to move keeps the time they had.
   */
  private freezeForNotice() {
    const notice = this.game && this.def.noticeOf ? this.def.noticeOf(this.game) : null;
    if (!notice || notice.id <= this.lastNoticeId) return;
    const fresh = notice.id - this.lastNoticeId;
    this.lastNoticeId = notice.id;
    if (this.noticeMs <= 0) return;
    const now = Date.now();
    const until = now + this.noticeMs * fresh;
    // A notice during a running panel extends it: the clock moves by the added time only.
    this.clock = freezeClock(this.clock, until - Math.max(now, this.frozenUntil));
    this.frozenUntil = until;
  }

  private changed() {
    this.onChange(this);
  }

  /** Arms the clock for whoever is to move: bots/absent players quickly, humans on timeout. */
  private schedule() {
    this.dispose();
    const turn = this.game ? this.def.turn(this.game) : null;
    // Nobody watching: pause until a human comes back.
    if (!turn || !this.hasHumans()) return;
    const seat = this.seats[turn.seat]!;
    const auto = seat.isBot || seat.socketId === null;
    if (!auto && !this.clock) return;
    // A timed-out human's first quick move leaves the clock run out, so the rest follows at once.
    // Bots and absent players also wait out a notice panel.
    const now = Date.now();
    const delay = auto ? Math.max(this.botDelayMs, this.frozenUntil - now) : Math.max(0, this.clock!.deadline - now);
    this.timer = setTimeout(() => this.autoPlay(), delay);
  }

  /** Plays one bot action for the current seat (bot, absent human or timed-out human). */
  autoPlay() {
    const g = this.game;
    const turn = g ? this.def.turn(g) : null;
    if (!g || !turn) return;
    const seat = turn.seat;
    const seatInfo = this.seats[seat]!;
    // A timed-out human only gets the minimum (okey: draw, then throw).
    const timedOut = !seatInfo.isBot && seatInfo.socketId !== null;
    const action = timedOut ? this.def.quickMove(g, seat) : this.def.botMove(g, seat, 'medium', this.botRng);
    if (this.act(seat, action) !== null) {
      // Should not happen; fall back to the game's minimal legal move.
      const err = this.act(seat, this.def.quickMove(g, seat));
      if (err) throw new Error(`bot stuck at seat ${seat}: ${err}`);
    }
  }
}
