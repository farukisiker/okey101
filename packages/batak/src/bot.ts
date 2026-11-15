import type { Card, Suit } from '@kahve/cards';
import type { BotLevel, Rng } from '@kahve/core';
import { MAX_BID, trickWinner } from './rules';
import type { BatakAction, BatakView } from './types';

const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];
const ofSuit = (hand: readonly Card[], suit: Suit) => hand.filter(c => c.suit === suit);

/** Expected tricks if `trump` were trump (medium/hard bidding heuristic). */
export function estimateTricks(hand: readonly Card[], trump: Suit): number {
  let est = 0;
  const trumpLen = ofSuit(hand, trump).length;
  for (const suit of SUITS) {
    const cards = ofSuit(hand, suit);
    const len = cards.length;
    for (const c of cards) {
      if (c.rank === 14) est += 1;
      else if (c.rank === 13) est += len >= 2 ? 0.8 : 0.3;
      else if (c.rank === 12 && len >= 3) est += 0.5;
    }
    if (suit === trump) est += Math.max(0, len - 4) * 0.9;
    else if (trumpLen >= 3) est += len === 0 ? 0.6 : len === 1 ? 0.3 : 0;
  }
  return est;
}

/** Trump suit with the best estimate; ties go to the longer suit, then S,H,D,C order. */
export function bestTrump(hand: readonly Card[]): Suit {
  let best: Suit = 'S';
  let bestScore = -1;
  for (const suit of SUITS) {
    const score = estimateTricks(hand, suit) * 100 + ofSuit(hand, suit).length;
    if (score > bestScore) {
      best = suit;
      bestScore = score;
    }
  }
  return best;
}

/** Longest suit (timeout rule); ties: higher rank sum, then S,H,D,C. */
function longestSuit(hand: readonly Card[]): Suit {
  let best: Suit = 'S';
  let bestScore = -1;
  for (const suit of SUITS) {
    const cards = ofSuit(hand, suit);
    const score = cards.length * 1000 + cards.reduce((a, c) => a + c.rank, 0);
    if (score > bestScore) {
      best = suit;
      bestScore = score;
    }
  }
  return best;
}

/** Low trumps, length and the lead are worth about this much on top of the honour count. Tuned on the 200-seed sim: 1 -> 39% all-pass forced deals, 2 -> 7% forced and 74% of contracts made. */
export const BID_BIAS = 2;

const nextMinBid = (v: BatakView) => Math.max(v.minBid, v.highestBid + 1);

function bidAction(v: BatakView, estimate: number): BatakAction {
  const need = nextMinBid(v);
  const tricks = Math.min(MAX_BID, Math.floor(estimate));
  // Score is the tricks taken, the contract only sets the risk: raise by the minimum.
  return need <= MAX_BID && tricks >= need ? { type: 'bid', amount: need } : { type: 'pass' };
}

/** Cheapest first: non-trump before trump, then by rank. */
const byCost = (trump: Suit | null) => (a: Card, b: Card) => Number(a.suit === trump) - Number(b.suit === trump) || a.rank - b.rank;

function legalOf(v: BatakView): Card[] {
  return v.hand.filter(c => v.legalCardIds.includes(c.id));
}

/** Legal cards that would take the trick right now. */
function winners(v: BatakView, legal: Card[]): Card[] {
  if (v.currentTrick.length === 0 || v.trump === null) return [];
  const trump = v.trump;
  return legal.filter(c => trickWinner([...v.currentTrick, { seat: v.seat, card: c }], trump) === v.seat);
}

function mediumPlay(v: BatakView, legal: Card[]): Card {
  const trump = v.trump as Suit;
  const cheap = legal.slice().sort(byCost(trump));
  if (v.currentTrick.length === 0) {
    const myTrumps = ofSuit(v.hand, trump);
    const legalTrumps = ofSuit(legal, trump);
    if (v.declarer === v.seat && myTrumps.length >= 3 && legalTrumps.length > 0) return legalTrumps.sort((a, b) => b.rank - a.rank)[0];
    const ace = legal.find(c => c.rank === 14 && c.suit !== trump);
    if (ace) return ace;
    return lowFromLongestSide(legal, trump) ?? cheap[0];
  }
  const win = winners(v, legal).sort(byCost(trump));
  return win[0] ?? cheap[0];
}

function lowFromLongestSide(legal: Card[], trump: Suit): Card | undefined {
  let best: Card[] = [];
  for (const suit of SUITS) {
    if (suit === trump) continue;
    const cards = ofSuit(legal, suit);
    if (cards.length > best.length) best = cards;
  }
  return best.sort((a, b) => a.rank - b.rank)[0];
}

