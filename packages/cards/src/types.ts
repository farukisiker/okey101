export type Suit = 'S' | 'H' | 'D' | 'C';

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: number;
  suit: Suit;
  rank: Rank;
}

export type HandOrder = 'asc' | 'desc';

export interface DealResult {
  hands: Card[][];
  remaining: Card[];
}
