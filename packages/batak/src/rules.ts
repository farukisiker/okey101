import { compare, type Card, type Suit } from '@kahve/cards';
import type { ApplyResult } from '@kahve/core';
import { clone } from './clone';
import { roundScores } from './scoring';
import { HAND_SIZE, SEATS } from './setup';
import type { BatakAction, BatakOptions, BatakState, TrickCard } from './types';

export const MAX_BID = 13;
const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C'];

export const ERR = {
  wrongTurn: 'Sıra sizde değil',
  wrongPhase: 'Bu hamle şu anda yapılamaz',
  badAction: 'Geçersiz hamle',
  minBid: (n: number) => `İhale en az ${n} olmalı`,
  raise: 'Mevcut ihaleden yüksek söylemelisiniz',
  maxBid: `İhale en fazla ${MAX_BID} olabilir`,
  notDeclarer: 'Kozu ihaleyi alan seçer',
  noCard: 'Bu kart elinizde yok',
  trumpLead: 'Koz kırılmadan koz çıkılamaz',
  follow: 'Yerdeki renge uymak zorundasınız',
  raiseSuit: 'Yerdeki kartı büyütmek zorundasınız',
  mustTrump: 'Elinizde dönen renk yoksa koz atmak zorundasınız',
  overtrump: 'Yerdeki kozu büyütmek zorundasınız',
} as const;

type PlayRules = Pick<BatakOptions, 'voidTrump' | 'mustRaise' | 'trumpLeadNeedsBreak'>;

/**
 * The one rule tree for card play. Returns the legal cards and, for any other card, why it is illegal.
 * Used by `legalCards` (view, bots) and by `apply`, so the two can never disagree.
 */
function analyze(
  hand: readonly Card[],
  trick: readonly TrickCard[],
  trump: Suit,
  trumpBroken: boolean,
  opts: PlayRules,
): { legal: Card[]; reason: (card: Card) => string } {
  const all = hand.slice();
  if (trick.length === 0) {
    const nonTrump = all.filter(c => c.suit !== trump);
    if (opts.trumpLeadNeedsBreak && !trumpBroken && nonTrump.length > 0) return { legal: nonTrump, reason: () => ERR.trumpLead };
    return { legal: all, reason: () => ERR.badAction };
  }
  const lead = trick[0].card.suit;
  const trickTrumps = trick.filter(t => t.card.suit === trump).map(t => t.card.rank);
  const followers = all.filter(c => c.suit === lead);

  // A) Must follow suit. Raising is required only while the led suit can still win the trick.
  if (followers.length > 0) {
    if (opts.mustRaise && (lead === trump || trickTrumps.length === 0)) {
      const top = Math.max(...trick.filter(t => t.card.suit === lead).map(t => t.card.rank));
      const higher = followers.filter(c => c.rank > top);
      if (higher.length > 0) return { legal: higher, reason: c => (c.suit === lead ? ERR.raiseSuit : ERR.follow) };
    }
    return { legal: followers, reason: () => ERR.follow };
  }

  // B) Void in the led suit but holding trump.
  const trumps = all.filter(c => c.suit === trump);
  if (trumps.length > 0 && opts.voidTrump !== 'never') {
    const topTrump = trickTrumps.length > 0 ? Math.max(...trickTrumps) : 0;
    const over = trumps.filter(c => c.rank > topTrump);
    if (opts.voidTrump === 'always') {
      if (opts.mustRaise && over.length > 0) return { legal: over, reason: c => (c.suit === trump ? ERR.overtrump : ERR.mustTrump) };
      return { legal: trumps, reason: () => ERR.mustTrump };
    }
    // 'ifCanOvertrump': trump only when it can take the lead, otherwise free.
    if (over.length > 0) {
      const legal = opts.mustRaise ? over : trumps;
      return { legal, reason: c => (c.suit === trump || topTrump > 0 ? ERR.overtrump : ERR.mustTrump) };
    }
  }

  // C) Neither the led suit nor a trump obligation: any card.
  return { legal: all, reason: () => ERR.badAction };
}

/** Cards `hand` may play on `trick`. Pure; the hint list the view sends equals what `apply` accepts. */
export function legalCards(hand: readonly Card[], trick: readonly TrickCard[], trump: Suit, trumpBroken: boolean, opts: PlayRules): Card[] {
  return analyze(hand, trick, trump, trumpBroken, opts).legal;
}

/** Seat that wins a full (or partial) trick: highest trump, otherwise highest card of the led suit. */
export function trickWinner(trick: readonly TrickCard[], trump: Suit): number {
  const lead = trick[0].card.suit;
  let best = trick[0];
  for (const t of trick.slice(1)) if (compare(t.card, best.card, lead, trump) > 0) best = t;
  return best.seat;
}

/** Legal cards for the seat whose turn it is in the playing phase, otherwise []. */
export function legalCardsFor(state: BatakState, seat: number): Card[] {
  if (state.phase !== 'playing' || state.turn !== seat || state.trump === null) return [];
  return legalCards(state.players[seat].hand, state.currentTrick, state.trump, state.trumpBroken, state.options);
}

const isRecord = (x: unknown): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x);
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x);

