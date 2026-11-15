import { expect, expectTypeOf, it } from 'vitest';
import { seededRng, type Rng } from '@kahve/core';
import * as cards from '../src/index';
import type { Card, DealResult, HandOrder, Rank, Suit } from '../src/index';

it('exposes the approved public functions and type signatures', () => {
  expect(Object.keys(cards).sort()).toEqual([
    'cardLabel', 'compare', 'deal', 'fullDeck', 'sameRank', 'shuffleDeck', 'sortHand', 'suitColor',
  ]);
  expectTypeOf<Suit>().toEqualTypeOf<'S' | 'H' | 'D' | 'C'>();
  expectTypeOf<Rank>().toEqualTypeOf<2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14>();
  expectTypeOf<Card>().toEqualTypeOf<{ id: number; suit: Suit; rank: Rank }>();
  expectTypeOf<HandOrder>().toEqualTypeOf<'asc' | 'desc'>();
  expectTypeOf<DealResult>().toEqualTypeOf<{ hands: Card[][]; remaining: Card[] }>();
  expectTypeOf(cards.fullDeck).toEqualTypeOf<() => Card[]>();
  expectTypeOf(cards.shuffleDeck).toEqualTypeOf<(rng: Rng) => Card[]>();
  expectTypeOf(cards.deal).toEqualTypeOf<(deck: readonly Card[], counts: readonly number[]) => DealResult>();
  expectTypeOf(cards.compare).toEqualTypeOf<(a: Card, b: Card, lead: Suit, trump?: Suit) => -1 | 0 | 1>();
  expectTypeOf(cards.sameRank).toEqualTypeOf<(a: Card, b: Card) => boolean>();
  expectTypeOf(cards.suitColor).toEqualTypeOf<(suit: Suit) => 'red' | 'black'>();
  expectTypeOf(cards.cardLabel).toEqualTypeOf<(card: Card) => string>();
  expectTypeOf(cards.sortHand).toEqualTypeOf<(hand: readonly Card[], order: HandOrder) => Card[]>();
});

it('round-trips deck and deal results through plain JSON and reuses them with the public API', () => {
  const deck = cards.shuffleDeck(seededRng(2026));
  const restored: Card[] = JSON.parse(JSON.stringify(deck));
  expect(restored).toEqual(deck);
  restored.forEach(card => {
    expect(Object.getPrototypeOf(card)).toBe(Object.prototype);
    expect(Object.keys(card).sort()).toEqual(['id', 'rank', 'suit']);
    expect(cards.cardLabel(card)).toBe(cards.cardLabel(deck.find(original => original.id === card.id)!));
  });
  const result = cards.deal(restored, [4, 4]);
  const roundTrip: DealResult = JSON.parse(JSON.stringify(result));
  expect(roundTrip).toEqual(result);
  expect(cards.sortHand(roundTrip.hands[0], 'asc')).toEqual(cards.sortHand(result.hands[0], 'asc'));
  expect([...roundTrip.hands.flat(), ...roundTrip.remaining]).toEqual(deck);
});