/** Card memory for the hard bot, built only from public tricks and its own hand. */
function memory(v: BatakView) {
  const seen = new Set<number>();
  const voids: Set<Suit>[] = [0, 1, 2, 3].map(() => new Set<Suit>());
  const tricks = [...v.tricks.map(t => t.cards), v.currentTrick];
  for (const cards of tricks) {
    if (cards.length === 0) continue;
    const lead = cards[0].card.suit;
    for (const t of cards) {
      seen.add(t.card.id);
      if (t.card.suit !== lead) voids[t.seat].add(lead);
    }
  }
  const mine = new Set(v.hand.map(c => c.id));
  /** Cards nobody has shown and that are not in my hand: they sit in the other hands. */
  const unseenHigher = (c: Card) => {
    let n = 0;
    for (let r = c.rank + 1; r <= 14; r++) {
      const id = SUITS.indexOf(c.suit) * 13 + (r - 2);
      if (!seen.has(id) && !mine.has(id)) n++;
    }
    return n;
  };
  const trump = v.trump as Suit;
  let outTrumps = 13 - ofSuit(v.hand, trump).length;
  for (const id of seen) if (Math.floor(id / 13) === SUITS.indexOf(trump)) outTrumps--;
  return { voids, unseenHigher, outTrumps };
}

function hardPlay(v: BatakView, legal: Card[]): Card {
  const trump = v.trump as Suit;
  const cheap = legal.slice().sort(byCost(trump));
  const mem = memory(v);
  const others = [0, 1, 2, 3].filter(s => s !== v.seat);
  if (v.currentTrick.length === 0) {
    const legalTrumps = ofSuit(legal, trump).sort((a, b) => b.rank - a.rank);
    // Declarer draws trumps while any are out and it holds the top one.
    if (v.declarer === v.seat && mem.outTrumps > 0 && legalTrumps.length > 0 && mem.unseenHigher(legalTrumps[0]) === 0) return legalTrumps[0];
    // Cash a side-suit boss that nobody can ruff.
    const bosses = legal
      .filter(c => c.suit !== trump && mem.unseenHigher(c) === 0)
      .filter(c => mem.outTrumps === 0 || others.every(s => !mem.voids[s].has(c.suit)))
      .sort((a, b) => b.rank - a.rank);
    if (bosses.length > 0) return bosses[0];
    if (v.declarer === v.seat && mem.outTrumps > 0 && legalTrumps.length > mem.outTrumps) return legalTrumps[0];
    return lowFromLongestSide(legal, trump) ?? cheap[0];
  }
  const win = winners(v, legal).sort(byCost(trump));
  if (win.length === 0) return cheap[0];
  if (v.currentTrick.length === 3) return win[0];
  const lead = v.currentTrick[0].card.suit;
  const later = [1, 2, 3].map(i => (v.seat + i) % 4).slice(0, 3 - v.currentTrick.length);
  const ruffRisk = mem.outTrumps > 0 && later.some(s => mem.voids[s].has(lead) && !mem.voids[s].has(trump));
  const safe = win.filter(c => (c.suit === trump ? mem.unseenHigher(c) === 0 || !ruffRisk : mem.unseenHigher(c) === 0 && !ruffRisk));
  if (safe.length > 0) return safe[0];
  // A winner that later seats can still beat: spend it only if forced (legal set has nothing cheaper).
  return cheap[0];
}

/** Bot move from the seat's own view only (never the full state). Always legal. */
export function botMove(v: BatakView, level: BotLevel, rng: Rng): BatakAction {
  if (v.phase === 'bidding') {
    if (level === 'easy') {
      const rough = v.hand.filter(c => c.rank === 14).length + v.hand.filter(c => c.rank === 13).length / 2 + Math.max(0, Math.max(...SUITS.map(s => ofSuit(v.hand, s).length)) - 4);
      return bidAction(v, rough + BID_BIAS + Math.floor(rng() * 3) - 1);
    }
    return bidAction(v, estimateTricks(v.hand, bestTrump(v.hand)) + BID_BIAS);
  }
  if (v.phase === 'selectingTrump') return { type: 'selectTrump', suit: level === 'easy' ? longestSuit(v.hand) : bestTrump(v.hand) };
  const legal = legalOf(v);
  if (legal.length === 0) return { type: 'pass' };
  let card: Card;
  if (level === 'easy') card = legal[Math.floor(rng() * legal.length)] ?? legal[0];
  else if (level === 'medium') card = mediumPlay(v, legal);
  else card = hardPlay(v, legal);
  return { type: 'play', cardId: card.id };
}

/** Timeout move: pass; longest suit as trump; lowest legal card (non-trump first on equal rank). */
export function quickMove(v: BatakView): BatakAction {
  if (v.phase === 'bidding') return { type: 'pass' };
  if (v.phase === 'selectingTrump') return { type: 'selectTrump', suit: longestSuit(v.hand) };
  const legal = legalOf(v).sort((a, b) => a.rank - b.rank || Number(a.suit === v.trump) - Number(b.suit === v.trump));
  return legal.length > 0 ? { type: 'play', cardId: legal[0].id } : { type: 'pass' };
}
