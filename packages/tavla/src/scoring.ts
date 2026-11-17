import type { TavlaOptions, TavlaState } from './types';

/** [p, 0] or [0, p] for the winner of a finished game; [0, 0] otherwise. */
export function scoreRound(s: TavlaState): number[] {
  if (!s.result) return [0, 0];
  return s.result.winner === 0 ? [s.result.points, 0] : [0, s.result.points];
}

export const matchOver = (totals: number[], _rounds: number, opts: TavlaOptions): boolean => totals.some(t => t >= opts.targetScore);
