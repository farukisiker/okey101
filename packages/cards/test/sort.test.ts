import { expect, it } from 'vitest';
import { seededRng } from '@kahve/core';
import { fullDeck, shuffleDeck } from '../src/deck';
import { sortHand } from '../src/sort';

it.each(['asc', 'desc'] as const)('sorts all ranks by fixed suit blocks in %s order without mutation', order => {
  const hand = Object.freeze(shuffleDeck(seededRng(42)).map(card => Object.freeze(card)));
  const before = JSON.stringify(hand);
  const expected = ['S', 'H', 'D', 'C'].flatMap(suit => {
    const block = fullDeck().filter(card => card.suit === suit);
    return order === 'asc' ? block : block.reverse();
  });
  expect(sortHand(hand, order)).toEqual(expected);
  expect(JSON.stringify(hand)).toBe(before);
  expect(sortHand(hand, order)).not.toBe(hand);
});

it.each(['asc', 'desc'] as const)('preserves equal keys and handles empty/singleton hands (%s)', order => {
  const a = { ...fullDeck()[0], id: 99 };
  const b = fullDeck()[0];
  const hand = [a, fullDeck()[13], b];
  expect(sortHand(hand, order)).toEqual([a, b, fullDeck()[13]]);
  expect(sortHand(hand, order)[0]).toBe(a);
  expect(sortHand([], order)).toEqual([]);
  const singleton = [a];
  expect(sortHand(singleton, order)).toEqual(singleton);
  expect(sortHand(singleton, order)).not.toBe(singleton);
});
