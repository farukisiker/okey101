import type { Card } from '@kahve/cards';
import type { TurnClock } from '@kahve/core';
export type PistiOptions = {
    seats: 2 | 4;
    partnerMode: boolean;
    targetScore: 51 | 101 | 151;
    hiddenCards: 'reveal' | 'secret';
    openingJack: 'redraw' | 'allow';
    pistiPoints: number;
    jackPistiPoints: number;
    acePoints: number;
    jackPoints: number;
    clubTwoPoints: number;
    diamondTenPoints: number;
    mostCardsPoints: number;
};
export type PistiAction = {
    type: 'play';
    cardId: number;
};
export type Capture = {
    seat: number;
    cardId: number;
    isPisti: boolean;
    isJackPisti: boolean;
    points: number;
};
export type PublicAction = {
    turnNumber: number;
    seat: number;
    card: Card;
    revealedCards: Card[];
};
export type PistiState = {
    options: PistiOptions;
    round: number;
    dealer: number;
    turn: number;
    turnNumber: number;
    phase: 'playing' | 'finished';
    players: {
        seat: number;
        name: string;
        hand: Card[];
    }[];
    deck: Card[];
    centerPile: Card[];
    hiddenOpeningCardIds: number[];
    captured: Card[][];
    pistis: {
        cardId: number;
        isJack: boolean;
    }[][];
    lastCapturer: number | null;
    /** Initially face-up card, retained after it is covered or captured. */
    openingCard?: Card;
    publicHistory: PublicAction[];
    lastAction: PublicAction | null;
    lastCapture: Capture | null;
    result: {
        scores: number[];
    } | null;
};
export type PistiView = {
    options: PistiOptions;
    round: number;
    dealer: number;
    seat: number;
    turn: number | null;
    turnNumber: number;
    phase: 'playing' | 'finished';
    hand: Card[];
    topCard: Card | null;
    centerCount: number;
    deckCount: number;
    playableCardIds: number[];
    players: {
        seat: number;
        name: string;
        team: number;
        handCount: number;
        capturedCount: number;
        pistiCount: number;
    }[];
    /** Initially face-up card, retained after it is covered or captured. */
    openingCard?: Card;
    publicHistory: PublicAction[];
    lastAction: PublicAction | null;
    lastCapture: Capture | null;
    result: {
        scores: number[];
    } | null;
    clock: TurnClock | null;
};
