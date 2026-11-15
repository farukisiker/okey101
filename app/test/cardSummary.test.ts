import { describe, expect, it } from 'vitest';
import { cardSummary, viewScores, viewTeams } from '../src/net/cardSummary';
import { msLeftNow } from '../src/net/localHost';

const base = { you: 'Sen', mySeat: 0 };

describe('cardSummary', () => {
  it('two players: one row each, the hand winner by points', () => {
    const s = cardSummary({ ...base, names: ['Ali', 'Veli'], points: [13, 4], totals: [40, 30], matchOver: false });
    expect(s.rows).toEqual([
      { seat: 0, name: 'Ali', points: 13, total: 40 },
      { seat: 1, name: 'Veli', points: 4, total: 30 },
    ]);
    expect(s.winnerSeats).toEqual([0]);
    expect(s.matchOver).toBe(false);
  });

  it('match over: the winner is picked by the totals, not the last hand', () => {
    const s = cardSummary({ ...base, names: ['Ali', 'Veli'], points: [2, 20], totals: [155, 120], matchOver: true });
    expect(s.winnerSeats).toEqual([0]);
  });

  it('everyone level: nobody wins; a two-way tie of four names both', () => {
    expect(cardSummary({ ...base, names: ['A', 'B'], points: [5, 5], totals: [5, 5], matchOver: false }).winnerSeats).toEqual([]);
    const four = cardSummary({ ...base, names: ['A', 'B', 'C', 'D'], points: [7, 1, 7, 0], totals: [7, 1, 7, 0], matchOver: false });
    expect(four.winnerSeats).toEqual([0, 2]);
  });

  it('pişti partner mode [A, B, A, B]: two team rows, both seats of the winning team win', () => {
    const s = cardSummary({
      names: ['Ali', 'Veli', 'Ayşe', 'Can'],
      points: [12, 5, 12, 5],
      totals: [60, 30, 60, 30],
      matchOver: false,
      teams: [0, 1, 0, 1],
      mySeat: 2,
      you: 'Sen',
    });
    expect(s.rows).toEqual([
      { seat: 0, name: 'Ali & Sen', points: 12, total: 60 },
      { seat: 1, name: 'Veli & Can', points: 5, total: 30 },
    ]);
    expect(s.winnerSeats).toEqual([0, 2]);
  });

  it('solo four players with team = seat: four rows', () => {
    const s = cardSummary({ ...base, names: ['A', 'B', 'C', 'D'], points: [1, 9, 3, 0], totals: [1, 9, 3, 0], matchOver: false, teams: [0, 1, 2, 3] });
    expect(s.rows).toHaveLength(4);
    expect(s.winnerSeats).toEqual([1]);
  });
});

describe('view helpers', () => {
  it('viewScores reads result.scores, null while playing or malformed', () => {
    expect(viewScores({ result: { scores: [3, 4] } })).toEqual([3, 4]);
    expect(viewScores({ result: null })).toBeNull();
    expect(viewScores({ result: { scores: ['x'] } })).toBeNull();
    expect(viewScores(null)).toBeNull();
  });

  it('viewTeams maps players by seat', () => {
    expect(viewTeams({ players: [{ seat: 1, team: 1 }, { seat: 0, team: 0 }] })).toEqual([0, 1]);
    expect(viewTeams({ players: [{ seat: 0 }] })).toBeUndefined();
    expect(viewTeams({})).toBeUndefined();
  });
});

describe('msLeftNow', () => {
  it('counts down from the moment the view arrived, waits out a notice panel, never below 0', () => {
    expect(msLeftNow({ turnMsLeft: 30_000 }, 1000, 1000)).toBe(30_000);
    expect(msLeftNow({ turnMsLeft: 30_000 }, 1000, 11_000)).toBe(20_000);
    expect(msLeftNow({ turnMsLeft: 30_000, noticeMsLeft: 5000 }, 1000, 4000)).toBe(30_000);
    expect(msLeftNow({ turnMsLeft: 30_000, noticeMsLeft: 5000 }, 1000, 16_000)).toBe(20_000);
    expect(msLeftNow({ turnMsLeft: 100 }, 0, 5000)).toBe(0);
    expect(msLeftNow({ turnMsLeft: null }, 0, 0)).toBeNull();
    expect(msLeftNow(null, 0, 0)).toBeNull();
  });
});
