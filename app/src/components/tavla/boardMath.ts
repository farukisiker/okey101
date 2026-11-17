// C2 (stand-in for Antigravity): pure Tavla board maths. No react-native import, so vitest can load it.
import type { Board, CheckerMove, From, Step, TavlaAction, To, TurnRecord } from '@kahve/tavla';

export type Row = 'top' | 'bottom';
export interface Cell {
  row: Row;
  /** 0..11 left to right, the bar not counted. */
  col: number;
}

/** The seat whose orientation is drawn: a spectator (-1) sees seat 0's. */
export const viewerSeatOf = (seat: number): number => (seat === 1 ? 1 : 0);

/**
 * Where an absolute point (1..24) is drawn. The viewer's own checkers are at the bottom with home bottom-right:
 *  - seat 0 (white, home 1..6): bottom row 12..1, top row 13..24, left to right;
 *  - seat 1 (black, home 19..24): bottom row 13..24, top row 12..1, left to right.
 * Both seats move counter-clockwise on screen, so the board reads the same for both.
 */
export function pointCell(point: number, viewer: number): Cell {
  const low = point <= 12;
  const col = low ? 12 - point : point - 13;
  const lowRow: Row = viewer === 1 ? 'top' : 'bottom';
  const highRow: Row = viewer === 1 ? 'bottom' : 'top';
  return { row: low ? lowRow : highRow, col };
}

/** Inverse of pointCell. */
export function cellPoint(row: Row, col: number, viewer: number): number {
  const lowRow: Row = viewer === 1 ? 'top' : 'bottom';
  return row === lowRow ? 12 - col : 13 + col;
}

/** Sign of a seat's checkers on `Board.points`: white +, black -. */
export const signOf = (seat: number): 1 | -1 => (seat === 0 ? 1 : -1);

/** Point a checker lands on after one die, ignoring bearing off. */
export function stepDestination(from: From, die: number, seat: number): number {
  if (from === 'bar') return seat === 0 ? 25 - die : die;
  return seat === 0 ? from - die : from + die;
}

/** The `step` actions for one CheckerMove, in the order they are sent. */
export function planSteps(move: CheckerMove, seat: number): TavlaAction[] {
  const out: TavlaAction[] = [];
  let from: From = move.from;
  for (const die of move.dice) {
    out.push({ type: 'step', from, die });
    from = stepDestination(from, die, seat);
  }
  return out;
}

/** True while the view still offers this step as a legal next step (so a multi-die move can go on). */
export function nextStepOffered(view: { moves: CheckerMove[] }, a: TavlaAction): boolean {
  if (a.type !== 'step') return false;
  return view.moves.some((m) => m.from === a.from && m.dice[0] === a.die);
}

/** Every `from` the player may pick up this turn. */
export function movableFroms(moves: CheckerMove[]): Set<From> {
  return new Set(moves.map((m) => m.from));
}

/** From `from`, one move per target. Several routes to one target: the one with fewest dice (the first on a tie). */
export function targetsFor(moves: CheckerMove[], from: From): Map<To, CheckerMove> {
  const out = new Map<To, CheckerMove>();
  for (const m of moves) {
    if (m.from !== from) continue;
    const cur = out.get(m.to);
    if (!cur || m.dice.length < cur.dice.length) out.set(m.to, m);
  }
  return out;
}

export interface MoveLabel {
  /** Big text: the total pips ("8"). */
  main: string;
  /** Second line for several dice ("3+5", "4×3"). */
  parts?: string;
}

export function moveLabel(move: CheckerMove): MoveLabel {
  const sum = move.dice.reduce((a, b) => a + b, 0);
  if (move.dice.length === 1) return { main: String(sum) };
  const same = move.dice.every((d) => d === move.dice[0]);
  return { main: String(sum), parts: same ? `${move.dice.length}×${move.dice[0]}` : move.dice.join('+') };
}

/** Plain-text label ("8 (3+5)") for accessibility. */
export function moveLabelText(move: CheckerMove): string {
  const l = moveLabel(move);
  return l.parts ? `${l.main} (${l.parts})` : l.main;
}

/** Which of the two dice are used up, from the dice still to play. Doubles: both used when nothing remains. */
export function usedDice(dice: [number, number], remaining: number[]): [boolean, boolean] {
  if (dice[0] === dice[1]) {
    const gone = remaining.length === 0;
    return [gone, gone];
  }
  const left = [...remaining];
  const used: [boolean, boolean] = [true, true];
  dice.forEach((d, i) => {
    const at = left.indexOf(d);
    if (at >= 0) {
      left.splice(at, 1);
      used[i] = false;
    }
  });
  return used;
}

/** How many of a stack are drawn: at most 5, and the real count when there are more. */
export function stackShown(count: number): { shown: number; extra: number | null } {
  return count > 5 ? { shown: 5, extra: count } : { shown: count, extra: null };
}

export const copyBoard = (b: Board): Board => ({ points: [...b.points], bar: [b.bar[0], b.bar[1]], off: [b.off[0], b.off[1]] });

/** Takes the moving checker off its starting place. */
export function liftChecker(board: Board, seat: number, from: From): Board {
  const b = copyBoard(board);
  if (from === 'bar') b.bar[seat] = Math.max(0, b.bar[seat] - 1);
  else b.points[from] -= signOf(seat);
  return b;
}

/** Puts the moving checker down; a hit sends the lone opposing checker to the bar. */
export function landChecker(board: Board, seat: number, to: To, hit: boolean): Board {
  const b = copyBoard(board);
  if (to === 'off') {
    b.off[seat] += 1;
    return b;
  }
  if (hit) {
    b.points[to] = 0;
    b.bar[1 - seat] += 1;
  }
  b.points[to] += signOf(seat);
  return b;
}

export function applyStep(board: Board, seat: number, step: Step): Board {
  return landChecker(liftChecker(board, seat, step.from), seat, step.to, step.hit);
}

/** Exact inverse of applyStep. */
export function unapplyStep(board: Board, seat: number, step: Step): Board {
  const b = copyBoard(board);
  if (step.to === 'off') b.off[seat] = Math.max(0, b.off[seat] - 1);
  else {
    b.points[step.to] -= signOf(seat);
    if (step.hit) {
      b.points[step.to] = signOf(1 - seat);
      b.bar[1 - seat] = Math.max(0, b.bar[1 - seat] - 1);
    }
  }
  if (step.from === 'bar') b.bar[seat] += 1;
  else b.points[step.from] += signOf(seat);
  return b;
}

/** The board as it was before a finished turn (its steps taken back in reverse). */
export function boardBefore(board: Board, turn: TurnRecord): Board {
  let b = copyBoard(board);
  for (let i = turn.steps.length - 1; i >= 0; i--) b = unapplyStep(b, turn.seat, turn.steps[i]);
  return b;
}

/** Whether a checker of `seat` landing on `to` hits a lone opposing checker. */
export function wouldHit(board: Board, seat: number, to: To): boolean {
  if (to === 'off') return false;
  return board.points[to] === signOf(1 - seat);
}

/** Checkers of a seat on a point (0 when empty or the other colour). */
export function countAt(board: Board, seat: number, point: number): number {
  const n = board.points[point] * signOf(seat);
  return n > 0 ? n : 0;
}

/** Pip count: pips each checker still has to travel. */
export function pipCount(board: Board, seat: number): number {
  let pips = board.bar[seat] * 25;
  for (let p = 1; p <= 24; p++) {
    const n = countAt(board, seat, p);
    pips += n * (seat === 0 ? p : 25 - p);
  }
  return pips;
}
