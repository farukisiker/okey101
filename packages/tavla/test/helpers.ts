import { seededRng } from '@kahve/core';
import { create } from '../src/rules';
import { defaultOptions } from '../src/options';
import type { Board, TavlaOptions, TavlaState } from '../src/types';

export const names = ['Ali', 'Ayşe'];

export const fresh = (seed = 1, opts: Partial<TavlaOptions> = {}, round = 0): TavlaState =>
  create({ ...defaultOptions, ...opts }, names, seededRng(seed), round);

/**
 * A board from checker counts per absolute point. Checkers not on the board or the bar are borne off (15 each).
 * w = white (seat 0, moves 24 -> 1), b = black (seat 1, moves 1 -> 24).
 */
export function board(spec: { w?: Record<number, number>; b?: Record<number, number>; barW?: number; barB?: number; offW?: number; offB?: number }): Board {
  const points = new Array<number>(25).fill(0);
  let w = spec.barW ?? 0;
  let b = spec.barB ?? 0;
  for (const [p, n] of Object.entries(spec.w ?? {})) {
    points[Number(p)] += n;
    w += n;
  }
  for (const [p, n] of Object.entries(spec.b ?? {})) {
    if (points[Number(p)] > 0) throw new Error(`point ${p} has both colours`);
    points[Number(p)] -= n;
    b += n;
  }
  const offW = spec.offW ?? 15 - w;
  const offB = spec.offB ?? 15 - b;
  if (w + offW !== 15 || b + offB !== 15) throw new Error('not 15 checkers each');
  return { points, bar: [spec.barW ?? 0, spec.barB ?? 0], off: [offW, offB] };
}

/** A mid-game state with this board, `turn` to move with `dice` (no steps yet). */
export function position(b: Board, turn: number, dice: [number, number], opts: Partial<TavlaOptions> = {}): TavlaState {
  const s = fresh(7, opts);
  return {
    ...s,
    board: JSON.parse(JSON.stringify(b)) as Board,
    turnStart: JSON.parse(JSON.stringify(b)) as Board,
    turn,
    turnNumber: 10,
    dice,
    remaining: dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : [dice[0], dice[1]],
    steps: [],
  };
}

/** Total checkers per seat on board + bar + off. */
export function counts(b: Board): [number, number] {
  let w = b.bar[0] + b.off[0];
  let k = b.bar[1] + b.off[1];
  for (let p = 1; p <= 24; p++) {
    if (b.points[p] > 0) w += b.points[p];
    else k -= b.points[p];
  }
  return [w, k];
}
