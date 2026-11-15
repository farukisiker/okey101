import type { GameNotice } from '@kahve/core';
import type { ViewStyle } from 'react-native';

/**
 * Standard card suits matching @kahve/cards (B1-CODEX contract):
 * S: Spades (Maça)
 * H: Hearts (Kupa)
 * D: Diamonds (Karo)
 * C: Clubs (Sinek)
 */
export type Suit = 'S' | 'H' | 'D' | 'C';

/**
 * Ranks 2..14:
 * 11 = Jack (Vale)
 * 12 = Queen (Kız)
 * 13 = King (Papaz)
 * 14 = Ace (As)
 */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: number; // 0..51 unique identifier
  suit: Suit;
  rank: Rank;
}

// ---- Helper utilities ----

export function rankLabel(rank: Rank): string {
  switch (rank) {
    case 14:
      return 'A';
    case 13:
      return 'K';
    case 12:
      return 'Q';
    case 11:
      return 'J';
    default:
      return String(rank);
  }
}

export function suitSymbol(suit: Suit): string {
  switch (suit) {
    case 'S':
      return '♠';
    case 'H':
      return '♥';
    case 'D':
      return '♦';
    case 'C':
      return '♣';
  }
}

export function suitColor(suit: Suit): string {
  return suit === 'H' || suit === 'D' ? '#d0312d' : '#1d1d1d';
}

export function cardDisplayString(card: Card): string {
  return `${suitSymbol(card.suit)} ${rankLabel(card.rank)}`;
}

export function makeCard(suit: Suit, rank: Rank, id?: number): Card {
  const suitIndex = suit === 'S' ? 0 : suit === 'H' ? 1 : suit === 'D' ? 2 : 3;
  const calculatedId = id ?? suitIndex * 13 + (rank - 2);
  return { id: calculatedId, suit, rank };
}

export function createDeck(): Card[] {
  const suits: Suit[] = ['S', 'H', 'D', 'C'];
  const cards: Card[] = [];
  let id = 0;
  for (const suit of suits) {
    for (let r = 2; r <= 14; r++) {
      cards.push({ id: id++, suit, rank: r as Rank });
    }
  }
  return cards;
}

export function sortCards(cards: Card[]): Card[] {
  const suitOrder: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3 };
  return [...cards].sort((a, b) => {
    if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
    return b.rank - a.rank; // descending
  });
}

// ---- 1. CardView & CardBack ----

export interface CardViewProps {
  card: Card;
  /** Outer width of card in dp (height = Math.round(width * 1.38)). */
  width: number;
  /** Lifted state after first tap with gold border. */
  selected?: boolean;
  /** Dimmed card (cannot be played in current trick / turn): opacity: 0.42. */
  disabled?: boolean;
  /** Green outline hint for matching cards (e.g. Pişti capture opportunity). */
  highlighted?: boolean;
  /** Corner or center short badge (e.g. "PİŞTİ" or "+10"). */
  badgeText?: string;
  style?: ViewStyle;
}

export interface CardBackProps {
  width: number;
  /** Card count label displayed on pile / deck. */
  count?: number;
  style?: ViewStyle;
}

// ---- 2. Hand ----

export interface HandProps {
  cards: Card[];
  cardWidth: number;
  cardStep: number;
  selectedCardId: number | null;
  canPlay: boolean;
  playableCardIds?: readonly number[];
  highlightedCardIds?: readonly number[];
  onSelectCard(cardId: number | null): void;
  onPlayCard(cardId: number): void;
  bleedLeft?: number;
  bleedRight?: number;
  bleedBottom?: number;
}

// ---- 3. PistiScreen Types and Props ----

export interface PistiPlayerPublic {
  seat: number;
  name: string;
  handCount: number;
  capturedCount: number;
  pistiCount: number;
  totalScore: number;
  connected?: boolean;
  isBot?: boolean;
}

export interface PistiLastCapture {
  seat: number;
  card: Card;
  isPisti: boolean;
  isJackPisti: boolean;
  pointsEarned: number; // 10 normal, 20 Jack
  capturedCount: number;
}

export interface PistiRoundResult {
  scores: number[];
  totals: number[];
  winnerSeats: number[];
  matchOver: boolean;
  breakdown?: {
    seat: number;
    cardsCount: number;
    pistiPoints: number;
    cardPoints: number;
    majorityBonus: number;
  }[];
}

export interface PistiView {
  phase: 'playing' | 'finished';
  seat: number;
  turn: number;
  seats: 2 | 4;
  partnerMode: boolean;
  targetScore: number;
  hand: Card[];
  deckCount: number;
  centerCount: number;
  topCard: Card | null;
  playableCardIds: number[];
  players: PistiPlayerPublic[];
  lastCapture: PistiLastCapture | null;
  turnMsLeft?: number | null;
  noticeMsLeft?: number;
  notices?: GameNotice[];
  result: PistiRoundResult | null;
}

export type PistiAction = { type: 'play'; cardId: number };

export interface PistiScreenProps {
  view: PistiView;
  seat: number;
  onAction(action: PistiAction): void | Promise<void>;
  onNextRound?(): void | Promise<void>;
  onLeave?(): void;
}

// ---- 4. BatakScreen and Dialog Types & Props ----

export interface BatakPlayerPublic {
  seat: number;
  name: string;
  handCount: number;
  tricksWon: number;
  bid: number | null; // null = hasn't spoken, 0 = pass, 4..13 = bid
  passed: boolean;
  totalScore: number;
  connected?: boolean;
  isBot?: boolean;
}

export interface TrickCard {
  seat: number;
  card: Card;
}

export interface BatakRoundResult {
  scores: number[];
  totals: number[];
  winnerSeats: number[];
  matchOver: boolean;
  declarerSeat: number | null;
  contractBid: number;
  declarerSucceeded: boolean;
}

export interface BatakView {
  phase: 'bidding' | 'selectingTrump' | 'playing' | 'finished';
  variant: 'ihaleli' | 'kozMaca' | 'esli';
  seat: number;
  turn: number;
  hand: Card[];
  legalCardIds: number[];
  players: BatakPlayerPublic[];
  minBid: number;
  highestBid: number;
  highestBidder: number | null;
  canPass: boolean;
  trump: Suit | null;
  trumpBroken: boolean;
  currentTrick: TrickCard[];
  lastTrickWinner: number | null;
  round: number;
  targetRounds: number;
  turnMsLeft?: number | null;
  noticeMsLeft?: number;
  notices?: GameNotice[];
  result: BatakRoundResult | null;
}

export type BatakAction =
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'selectTrump'; suit: Suit }
  | { type: 'play'; cardId: number };

export interface BatakScreenProps {
  view: BatakView;
  seat: number;
  onAction(action: BatakAction): void | Promise<void>;
  onNextRound?(): void | Promise<void>;
  onLeave?(): void;
}

export interface BidDialogProps {
  visible: boolean;
  minBid: number;
  highestBid: number;
  highestBidderName: string | null;
  canPass: boolean;
  scale: number;
  onBid(amount: number): void;
  onPass(): void;
}

export interface TrumpDialogProps {
  visible: boolean;
  winningBid: number;
  scale: number;
  onSelectTrump(suit: Suit): void;
}
