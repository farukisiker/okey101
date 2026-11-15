import { expect, it } from 'vitest';
import { compare, sameRank } from '../src/compare';
import { fullDeck } from '../src/deck';
import type { Suit } from '../src/types';

const suits: readonly Suit[] = ['S', 'H', 'D', 'C'];

it('checks every card pair, lead and optional trump against the trick rules', () => {
  const deck = fullDeck();
  for (const lead of suits) {
    for (const trump of [undefined, ...suits]) {
      for (const a of deck) {
        for (const b of deck) {
          let expected = 0;
          if (trump !== undefined && (a.suit === trump || b.suit === trump)) {
            expected = a.suit !== trump ? -1 : b.suit !== trump ? 1 : Math.sign(a.rank - b.rank);
          } else if (a.suit === lead || b.suit === lead) {
            expected = a.suit !== lead ? -1 : b.suit !== lead ? 1 : Math.sign(a.rank - b.rank);
          }
          expect(compare(a, b, lead, trump)).toBe(expected);
        }
      }
    }
  }
});

it('selects a trick winner by replacing the opening card only for positive comparisons', () => {
  const deck = fullDeck();
  const trick = [deck[21], deck[25], deck[0], deck[24]]; // H10, HA, S2, HK
  expect(trick.reduce((winner, card) => compare(card, winner, 'H', 'S') > 0 ? card : winner)).toBe(deck[0]);
  expect(trick.reduce((winner, card) => compare(card, winner, 'H') > 0 ? card : winner)).toBe(deck[25]);
});

it('matches ranks irrespective of suit or id for all card pairs', () => {
  for (const a of fullDeck()) {
    for (const b of fullDeck()) {
      expect(sameRank(a, b)).toBe(a.rank === b.rank);
    }
    expect(sameRank(a, { ...a, id: -1 })).toBe(true);
  }
});
