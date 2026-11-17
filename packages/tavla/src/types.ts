// C0 (Fable): the frozen Tavla contract. Codex implements against it; the app and catalog import it.
// Change only through docs/kahve/requests/<team>-tavla-<topic>.md and Fable's approval.
import type { TurnClock } from '@kahve/core';

/**
 * Board convention (absolute point numbers 1..24, as printed on a real board):
 *  - Seat 0 (Beyaz / White) moves 24 → 1, home board 1..6, enters from the bar onto 25 - die (19..24).
 *  - Seat 1 (Siyah / Black) moves 1 → 24, home board 19..24, enters from the bar onto die (1..6).
 *  - `points[p]` for p = 1..24: > 0 white checkers, < 0 black checkers, 0 empty. Index 0 is unused (always 0), length 25.
 */
export type Variant = 'klasik';

/** House rules. Only 'klasik' is playable in the first release (Gülbara / Tapa reserved); normalizeOptions enforces it. */
export interface TavlaOptions {
  variant: Variant;
  /** Match ends when a player reaches this many points. Default 5. */
  targetScore: 1 | 3 | 5 | 7;
  /** Points for çifte mars (konçina / backgammon). Default 3; 2 = scored like a mars. */
  koncinaPoints: 2 | 3;
}

/** Where a step starts: the bar or a point 1..24. */
export type From = 'bar' | number;
/** Where a step ends: a point 1..24 or borne off. */
export type To = number | 'off';

/** One checker moved by one die. */
export interface Step {
  from: From;
  to: To;
  die: number;
  /** True if this step hit an opponent's lone checker (sent it to the bar). */
  hit: boolean;
}

/**
 * Actions. A turn is a series of `step`s, then `commit`.
 *  - step: move one checker from `from` by `die` (the target follows from the rules; bear-off with a larger die is allowed
 *    only where the rules say so). Rejected unless the partial turn stays a prefix of some legal maximal sequence
 *    (both dice if possible, otherwise the larger die; four steps on doubles if possible).
 *  - undo: takes back the last step of this turn (any number of times, until commit).
 *  - commit: ends the turn. Allowed only when the steps played are a complete legal sequence
 *    (when no move is possible at all, commit is the "Pas" with zero steps).
 */
export type TavlaAction = { type: 'step'; from: From; die: number } | { type: 'undo' } | { type: 'commit' };

export type TavlaPhase = 'playing' | 'finished';
export type ResultKind = 'tek' | 'mars' | 'koncina';

export interface TavlaResult {
  winner: number;
  kind: ResultKind;
  /** Points the winner gets for this game (1, 2 or koncinaPoints). */
  points: number;
}

/** A finished turn, kept so every client can animate the opponent's move. */
export interface TurnRecord {
  turnNumber: number;
  seat: number;
  dice: [number, number];
  steps: Step[];
}

export interface Board {
  /** Length 25, index 0 unused. > 0 white, < 0 black. */
  points: number[];
  /** Checkers on the bar per seat. */
  bar: [number, number];
  /** Checkers borne off per seat. */
  off: [number, number];
}

/** Authoritative state (host only). Plain JSON. `rngState` must never reach a view. */
export interface TavlaState {
  options: TavlaOptions;
  round: number;
  players: { seat: number; name: string }[];
  board: Board;
  /** Board when this turn's dice were rolled (undo replays `steps` from here). */
  turnStart: Board;
  turn: number;
  /** Increments on every commit; also the turn clock key. 0 = the opening turn. */
  turnNumber: number;
  phase: TavlaPhase;
  /** This turn's dice as rolled (opening turn: [white's die, black's die], never a double). */
  dice: [number, number];
  /** Dice values still to play this turn (4 entries on doubles at the start). */
  remaining: number[];
  /** Steps already played this turn. */
  steps: Step[];
  /** The opening roll, one die per seat: [seat 0's die, seat 1's die]. */
  openingRoll: [number, number];
  lastTurn: TurnRecord | null;
  result: TavlaResult | null;
  /** Hidden dice generator state (mulberry32 counter seeded from `create`'s rng). Never in a view. */
  rngState: number;
}

/** A move the UI can offer for one checker: a single die, or several dice in a row for the same checker ("8 (3+5)"). */
export interface CheckerMove {
  from: From;
  to: To;
  /** Dice in the order the UI sends them as `step` actions. */
  dice: number[];
}

/** What a seat sees. Tavla is a full-information game; only the dice generator is hidden. */
export interface TavlaView {
  options: TavlaOptions;
  round: number;
  /** The viewer's seat, or -1 for a spectator / invalid seat. */
  seat: number;
  players: { seat: number; name: string; pips: number }[];
  board: Board;
  turn: number | null;
  turnNumber: number;
  phase: TavlaPhase;
  dice: [number, number];
  remaining: number[];
  steps: Step[];
  openingRoll: [number, number];
  /** Only on the viewer's own turn (empty otherwise): every legal next step, then multi-die moves of one checker. */
  moves: CheckerMove[];
  /** Viewer's turn and the steps played make a complete legal sequence (the "Tamam" button). */
  canCommit: boolean;
  /** Viewer's turn and no move is possible with these dice (the "Pas" button; commit with zero steps). */
  mustPass: boolean;
  canUndo: boolean;
  lastTurn: TurnRecord | null;
  result: TavlaResult | null;
  clock: TurnClock | null;
}
