import {
  type Action,
  type GameMode,
  type GameState,
  type RoomInfo,
  type Rng,
  type TableSummary,
  SEATS,
  applyAction,
  createGame,
  matchOver,
  pickBotNames,
  viewFor,
} from '@okey/shared';
import { botStep, quickMove } from './bot';

export interface Seat {
  name: string;
  isBot: boolean;
  /** Socket id of the human in this seat, null when disconnected. */
  socketId: string | null;
}

export interface RoomOptions {
  mode?: GameMode;
  /** Listed in the salon. */
  isPublic?: boolean;
  /** Sitting down needs this 6-digit password (the table is still listed). */
  password?: string | null;
  botDelayMs?: number;
  /** A human who doesn't move in time gets a bot move instead. 0 disables. */
  turnTimeoutMs?: number;
  rng?: Rng;
}

export type RoomListener = (room: Room) => void;

/** One table: seats, the authoritative game state and the turn clock. */
export class Room {
  readonly seats: (Seat | null)[] = Array(SEATS).fill(null);
  game: GameState | null = null;
  round = 0;
  totals = [0, 0, 0, 0];
  hostSeat = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly botDelayMs: number;
  private readonly turnTimeoutMs: number;
  private readonly rng?: Rng;
  readonly mode: GameMode;
  readonly isPublic: boolean;
  readonly password: string | null;

  constructor(
    readonly id: string,
    private readonly onChange: RoomListener,
    opts: RoomOptions = {},
  ) {
    this.botDelayMs = opts.botDelayMs ?? 1000;
    this.turnTimeoutMs = opts.turnTimeoutMs ?? 60_000;
    this.rng = opts.rng;
    this.mode = opts.mode ?? '101';
    this.isPublic = opts.isPublic ?? false;
    this.password = opts.password ?? null;
  }

  get started() {
    return this.game !== null;
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
    if (this.game) this.game.players[seat].name = name;
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
      const [name] = pickBotNames(1, taken, this.rng);
      this.seats[seat] = { name, isBot: true, socketId: null };
      this.game.players[seat].name = name;
    }
    this.changed();
    this.schedule();
  }

  private free(seat: number) {
    this.seats[seat] = null;
    // The host left before the start: the next person at the table can start it.
    if (seat === this.hostSeat) {
      const next = this.seats.findIndex((s) => s && !s.isBot);
      if (next >= 0) this.hostSeat = next;
    }
  }

  /** Four people at a table that hasn't started: deal. */
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
    const names = pickBotNames(empty.length, taken, this.rng);
    empty.forEach((seat, i) => (this.seats[seat] = { name: names[i], isBot: true, socketId: null }));
    this.newRound();
    return null;
  }

  nextRound(): string | null {
    if (!this.game || this.game.phase !== 'finished') return 'Tur bitmedi';
    // Düz okey: once someone is out of points a new game starts from scratch.
    if (matchOver(this.mode, this.totals)) this.totals = [0, 0, 0, 0];
    this.newRound();
    return null;
  }

  private newRound() {
    this.game = createGame({
      mode: this.mode,
      names: this.seats.map((s) => s!.name),
      startingSeat: this.round % SEATS,
      rng: this.rng,
    });
    this.round++;
    this.changed();
    this.schedule();
  }

  act(seat: number, action: Action): string | null {
    if (!this.game) return 'Oyun başlamadı';
    const res = applyAction(this.game, seat, action);
    if (!res.ok) return res.error;
    this.game = res.state;
    if (this.game.phase === 'finished') {
      this.game.result!.scores.forEach((s, i) => (this.totals[i] += s));
    }
    this.changed();
    this.schedule();
    return null;
  }

  info(): RoomInfo {
    return {
      id: this.id,
      mode: this.mode,
      isPublic: this.isPublic,
      ...(this.password !== null && { password: this.password }),
      seats: this.seats.map((s, seat) =>
        s ? { seat, name: s.name, isBot: s.isBot, connected: s.isBot || s.socketId !== null } : null,
      ),
      hostSeat: this.hostSeat,
      started: this.started,
      round: this.round,
      totals: this.totals,
    };
  }

  viewFor(seat: number) {
    return this.game ? viewFor(this.game, seat) : null;
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private changed() {
    this.onChange(this);
  }

  /** Arms the clock for whoever is to move: bots/absent players quickly, humans on timeout. */
  private schedule() {
    this.dispose();
    const g = this.game;
    // Nobody watching: pause until a human comes back.
    if (!g || g.phase !== 'playing' || !this.hasHumans()) return;
    const seat = this.seats[g.turn]!;
    const auto = seat.isBot || seat.socketId === null;
    const delay = auto ? this.botDelayMs : this.turnTimeoutMs;
    if (!auto && delay <= 0) return;
    this.timer = setTimeout(() => this.autoPlay(), delay);
  }

  /** Plays one bot action for the current seat (bot, absent human or timed-out human). */
  autoPlay() {
    const g = this.game;
    if (!g || g.phase !== 'playing') return;
    const seat = g.turn;
    const seatInfo = this.seats[seat]!;
    const view = viewFor(g, seat);
    // A timed-out human only gets the minimum: draw, then throw.
    const timedOut = !seatInfo.isBot && seatInfo.socketId !== null;
    const action = timedOut ? quickMove(view) : botStep(view, { rng: this.rng });
    if (this.act(seat, action) !== null) {
      // Should not happen; fall back to the simplest legal move.
      const fallback: Action =
        g.turnPhase === 'draw'
          ? { type: 'draw', source: 'deck' }
          : { type: 'discard', tileId: view.hand.find((t) => t.id !== view.mustUseTileId)!.id };
      const err = this.act(seat, fallback);
      if (err) throw new Error(`bot stuck at seat ${seat}: ${err}`);
    }
  }
}
