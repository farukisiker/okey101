import type { Card, Suit } from './types';

const symbols: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
const faces: Partial<Record<Card['rank'], string>> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function suitColor(suit: Suit): 'red' | 'black' {
  return suit === 'H' || suit === 'D' ? 'red' : 'black';
}

export function cardLabel(card: Card): string {
  return `${faces[card.rank] ?? card.rank}${symbols[card.suit]}`;
}
