import { expect, it } from 'vitest';
import { sumTotals } from '../src/scores';

it.each([
  { totals: [], round: [], expected: [] },
  { totals: [0, 0], round: [10, -5], expected: [10, -5] },
  { totals: [100, -20, 5, 0], round: [-10, 20, 0, 3], expected: [90, 0, 5, 3] },
])('adds $totals and $round without mutation', ({ totals, round, expected }) => {
  Object.freeze(totals);
  Object.freeze(round);
  const beforeTotals = [...totals];
  const beforeRound = [...round];
  const result = sumTotals(totals, round);
  expect(result).toEqual(expected);
  expect(result).not.toBe(totals);
  expect(result).not.toBe(round);
  expect(totals).toEqual(beforeTotals);
  expect(round).toEqual(beforeRound);
});
