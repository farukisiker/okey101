import type { Card, Suit } from './types';

/** Positive means a wins. Two cards outside lead/trump are equally ineffective. */
export function compare(a: Card, b: Card, lead: Suit, trump?: Suit): -1 | 0 | 1 {
  const priority = (card: Card): number => card.suit === trump ? 2 : card.suit === lead ? 1 : 0;
  const aPriority = priority(a);
  const bPriority = priority(b);
  const difference = aPriority - bPriority || (aPriority > 0 ? a.rank - b.rank : 0);
  return difference > 0 ? 1 : difference < 0 ? -1 : 0;
}

export function sameRank(a: Card, b: Card): boolean {
  return a.rank === b.rank;
}
