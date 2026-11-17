// C2: end-of-game summary for Tavla (pure). Reuses the card-game summary (rows by seat, winner by points).
import type { TavlaResult } from '@kahve/tavla';
import type { RoundSummary } from '../roundSummary';
import { cardSummary } from '../../net/cardSummary';

export interface TavlaSummaryInput {
  names: readonly string[];
  result: TavlaResult;
  /** Match totals per seat, this game included. Missing: only this game's points. */
  totals?: readonly number[] | null;
  matchOver: boolean;
  mySeat: number;
  you: string;
  /** Translated result words and the note template, e.g. {tek:'Tek', mars:'Mars', koncina:'Konçina'}. */
  kindLabel: Record<TavlaResult['kind'], string>;
  note(kind: string, points: number): string;
}

/** One row per seat: the winner scores `result.points` (1 tek, 2 mars, 2 or 3 konçina), the other 0. */
export function tavlaSummary(p: TavlaSummaryInput): RoundSummary {
  const points = p.names.map((_, seat) => (seat === p.result.winner ? p.result.points : 0));
  const summary = cardSummary({
    names: p.names,
    points,
    totals: p.totals ?? points,
    matchOver: p.matchOver,
    mySeat: p.mySeat,
    you: p.you,
  });
  return { ...summary, note: p.note(p.kindLabel[p.result.kind], p.result.points) };
}
