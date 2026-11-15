import type { Card, HandOrder, Suit } from './types';

const suitIndex: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3 };

/** Suit order stays S,H,D,C; only rank direction changes. Ties stay stable. */
export function sortHand(hand: readonly Card[], order: HandOrder): Card[] {
  const direction = order === 'asc' ? 1 : -1;
  return [...hand].sort((a, b) => suitIndex[a.suit] - suitIndex[b.suit] || direction * (a.rank - b.rank));
}
