// B5 (Claude Opus): the offline table for any GameDefinition, run on the device.
// A plain-TypeScript copy of the server Room's host logic (turn clock, notice freeze, seeded deals and bots,
// match totals), without sockets, timers or React. Time comes in as `now`; the caller arms one timer for `due`.
// server/test/local-host-equivalence.test.ts proves it moves exactly like Room for the same seed and moves.
import { freezeClock } from '@okey/shared';
import { type GameDefinition, type TurnClock, NOTICE_MS, nextTurnClock, seededRng } from '@kahve/core';

type Rng = () => number;

/** Same salt as server/src/room.ts, so a seed gives the same bot moves offline and online. */
const BOT_SALT = 0x9e3779b9;

export type HostLogEntry<A> = { t: 'deal'; round: number; names: string[] } | { t: 'act'; seat: number; action: A };

export interface LocalHostOptions {
  /** House rules, normalized by the game's `normalizeOptions`. */
  options?: unknown;
  /** Seeds deals (seededRng(seed)) and bots (seededRng(seed ^ BOT_SALT)), as Room does. */
  seed: number;
  /** Seats played by a person on this device (default [0]); every other seat is a bot. */
  humans?: readonly number[];
  /** Room's default is 1000. */
  botDelayMs?: number;
  /** Missing = the game's clock.baseMs; 0 disables the clock. */
  turnTimeoutMs?: number;
  /** Missing = NOTICE_MS when the clock is on, else 0. */
  noticeMs?: number;
}

/** The next automatic move: a bot's, or a person's quick move when their clock runs out. */
export interface HostDue {
  seat: number;
  kind: 'bot' | 'quick';
  /** Epoch ms when it should happen. */
  at: number;
}

export type HostResult = { ok: true } | { ok: false; error: string };

export class LocalHost<S, A, V> {
  readonly options: unknown;
  readonly seed: number;
  readonly seats: number;
  state: S | null = null;
  names: string[] = [];
  /** Rounds dealt so far (Room.round). */
  round = 0;
  totals: number[];
  clock: TurnClock | null = null;
  /** Epoch ms until which the clock and bots are frozen for a notice panel (0 = not frozen). */
  frozenUntil = 0;
  due: HostDue | null = null;
  readonly log: HostLogEntry<A>[] = [];
  private readonly humans: ReadonlySet<number>;
  private readonly botDelayMs: number;
  private readonly turnTimeoutMs: number;
  private readonly noticeMs: number;
  private readonly dealRng: Rng;
  private readonly botRng: Rng;
  private lastNoticeId = 0;
  private matchStart = 0;

  constructor(
    readonly def: GameDefinition<S, A, V, unknown>,
    opts: LocalHostOptions,
  ) {
    this.options = def.normalizeOptions(opts.options);
    this.seats = def.seats(this.options);
    this.totals = Array(this.seats).fill(0);
    this.seed = opts.seed >>> 0;
    this.dealRng = seededRng(this.seed);
    this.botRng = seededRng(this.seed ^ BOT_SALT);
    this.humans = new Set(opts.humans ?? [0]);
    this.botDelayMs = opts.botDelayMs ?? 1000;
    this.turnTimeoutMs = opts.turnTimeoutMs ?? def.clock.baseMs;
    this.noticeMs = opts.noticeMs ?? (this.turnTimeoutMs > 0 ? NOTICE_MS : 0);
  }

  /** Seats everyone (one name per seat) and deals the first round. */
  start(names: readonly string[], now: number): HostResult {
    if (this.state) return { ok: false, error: 'started' };
    if (names.length !== this.seats) return { ok: false, error: 'seats' };
    this.names = [...names];
    this.newRound(now);
    return { ok: true };
  }

  roundOver(): boolean {
    return !!this.state && this.def.roundOver(this.state);
  }

