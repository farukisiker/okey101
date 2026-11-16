import type { ViewStyle } from 'react-native';

// Card, Suit and Rank are the engine's (@kahve/cards, B1). Pişti's and Batak's view and action types come
// from @kahve/catalog (B5). What is left here is UI-only: card helpers and component props.
import type { Card, Rank, Suit } from '@kahve/cards';

export type { Card, Rank, Suit };

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

// ---- 4. Batak dialogs (the view and action types come from @kahve/catalog) ----

export interface BidDialogProps {
  visible: boolean;
  minBid: number;
  highestBid: number;
  highestBidderName: string | null;
  canPass: boolean;
  scale: number;
  /** Space kept free at the bottom for the action bar and the hand, so the hand stays readable (B11). */
  reserveBottom?: number;
  onBid(amount: number): void;
  onPass(): void;
}

export interface TrumpDialogProps {
  visible: boolean;
  winningBid: number;
  scale: number;
  /** Space kept free at the bottom for the action bar and the hand, so the hand stays readable (B11). */
  reserveBottom?: number;
  onSelectTrump(suit: Suit): void;
}
