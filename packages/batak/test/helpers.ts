import { fullDeck, type Card, type Rank, type Suit } from '@kahve/cards';
import { seededRng } from '@kahve/core';
import { defaultOptions } from '../src/options';
import { create } from '../src/setup';
import type { BatakOptions, BatakState } from '../src/types';

const deck = fullDeck();
/** Card from a short label like 'S14' (ace of spades), 'H10', 'D2'. */
export const c = (label: string): Card => {
  const suit = label[0] as Suit;
  const rank = Number(label.slice(1)) as Rank;
  const card = deck.find(x => x.suit === suit && x.rank === rank);
  if (!card) throw new Error(`bad card ${label}`);
  return { ...card };
};
export const cs = (...labels: string[]): Card[] => labels.map(c);
export const names = ['Ali', 'Ayşe', 'Mehmet', 'Fatma'];
export const fresh = (seed = 1, opts: Partial<BatakOptions> = {}, round = 0): BatakState =>
  create({ ...defaultOptions, ...opts }, names, seededRng(seed), round);

/** A state in the playing phase with the given hands, trump and current trick. */
export function playing(p: {
  hands: string[][];
  trump: Suit;
  turn: number;
  trick?: [number, string][];
  trumpBroken?: boolean;
  opts?: Partial<BatakOptions>;
  declarer?: number;
  contract?: number;
}): BatakState {
  const s = fresh(1, p.opts ?? {});
  s.phase = 'playing';
  s.players = s.players.map((pl, seat) => ({ ...pl, hand: cs(...p.hands[seat]) }));
  s.trump = p.trump;
  s.turn = p.turn;
  s.turnNumber = 10;
  s.trumpBroken = p.trumpBroken ?? false;
  s.currentTrick = (p.trick ?? []).map(([seat, label]) => ({ seat, card: c(label) }));
  s.declarer = p.declarer ?? 0;
  s.contract = p.contract ?? 5;
  s.highestBid = s.contract;
  s.highestBidder = s.declarer;
  s.passed = [true, true, true, true].map((_, i) => i !== s.declarer);
  return s;
}
