import { type BatakView, type Card, type PistiView, createDeck, makeCard } from '../../components/cards';

// Pre-generated deck
const DECK = createDeck();

// ---- Pişti Mock States ----

export const mockPisti2PlayerInitial: PistiView = {
  phase: 'playing',
  seat: 0,
  turn: 0,
  seats: 2,
  partnerMode: false,
  targetScore: 101,
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
    {
      seat: 0,
      name: 'Sen',
      handCount: 4,
      capturedCount: 0,
      pistiCount: 0,
      totalScore: 0,
      connected: true,
      isBot: false,
    },
    {
      seat: 1,
      name: 'Ahmet (Bot)',
      handCount: 4,
      capturedCount: 0,
      pistiCount: 0,
      totalScore: 0,
      connected: true,
      isBot: true,
    },
  ],
  lastCapture: null,
  turnMsLeft: 25000,
  result: null,
};

export const mockPistiOpportunity: PistiView = {
  ...mockPisti2PlayerInitial,
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

export const mockPistiCelebration: PistiView = {
  ...mockPisti2PlayerInitial,
  centerCount: 0,
  topCard: null,
  hand: [
    makeCard('S', 14, 12),
    makeCard('D', 9, 33),
  ],
  playableCardIds: [12, 33],
  lastCapture: {
    seat: 0,
    card: makeCard('H', 7, 18),
    isPisti: true,
    isJackPisti: false,
    pointsEarned: 10,
    capturedCount: 2,
  },
  players: [
    {
      seat: 0,
      name: 'Sen',
      handCount: 2,
      capturedCount: 12,
      pistiCount: 1,
      totalScore: 10,
      connected: true,
    },
    {
      seat: 1,
      name: 'Ahmet (Bot)',
      handCount: 2,
      capturedCount: 6,
      pistiCount: 0,
      totalScore: 0,
      connected: true,
      isBot: true,
    },
  ],
};

export const mockPistiFinished: PistiView = {
  ...mockPisti2PlayerInitial,
  phase: 'finished',
  centerCount: 0,
  topCard: null,
  hand: [],
  playableCardIds: [],
  result: {
    matchOver: false,
    winnerSeats: [0],
    scores: [26, 12],
    totals: [26, 12],
    breakdown: [
      { seat: 0, cardsCount: 28, pistiPoints: 10, cardPoints: 13, majorityBonus: 3 },
      { seat: 1, cardsCount: 24, pistiPoints: 0, cardPoints: 12, majorityBonus: 0 },
    ],
  },
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

export const mockBatakBiddingMyTurn: BatakView = {
  phase: 'bidding',
  variant: 'ihaleli',
  seat: 0,
  turn: 0,
  hand: batakHand,
  legalCardIds: batakHand.map((c) => c.id),
  players: [
    { seat: 0, name: 'Sen', handCount: 13, tricksWon: 0, bid: null, passed: false, totalScore: 0, connected: true },
    { seat: 1, name: 'Kemal', handCount: 13, tricksWon: 0, bid: 5, passed: false, totalScore: 0, connected: true },
    { seat: 2, name: 'Ayşe', handCount: 13, tricksWon: 0, bid: 0, passed: true, totalScore: 0, connected: true },
    { seat: 3, name: 'Fatma', handCount: 13, tricksWon: 0, bid: 0, passed: true, totalScore: 0, connected: true },
  ],
  minBid: 5,
  highestBid: 5,
  highestBidder: 1,
  canPass: true,
  trump: null,
  trumpBroken: false,
  currentTrick: [],
  lastTrickWinner: null,
  round: 1,
  targetRounds: 5,
  turnMsLeft: 28000,
  result: null,
};

export const mockBatakTrumpSelection: BatakView = {
  ...mockBatakBiddingMyTurn,
  phase: 'selectingTrump',
  highestBid: 7,
  highestBidder: 0,
  players: [
    { seat: 0, name: 'Sen', handCount: 13, tricksWon: 0, bid: 7, passed: false, totalScore: 0, connected: true },
    { seat: 1, name: 'Kemal', handCount: 13, tricksWon: 0, bid: 5, passed: true, totalScore: 0, connected: true },
    { seat: 2, name: 'Ayşe', handCount: 13, tricksWon: 0, bid: 0, passed: true, totalScore: 0, connected: true },
    { seat: 3, name: 'Fatma', handCount: 13, tricksWon: 0, bid: 0, passed: true, totalScore: 0, connected: true },
  ],
};

export const mockBatakPlayingMyTurn: BatakView = {
  ...mockBatakBiddingMyTurn,
  phase: 'playing',
  trump: 'S',
  highestBid: 7,
  highestBidder: 0,
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

export const mockBatakFinished: BatakView = {
  ...mockBatakBiddingMyTurn,
  phase: 'finished',
  trump: 'S',
  highestBid: 7,
  highestBidder: 0,
  hand: [],
  legalCardIds: [],
  currentTrick: [],
  result: {
    matchOver: false,
    winnerSeats: [0],
    declarerSeat: 0,
    contractBid: 7,
    declarerSucceeded: true,
    scores: [7, 2, 1, 3],
    totals: [7, 2, 1, 3],
  },
};
