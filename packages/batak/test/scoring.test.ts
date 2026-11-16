import { describe, expect, it } from 'vitest';
import { apply, legalCardsFor } from '../src/rules';
import { matchOver, roundScores, scoreRound } from '../src/scoring';
import { defaultOptions } from '../src/options';
import type { BatakState } from '../src/types';
import { fresh } from './helpers';

describe('roundScores', () => {
  it('BAT-T15: declarer makes 7 with 9; zero-trick seat pays the bid', () => {
    expect(roundScores([9, 2, 2, 0], 0, 7, defaultOptions)).toEqual([9, 2, 2, -7]);
  });
  it('BAT-T16: declarer fails 8 with 7', () => {
    expect(roundScores([7, 3, 2, 1], 0, 8, defaultOptions)).toEqual([-8, 3, 2, 1]);
  });
  it('exact contract counts as made', () => {
    expect(roundScores([5, 3, 3, 2], 0, 5, defaultOptions)).toEqual([5, 3, 3, 2]);
  });
  it('zeroTrickPenalty modes', () => {
    expect(roundScores([9, 4, 0, 0], 0, 6, { zeroTrickPenalty: 'fixed5' })).toEqual([9, 4, -5, -5]);
    expect(roundScores([9, 4, 0, 0], 0, 6, { zeroTrickPenalty: 'none' })).toEqual([9, 4, 0, 0]);
  });
  it.each(['bid', 'fixed5', 'none'] as const)('declarer with zero tricks pays the contract only once (%s)', zeroTrickPenalty => {
    expect(roundScores([4, 5, 0, 4], 2, 6, { zeroTrickPenalty })).toEqual([4, 5, -6, 4]);
  });
});

describe('matchOver', () => {
  const o = { targetRounds: 9 as const };
  it('not before targetRounds', () => {
    expect(matchOver([30, 1, 2, 3], 8, o)).toBe(false);
  });
  it('unique leader ends it', () => {
    expect(matchOver([30, 1, 2, 3], 9, o)).toBe(true);
  });
  it('tie at the top plays one extra round, then ends as a shared win', () => {
    expect(matchOver([30, 30, 2, 3], 9, o)).toBe(false);
    expect(matchOver([30, 30, 2, 3], 10, o)).toBe(true);
    expect(matchOver([31, 30, 2, 3], 10, o)).toBe(true);
  });
  it('tie lower down does not matter', () => {
    expect(matchOver([40, 3, 3, 3], 9, o)).toBe(true);
  });
});

describe('full round (BAT-T23)', () => {
  it('13 tricks -> finished, sum of tricks 13, result equals scoreRound', () => {
    let s: BatakState = fresh(11);
    s = (apply(s, 0, { type: 'bid', amount: 5 }) as { state: BatakState }).state;
    for (let i = 0; i < 3; i++) s = (apply(s, s.turn, { type: 'pass' }) as { state: BatakState }).state;
    s = (apply(s, 0, { type: 'selectTrump', suit: 'H' }) as { state: BatakState }).state;
    let moves = 0;
    while (s.phase === 'playing') {
      const card = legalCardsFor(s, s.turn)[0];
      const r = apply(s, s.turn, { type: 'play', cardId: card.id });
      if (!r.ok) throw new Error(r.error);
      s = r.state;
      moves++;
    }
    expect(moves).toBe(52);
    expect(s.phase).toBe('finished');
    expect(s.tricksWon.reduce((a, b) => a + b, 0)).toBe(13);
    expect(s.players.every(p => p.hand.length === 0)).toBe(true);
    expect(s.result?.scores).toEqual(roundScores(s.tricksWon, 0, 5, s.options));
    expect(scoreRound(s)).toEqual(s.result?.scores);
    expect(apply(s, s.turn, { type: 'pass' }).ok).toBe(false);
  });
  it('scoreRound without result falls back safely', () => {
    const s = fresh();
    expect(scoreRound(s)).toEqual([0, 0, 0, 0]);
    s.declarer = 1;
    s.contract = 5;
    s.tricksWon = [4, 5, 4, 0];
    expect(scoreRound(s)).toEqual([4, 5, 4, -5]);
  });
});
