import type { Card, Suit } from '@kahve/cards';

export type BatakVariant = 'ihaleli' | 'kozMaca' | 'esli';
export type VoidTrump = 'always' | 'ifCanOvertrump' | 'never';
export type ZeroTrickPenalty = 'bid' | 'fixed5' | 'none';

/** House rules. Only `variant: 'ihaleli'` is playable in the first release; normalizeOptions enforces it. */
export interface BatakOptions {
  variant: BatakVariant;
  targetRounds: 5 | 7 | 9 | 11 | 13;
  minBid: 4 | 5;
  forcedDealerBid: 4 | 5;
  voidTrump: VoidTrump;
  mustRaise: boolean;
  trumpLeadNeedsBreak: boolean;
  zeroTrickPenalty: ZeroTrickPenalty;
  /** Reserved for Koz Maça (not playable yet). */
  kozMacaOvertrickLimit: 0 | 2 | 3;
  /** Reserved for Eşli Batak (not playable yet). */
  partnerDummy: boolean;
}

/** Koz Maça will add `{ type: 'declare'; tricks: number }` (reserved, not part of the first release). */
export type BatakAction =
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'selectTrump'; suit: Suit }
  | { type: 'play'; cardId: number };

export type BatakPhase = 'bidding' | 'selectingTrump' | 'playing' | 'finished';

export interface TrickCard {
  seat: number;
  card: Card;
}

export interface CompletedTrick {
  leader: number;
  cards: TrickCard[];
  winner: number;
}

export interface BatakLastAction {
  turnNumber: number;
  seat: number;
  action: BatakAction;
}

export interface BatakRoundScores {
  scores: number[];
}

export interface BatakState {
  options: BatakOptions;
  round: number;
  dealer: number;
  turn: number;
  turnNumber: number;
  phase: BatakPhase;
  players: { seat: number; name: string; hand: Card[] }[];
  /** Last amount each seat bid, null if it never bid. */
  bids: (number | null)[];
  passed: boolean[];
  /** 0 = no bid yet. */
  highestBid: number;
  highestBidder: number | null;
  declarer: number | null;
  /** 0 until bidding is resolved. */
  contract: number;
  /** The dealer got the contract because everyone else passed without a bid. */
  forcedBid: boolean;
  trump: Suit | null;
  trumpBroken: boolean;
  currentTrick: TrickCard[];
  tricks: CompletedTrick[];
  tricksWon: number[];
  lastAction: BatakLastAction | null;
  result: BatakRoundScores | null;
}

export interface BatakPlayerPublic {
  seat: number;
  name: string;
  handCount: number;
  tricksWon: number;
  /** null = hasn't bid and hasn't passed, 0 = passed without bidding, n = last bid. */
  bid: number | null;
  passed: boolean;
  isDeclarer: boolean;
}

export interface BatakView {
  options: BatakOptions;
  variant: BatakVariant;
  round: number;
  targetRounds: number;
  dealer: number;
  seat: number;
  turn: number | null;
  turnNumber: number;
  phase: BatakPhase;
  hand: Card[];
  legalCardIds: number[];
  players: BatakPlayerPublic[];
  minBid: number;
  highestBid: number;
  highestBidder: number | null;
  canPass: boolean;
  declarer: number | null;
  contract: number;
  forcedBid: boolean;
  trump: Suit | null;
  trumpBroken: boolean;
  currentTrick: TrickCard[];
  lastTrick: CompletedTrick | null;
  lastTrickWinner: number | null;
  /** Finished tricks of this round (all were played face up). */
  tricks: CompletedTrick[];
  lastAction: BatakLastAction | null;
  result: BatakRoundScores | null;
}
