import { shuffle, type Rng } from '@kahve/core';
import type { Card, DealResult, Rank, Suit } from './types';

/** Fixed suit blocks S,H,D,C, each containing ranks 2 through A. */
export function fullDeck(): Card[] {
  const suits: readonly Suit[] = ['S', 'H', 'D', 'C'];
  return suits.flatMap((suit, suitIndex) =>
    Array.from({ length: 13 }, (_, offset) => ({
      id: suitIndex * 13 + offset,
      suit,
      rank: (offset + 2) as Rank,
    })),
  );
}

export function shuffleDeck(rng: Rng): Card[] {
  return shuffle(fullDeck(), rng);
}

/** Deal consecutive blocks from index zero, preserving the remaining order. */
export function deal(deck: readonly Card[], counts: readonly number[]): DealResult {
  let total = 0;
  for (const count of counts) {
    if (!Number.isInteger(count) || count < 0 || count > deck.length - total) {
      throw new RangeError('Deal counts must be nonnegative integers within the deck size');
    }
    total += count;
  }
  let offset = 0;
  const hands = counts.map(count => {
    const hand = deck.slice(offset, offset + count);
    offset += count;
    return hand;
  });
  return { hands, remaining: deck.slice(offset) };
}