  /** The finished round ended the match (rounds are counted from the start of this match). */
  matchOver(): boolean {
    return !!this.state && this.def.roundOver(this.state) && this.def.matchOver(this.totals, this.round - this.matchStart, this.options);
  }

  nextRound(now: number): HostResult {
    if (!this.state || !this.def.roundOver(this.state)) return { ok: false, error: 'roundNotOver' };
    if (this.matchOver()) {
      this.totals = this.totals.map(() => 0);
      this.matchStart = this.round;
    }
    this.newRound(now);
    return { ok: true };
  }

  act(seat: number, action: A, now: number): HostResult {
    if (!this.state) return { ok: false, error: 'noGame' };
    const res = this.def.apply(this.state, seat, action);
    if (!res.ok) return res;
    this.state = res.state;
    this.log.push({ t: 'act', seat, action });
    this.tick(action, now);
    this.freezeForNotice(now);
    if (this.def.roundOver(this.state)) {
      this.def.scoreRound(this.state).forEach((s, i) => (this.totals[i] += s));
    }
    this.schedule(now);
    return { ok: true };
  }

  /** Plays the due automatic move (call when the `due.at` timer fires). Same fallback as Room.autoPlay. */
  runDue(now: number): HostResult {
    const g = this.state;
    const turn = g ? this.def.turn(g) : null;
    if (!g || !turn) return { ok: false, error: 'noTurn' };
    const seat = turn.seat;
    const action = this.humans.has(seat) ? this.def.quickMove(g, seat) : this.def.botMove(g, seat, 'medium', this.botRng);
    const res = this.act(seat, action, now);
    if (res.ok) return res;
    return this.act(seat, this.def.quickMove(g, seat), now);
  }

  /** What `seat` sees; during a notice panel the clock reads as it did when the notice came in. */
  view(seat: number, now: number): V | null {
    if (!this.state) return null;
    const v = this.def.viewFor(this.state, seat, { clock: this.clock, now: Math.max(now, this.frozenUntil) });
    const left = this.frozenUntil - now;
    return left > 0 && typeof v === 'object' && v !== null ? { ...v, noticeMsLeft: left } : v;
  }

  private newRound(now: number) {
    this.state = this.def.create(this.options, this.names, this.dealRng, this.round);
    this.log.push({ t: 'deal', round: this.round, names: [...this.names] });
    this.round++;
    this.lastNoticeId = 0;
    this.frozenUntil = 0;
    this.tick(null, now);
    this.schedule(now);
  }

  private tick(action: A | null, nowIn: number) {
    const now = Math.max(nowIn, this.frozenUntil);
    this.clock =
      this.state && this.turnTimeoutMs > 0
        ? nextTurnClock(this.clock, this.def.turn(this.state), action !== null && this.def.refillsClock(action), now, {
            baseMs: this.turnTimeoutMs,
            firstTurnFactor: this.def.clock.firstTurnFactor,
          })
        : null;
  }

  private freezeForNotice(now: number) {
    const notice = this.state && this.def.noticeOf ? this.def.noticeOf(this.state) : null;
    if (!notice || notice.id <= this.lastNoticeId) return;
    const fresh = notice.id - this.lastNoticeId;
    this.lastNoticeId = notice.id;
    if (this.noticeMs <= 0) return;
    const until = now + this.noticeMs * fresh;
    this.clock = freezeClock(this.clock, until - Math.max(now, this.frozenUntil));
    this.frozenUntil = until;
  }

  private schedule(now: number) {
    const turn = this.state ? this.def.turn(this.state) : null;
    this.due = null;
    if (!turn) return;
    if (!this.humans.has(turn.seat)) {
      this.due = { seat: turn.seat, kind: 'bot', at: now + Math.max(this.botDelayMs, this.frozenUntil - now) };
    } else if (this.clock) {
      this.due = { seat: turn.seat, kind: 'quick', at: now + Math.max(0, this.clock.deadline - now) };
    }
  }
}