export function isAction(raw: unknown): raw is BatakAction {
  if (!isRecord(raw)) return false;
  switch (raw.type) {
    case 'bid':
      return isInt(raw.amount);
    case 'pass':
      return true;
    case 'selectTrump':
      return (SUITS as readonly unknown[]).includes(raw.suit);
    case 'play':
      return isInt(raw.cardId) && raw.cardId >= 0 && raw.cardId < 52;
    default:
      return false;
  }
}

/** Only the known fields of an action, so stray network keys never reach the state. */
function canonical(a: BatakAction): BatakAction {
  switch (a.type) {
    case 'bid':
      return { type: 'bid', amount: a.amount };
    case 'selectTrump':
      return { type: 'selectTrump', suit: a.suit };
    case 'play':
      return { type: 'play', cardId: a.cardId };
    default:
      return { type: 'pass' };
  }
}

const fail = (error: string): ApplyResult<BatakState> => ({ ok: false, error });

/** Next seat after `seat` that has not passed. */
function nextBidder(s: BatakState, seat: number): number {
  for (let i = 1; i <= SEATS; i++) {
    const n = (seat + i) % SEATS;
    if (!s.passed[n]) return n;
  }
  return seat;
}

function closeBidding(s: BatakState, declarer: number, contract: number, forced: boolean): void {
  s.declarer = declarer;
  s.contract = contract;
  s.forcedBid = forced;
  s.phase = 'selectingTrump';
  s.turn = declarer;
}

function applyBidding(s: BatakState, seat: number, action: BatakAction): string | null {
  if (action.type === 'bid') {
    const min = s.options.minBid;
    if (action.amount < min) return ERR.minBid(min);
    if (action.amount <= s.highestBid) return ERR.raise;
    if (action.amount > MAX_BID) return ERR.maxBid;
    s.bids[seat] = action.amount;
    s.highestBid = action.amount;
    s.highestBidder = seat;
    if (action.amount === MAX_BID) {
      closeBidding(s, seat, MAX_BID, false);
      return null;
    }
  } else if (action.type === 'pass') {
    s.passed[seat] = true;
  } else {
    return ERR.wrongPhase;
  }
  const passedCount = s.passed.filter(Boolean).length;
  if (passedCount >= SEATS - 1) {
    const remaining = s.passed.findIndex(p => !p);
    if (s.highestBidder !== null) closeBidding(s, s.highestBidder, s.highestBid, false);
    // Nobody bid: the last seat (always the dealer) takes the forced contract.
    else closeBidding(s, remaining, s.options.forcedDealerBid, true);
    return null;
  }
  s.turn = nextBidder(s, seat);
  return null;
}

function applyPlay(s: BatakState, seat: number, cardId: number): string | null {
  const trump = s.trump as Suit;
  const hand = s.players[seat].hand;
  const card = hand.find(c => c.id === cardId);
  if (!card) return ERR.noCard;
  const { legal, reason } = analyze(hand, s.currentTrick, trump, s.trumpBroken, s.options);
  if (!legal.some(c => c.id === cardId)) return reason(card);

  s.players[seat].hand = hand.filter(c => c.id !== cardId);
  s.currentTrick.push({ seat, card });
  if (card.suit === trump) s.trumpBroken = true;
  if (s.currentTrick.length < SEATS) {
    s.turn = (seat + 1) % SEATS;
    return null;
  }
  const winner = trickWinner(s.currentTrick, trump);
  s.tricks.push({ leader: s.currentTrick[0].seat, cards: s.currentTrick, winner });
  s.tricksWon[winner] += 1;
  s.currentTrick = [];
  s.turn = winner;
  if (s.tricks.length === HAND_SIZE) {
    s.phase = 'finished';
    s.result = { scores: roundScores(s.tricksWon, s.declarer as number, s.contract, s.options) };
  }
  return null;
}

/** Validates and applies one action. Never throws and never mutates `state`. */
export function apply(state: BatakState, seat: number, action: BatakAction): ApplyResult<BatakState> {
  try {
    if (!isAction(action)) return fail(ERR.badAction);
    if (!isInt(seat) || seat < 0 || seat >= SEATS) return fail(ERR.wrongTurn);
    if (state.phase === 'finished') return fail(ERR.wrongPhase);
    if (state.turn !== seat) return fail(ERR.wrongTurn);
    const s = clone(state);
    let error: string | null;
    if (s.phase === 'bidding') {
      error = applyBidding(s, seat, action);
    } else if (s.phase === 'selectingTrump') {
      if (action.type !== 'selectTrump') error = ERR.wrongPhase;
      else if (s.declarer !== seat) error = ERR.notDeclarer;
      else {
        s.trump = action.suit;
        s.phase = 'playing';
        s.turn = seat;
        error = null;
      }
    } else {
      error = action.type === 'play' ? applyPlay(s, seat, action.cardId) : ERR.wrongPhase;
    }
    if (error !== null) return fail(error);
    s.lastAction = { turnNumber: s.turnNumber, seat, action: canonical(action) };
    s.turnNumber += 1;
    return { ok: true, state: s };
  } catch {
    return fail(ERR.badAction);
  }
}
