import type { BatakView, PistiView } from '@kahve/catalog';
import { type Card, createDeck, makeCard } from '../../components/cards';

// Pre-generated deck
const DECK = createDeck();

// ---- Pişti Mock States (the engine's PistiView, B5) ----

const pistiOptions: PistiView['options'] = {
  seats: 2,
  partnerMode: false,
  targetScore: 101,
  hiddenCards: 'reveal',
  openingJack: 'redraw',
  pistiPoints: 10,
  jackPistiPoints: 20,
  acePoints: 1,
  jackPoints: 1,
  clubTwoPoints: 2,
  diamondTenPoints: 3,
  mostCardsPoints: 3,
};

type PreviewPistiView = PistiView & { turnMsLeft?: number | null };

export const mockPisti2PlayerInitial: PreviewPistiView = {
  options: pistiOptions,
  round: 0,
  dealer: 1,
  phase: 'playing',
  seat: 0,
  turn: 0,
  turnNumber: 0,
  hand: [
    makeCard('S', 10, 8),
    makeCard('D', 11, 22), // Jack
    makeCard('C', 7, 44),
    makeCard('H', 3, 14),
  ],
  deckCount: 40,
  centerCount: 4,
  topCard: makeCard('H', 10, 21),
  playableCardIds: [8, 22, 44, 14],
  players: [
    { seat: 0, name: 'Sen', team: 0, handCount: 4, capturedCount: 0, pistiCount: 0 },
    { seat: 1, name: 'Ahmet (Bot)', team: 1, handCount: 4, capturedCount: 0, pistiCount: 0 },
  ],
  publicHistory: [],
  lastAction: null,
  lastCapture: null,
  result: null,
  clock: null,
  turnMsLeft: 25000,
};

export const mockPistiOpportunity: PreviewPistiView = {
  ...mockPisti2PlayerInitial,
  turnNumber: 1,
  centerCount: 1,
  topCard: makeCard('S', 7, 5),
  hand: [
    makeCard('H', 7, 18), // Match -> Pişti chance!
    makeCard('C', 14, 51),
    makeCard('D', 4, 28),
  ],
  playableCardIds: [18, 51, 28],
  turnMsLeft: 18000,
};

const pistiPlay = { turnNumber: 2, seat: 0, card: makeCard('H', 7, 18), revealedCards: [] };

export const mockPistiCelebration: PreviewPistiView = {
  ...mockPisti2PlayerInitial,
  turnNumber: 3,
  centerCount: 0,
  topCard: null,
  hand: [makeCard('S', 14, 12), makeCard('D', 9, 33)],
  playableCardIds: [12, 33],
  lastAction: pistiPlay,
  publicHistory: [pistiPlay],
  lastCapture: { seat: 0, cardId: 18, isPisti: true, isJackPisti: false, points: 10 },
  players: [
    { seat: 0, name: 'Sen', team: 0, handCount: 2, capturedCount: 12, pistiCount: 1 },
    { seat: 1, name: 'Ahmet (Bot)', team: 1, handCount: 2, capturedCount: 6, pistiCount: 0 },
  ],
};

export const mockPistiFinished: PreviewPistiView = {
  ...mockPisti2PlayerInitial,
  phase: 'finished',
  turn: null,
  centerCount: 0,
  topCard: null,
  hand: [],
  playableCardIds: [],
  turnMsLeft: null,
  result: { scores: [26, 12] },
};

// ---- Batak Mock States ----

const batakHand: Card[] = [
  makeCard('S', 14, 12), // Spades Ace
  makeCard('S', 13, 11), // Spades King
  makeCard('S', 8, 6),
  makeCard('H', 14, 25), // Hearts Ace
  makeCard('H', 10, 21),
  makeCard('H', 6, 17),
  makeCard('D', 13, 37), // Diamonds King
  makeCard('D', 12, 36), // Diamonds Queen
  makeCard('D', 7, 31),
  makeCard('D', 2, 26),
  makeCard('C', 11, 48), // Clubs Jack
  makeCard('C', 9, 46),
  makeCard('C', 5, 42),
];

const batakOptions: BatakView['options'] = {
  variant: 'ihaleli',
  targetRounds: 5,
  minBid: 5,
  forcedDealerBid: 4,
  voidTrump: 'always',
  mustRaise: true,
  trumpLeadNeedsBreak: true,
  zeroTrickPenalty: 'bid',
  kozMacaOvertrickLimit: 0,
  partnerDummy: false,
};

type PreviewBatakView = BatakView & { turnMsLeft?: number | null };

const batakPlayer = (seat: number, name: string, bid: number | null, passed: boolean, isDeclarer = false, tricksWon = 0) => ({
  seat,
  name,
  handCount: 13,
  tricksWon,
  bid,
  passed,
  isDeclarer,
});

export const mockBatakBiddingMyTurn: PreviewBatakView = {
  options: batakOptions,
  variant: 'ihaleli',
  round: 1,
  targetRounds: 5,
  dealer: 3,
  seat: 0,
  turn: 0,
  turnNumber: 3,
  phase: 'bidding',
  hand: batakHand,
  legalCardIds: [],
  players: [batakPlayer(0, 'Sen', null, false), batakPlayer(1, 'Kemal', 5, false), batakPlayer(2, 'Ayşe', 0, true), batakPlayer(3, 'Fatma', 0, true)],
  minBid: 5,
  highestBid: 5,
  highestBidder: 1,
  canPass: true,
  declarer: null,
  contract: 0,
  forcedBid: false,
  trump: null,
  trumpBroken: false,
  currentTrick: [],
  lastTrick: null,
  lastTrickWinner: null,
  tricks: [],
  lastAction: null,
  result: null,
  turnMsLeft: 28000,
};

export const mockBatakTrumpSelection: PreviewBatakView = {
  ...mockBatakBiddingMyTurn,
  phase: 'selectingTrump',
  highestBid: 7,
  highestBidder: 0,
  declarer: 0,
  contract: 7,
  players: [batakPlayer(0, 'Sen', 7, false, true), batakPlayer(1, 'Kemal', 5, true), batakPlayer(2, 'Ayşe', 0, true), batakPlayer(3, 'Fatma', 0, true)],
};

export const mockBatakPlayingMyTurn: PreviewBatakView = {
  ...mockBatakTrumpSelection,
  phase: 'playing',
  trump: 'S',
  trumpBroken: true,
  // Lead card was Hearts Queen played by Kemal (seat 1)
  currentTrick: [
    { seat: 1, card: makeCard('H', 12, 23) },
    { seat: 2, card: makeCard('H', 8, 19) },
    { seat: 3, card: makeCard('H', 14, 25) },
  ],
  // Hand must follow Hearts because player has Hearts!
  legalCardIds: [21, 17], // H 10, H 6
  turnMsLeft: 22000,
};

export const mockBatakFinished: PreviewBatakView = {
  ...mockBatakTrumpSelection,
  phase: 'finished',
  turn: null,
  trump: 'S',
  hand: [],
  legalCardIds: [],
  currentTrick: [],
  players: [
    batakPlayer(0, 'Sen', 7, false, true, 7),
    batakPlayer(1, 'Kemal', 5, true, false, 2),
    batakPlayer(2, 'Ayşe', 0, true, false, 1),
    batakPlayer(3, 'Fatma', 0, true, false, 3),
  ],
  turnMsLeft: null,
  result: { scores: [7, 2, 1, 3] },
};
