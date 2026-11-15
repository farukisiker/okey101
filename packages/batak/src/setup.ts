import { deal, shuffleDeck } from '@kahve/cards';
import type { Rng } from '@kahve/core';
import { normalizeOptions } from './options';
import type { BatakOptions, BatakState } from './types';

export const SEATS = 4;
export const HAND_SIZE = 13;

/** Deals a round. Dealer = (round + 3) % 4, so seat round % 4 speaks first (same as the okey starting seat). */
export function create(opts: BatakOptions, names: string[], rng: Rng, round: number): BatakState {
  const options = normalizeOptions(opts);
  const r = Number.isSafeInteger(round) && round >= 0 ? round : 0;
  const dealer = (r + 3) % SEATS;
  const { hands } = deal(shuffleDeck(rng), [HAND_SIZE, HAND_SIZE, HAND_SIZE, HAND_SIZE]);
  return {
    options,
    round: r,
    dealer,
    turn: (dealer + 1) % SEATS,
    turnNumber: 0,
    phase: 'bidding',
    players: hands.map((hand, seat) => ({ seat, name: String(names?.[seat] ?? `Oyuncu ${seat + 1}`), hand })),
    bids: [null, null, null, null],
    passed: [false, false, false, false],
    highestBid: 0,
    highestBidder: null,
    declarer: null,
    contract: 0,
    forcedBid: false,
    trump: null,
    trumpBroken: false,
    currentTrick: [],
    tricks: [],
    tricksWon: [0, 0, 0, 0],
    lastAction: null,
    result: null,
  };
}
