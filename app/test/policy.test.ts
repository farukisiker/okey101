// B6: the ad policy is shared by every game. These tests pin today's okey behaviour:
// >2 hands, >=2 hands since the last ad, 180 s cooldown, fewer than 8 ads in 24 h,
// and ads only at natural breaks (leave / match over / alone at the table).
import { describe, expect, it } from 'vitest';
import { type AdHistory, DAY_MS, eligibleForAd, recentShows, shouldShowAtBreak } from '../src/ads/policy';
import { summaryHeadline } from '../src/components/roundSummary';

const NOW = 10 * DAY_MS;
const base = (o: Partial<AdHistory> = {}): AdHistory => ({ totalHands: 3, handsSinceAd: 3, lastAdAtMs: 0, shownAtMs: [], ...o });

describe('eligibleForAd', () => {
  it('keeps the first two hands ad-free', () => {
    expect(eligibleForAd(base({ totalHands: 1, handsSinceAd: 1 }), NOW)).toBe(false);
    expect(eligibleForAd(base({ totalHands: 2, handsSinceAd: 2 }), NOW)).toBe(false);
    expect(eligibleForAd(base({ totalHands: 3, handsSinceAd: 3 }), NOW)).toBe(true);
  });
  it('needs two hands since the last ad', () => {
    expect(eligibleForAd(base({ handsSinceAd: 1 }), NOW)).toBe(false);
    expect(eligibleForAd(base({ handsSinceAd: 2 }), NOW)).toBe(true);
  });
  it('waits 180 seconds after an ad', () => {
    expect(eligibleForAd(base({ lastAdAtMs: NOW - 179_999 }), NOW)).toBe(false);
    expect(eligibleForAd(base({ lastAdAtMs: NOW - 180_000 }), NOW)).toBe(true);
  });
  it('caps at 8 ads per rolling 24 hours', () => {
    const eight = Array.from({ length: 8 }, (_, i) => NOW - 1000 * (i + 1) - 200_000);
    expect(eligibleForAd(base({ shownAtMs: eight }), NOW)).toBe(false);
    expect(eligibleForAd(base({ shownAtMs: eight.slice(1) }), NOW)).toBe(true);
    const aged = eight.map((at) => at - DAY_MS);
    expect(eligibleForAd(base({ shownAtMs: aged }), NOW)).toBe(true);
  });
});

describe('recentShows', () => {
  it('drops old and invalid timestamps', () => {
    expect(recentShows([NOW - DAY_MS - 1, NOW - DAY_MS, NOW - 5, Number.NaN], NOW)).toEqual([NOW - 5]);
  });
});

describe('shouldShowAtBreak', () => {
  // The exact condition RoundResult used before B6: leave || over || humans <= 1.
  const legacy = (leave: boolean, over: boolean, humans: number) => leave || over || humans <= 1;
  it('matches the old okey rule for every input', () => {
    for (const leave of [false, true]) for (const over of [false, true]) for (const humans of [0, 1, 2, 3, 4]) {
      expect(shouldShowAtBreak(leave, over, humans)).toBe(legacy(leave, over, humans));
    }
  });
  it('stays quiet mid-match with several people', () => {
    expect(shouldShowAtBreak(false, false, 2)).toBe(false);
  });
});

describe('summaryHeadline', () => {
  const rows = [
    { seat: 0, name: 'Ali', points: 10, total: 10 },
    { seat: 1, name: 'Ayşe', points: 0, total: 5 },
    { seat: 2, name: 'Veli', points: 0, total: 5 },
  ];
  it('says you won', () => {
    expect(summaryHeadline({ rows, matchOver: false, winnerSeats: [0] }, 0)).toEqual({ kind: 'youWin' });
  });
  it('names the other winners, also on a tie', () => {
    expect(summaryHeadline({ rows, matchOver: true, winnerSeats: [1, 2] }, 0)).toEqual({ kind: 'winner', names: ['Ayşe', 'Veli'] });
  });
  it('handles nobody winning', () => {
    expect(summaryHeadline({ rows, matchOver: false, winnerSeats: [] }, 0)).toEqual({ kind: 'none' });
  });
});
