import { expect, it } from 'vitest';
import { fullDeck } from '../src/deck';
import { cardLabel, suitColor } from '../src/display';

it('labels every rank in every suit', () => {
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  expect(fullDeck().map(cardLabel)).toEqual(['♠', '♥', '♦', '♣'].flatMap(symbol => ranks.map(rank => rank + symbol)));
});

it.each([['S', 'black'], ['H', 'red'], ['D', 'red'], ['C', 'black']] as const)(
  'colors %s as %s', (suit, color) => expect(suitColor(suit)).toBe(color),
);
