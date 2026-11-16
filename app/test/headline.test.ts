import { describe, expect, it } from 'vitest';
import { type RoundSummary, summaryHeadlineText } from '../src/components/roundSummary';
import { hasPistiChance } from '../src/components/cards/pistiChance';
import { cardSummary } from '../src/net/cardSummary';

const rows = [
  { seat: 0, name: 'Ali', points: 5, total: 5 },
  { seat: 1, name: 'Hasan', points: 9, total: 9 },
];
const okey: RoundSummary = { rows, matchOver: false, winnerSeats: [1] };

describe('summaryHeadlineText', () => {
  it('okey summaries (no cardGame flag) keep the okey wording', () => {
    expect(summaryHeadlineText(okey, 0)).toEqual({ key: 'actFinished', vars: { name: 'Hasan' } });
    expect(summaryHeadlineText({ ...okey, winnerSeats: [0] }, 0)).toEqual({ key: 'youFinished' });
    expect(summaryHeadlineText({ ...okey, matchOver: true }, 0)).toEqual({ key: 'winnerIs', vars: { name: 'Hasan' } });
    expect(summaryHeadlineText({ ...okey, matchOver: true, winnerSeats: [0] }, 0)).toEqual({ key: 'youWon' });
    expect(summaryHeadlineText({ ...okey, winnerSeats: [] }, 0)).toEqual({ key: 'tilesRanOut' });
  });

  it('card games: hand and match, me or another, draw', () => {
    const card = { ...okey, cardGame: true };
    expect(summaryHeadlineText(card, 0)).toEqual({ key: 'cardHandWinner', vars: { name: 'Hasan' } });
    expect(summaryHeadlineText({ ...card, winnerSeats: [0] }, 0)).toEqual({ key: 'cardYouWonHand' });
    expect(summaryHeadlineText({ ...card, matchOver: true }, 0)).toEqual({ key: 'cardMatchWinner', vars: { name: 'Hasan' } });
    expect(summaryHeadlineText({ ...card, matchOver: true, winnerSeats: [0] }, 0)).toEqual({ key: 'cardYouWonMatch' });
    expect(summaryHeadlineText({ ...card, winnerSeats: [] }, 0)).toEqual({ key: 'cardDraw' });
  });

  it('cardSummary marks the summary as a card game; partners: the winning team row names the team', () => {
    const s = cardSummary({
      names: ['Ali', 'Cem', 'Ayşe', 'Kemal'], points: [3, 12, 3, 12], totals: [3, 12, 3, 12],
      matchOver: true, teams: [0, 1, 0, 1], mySeat: 0, you: 'Sen',
    });
    expect(s.cardGame).toBe(true);
    expect(summaryHeadlineText(s, 0)).toEqual({ key: 'cardMatchWinner', vars: { name: 'Cem & Kemal' } });
  });
});

describe('hasPistiChance', () => {
  const hand = [{ rank: 5 }, { rank: 11 }];
  it('one centre card and a card of the same rank: yes', () => {
    expect(hasPistiChance({ rank: 5 }, 1, hand)).toBe(true);
  });
  it('a Jack in hand on a non-Jack single card is a normal capture, not a pişti chance', () => {
    expect(hasPistiChance({ rank: 9 }, 1, hand)).toBe(false);
  });
  it('a single Jack in the centre with a Jack in hand: yes', () => {
    expect(hasPistiChance({ rank: 11 }, 1, hand)).toBe(true);
  });
  it('empty centre, several cards, no card or empty hand: no', () => {
    expect(hasPistiChance(null, 0, hand)).toBe(false);
    expect(hasPistiChance({ rank: 5 }, 2, hand)).toBe(false);
    expect(hasPistiChance({ rank: 5 }, 1, [])).toBe(false);
  });
});
