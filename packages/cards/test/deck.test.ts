import { describe, expect, it, vi } from 'vitest';
import { seededRng, shuffle } from '@kahve/core';
import { deal, fullDeck, shuffleDeck } from '../src/deck';

describe('fullDeck', () => {
  it('creates every suit/rank pair once with fixed ids', () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(card => card.id)).size).toBe(52);
    expect(new Set(deck.map(card => `${card.suit}${card.rank}`)).size).toBe(52);
    for (const [index, suit] of (['S', 'H', 'D', 'C'] as const).entries()) {
      expect(deck.slice(index * 13, (index + 1) * 13)).toEqual(
        Array.from({ length: 13 }, (_, offset) => ({ id: index * 13 + offset, suit, rank: offset + 2 })),
      );
    }
  });

  it('allocates a fresh array and fresh objects on every call', () => {
    const first = fullDeck();
    const second = fullDeck();
    expect(first).not.toBe(second);
    first.forEach((card, index) => expect(card).not.toBe(second[index]));
    first[0].rank = 14;
    expect(second[0].rank).toBe(2);
  });
});

describe('shuffleDeck', () => {
  it.each([0, 1, 42, -1])('is deterministic and preserves all cards for seed %s', seed => {
    const result = shuffleDeck(seededRng(seed));
    expect(result).toEqual(shuffleDeck(seededRng(seed)));
    expect(result).toEqual(shuffle(fullDeck(), seededRng(seed)));
    expect([...result].sort((a, b) => a.id - b.id)).toEqual(fullDeck());
  });
  it('uses only the supplied RNG exactly 51 times', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unexpected random'); });
    try {
      const rng = vi.fn(() => 0);
      expect(shuffleDeck(rng)).toHaveLength(52);
      expect(rng).toHaveBeenCalledTimes(51);
      expect(random).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  });
});

describe('deal', () => {
  it.each([[4, 4], [1, 0, 3], [13, 13, 13, 13], [], [0, 0]])('deals blocks for %j', (...counts) => {
    const deck = Object.freeze(fullDeck().map(card => Object.freeze(card)));
    const before = JSON.stringify(deck);
    const result = deal(deck, Object.freeze(counts));
    let offset = 0;
    result.hands.forEach((hand, index) => {
      expect(hand).toEqual(deck.slice(offset, offset + counts[index]));
      offset += counts[index];
    });
    expect(result.remaining).toEqual(deck.slice(offset));
    expect([...result.hands.flat(), ...result.remaining]).toEqual(deck);
    expect(result.remaining).not.toBe(deck);
    expect(JSON.stringify(deck)).toBe(before);
  });
  it('accepts an empty deck and returns independent empty arrays', () => {
    expect(deal([], [])).toEqual({ hands: [], remaining: [] });
    const result = deal([], [0, 0]);
    expect(result).toEqual({ hands: [[], []], remaining: [] });
    expect(result.hands[0]).not.toBe(result.hands[1]);
  });
  it.each([-1, 0.5, NaN, Infinity, -Infinity, 53, Number.MAX_VALUE])('rejects invalid count %s', count => {
    expect(() => deal(fullDeck(), [count])).toThrow(RangeError);
  });
  it('rejects an excessive total and leaves inputs intact', () => {
    const deck = fullDeck();
    const counts = [30, 23];
    expect(() => deal(deck, counts)).toThrow(RangeError);
    expect(deck).toEqual(fullDeck());
    expect(counts).toEqual([30, 23]);
  });
  it('returns new arrays that can be changed without changing the deck', () => {
    const deck = fullDeck();
    const { hands, remaining } = deal(deck, [4]);
    hands[0].pop();
    remaining.reverse();
    expect(deck).toEqual(fullDeck());
  });
});
