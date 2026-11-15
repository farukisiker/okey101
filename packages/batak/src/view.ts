import { sortHand } from '@kahve/cards';
import { clone } from './clone';
import { legalCardsFor } from './rules';
import type { BatakState, BatakView } from './types';

/**
 * What one seat may see: its own hand, public bidding/trick data and its legal card ids.
 * Never other hands, the deck or the rng. Finished tricks are public (played face up).
 */
export function viewFor(state: BatakState, seat: number): BatakView {
  const me = state.players[seat];
  const lastTrick = state.tricks.length > 0 ? state.tricks[state.tricks.length - 1] : null;
  return clone({
    options: state.options,
    variant: state.options.variant,
    round: state.round,
    targetRounds: state.options.targetRounds,
    dealer: state.dealer,
    seat,
    turn: state.phase === 'finished' ? null : state.turn,
    turnNumber: state.turnNumber,
    phase: state.phase,
    hand: me ? sortHand(me.hand, 'desc') : [],
    legalCardIds: legalCardsFor(state, seat).map(c => c.id),
    players: state.players.map(p => ({
      seat: p.seat,
      name: p.name,
      handCount: p.hand.length,
      tricksWon: state.tricksWon[p.seat],
      bid: state.bids[p.seat] ?? (state.passed[p.seat] ? 0 : null),
      passed: state.passed[p.seat],
      isDeclarer: state.declarer === p.seat,
    })),
    minBid: state.options.minBid,
    highestBid: state.highestBid,
    highestBidder: state.highestBidder,
    canPass: state.phase === 'bidding',
    declarer: state.declarer,
    contract: state.contract,
    forcedBid: state.forcedBid,
    trump: state.trump,
    trumpBroken: state.trumpBroken,
    currentTrick: state.currentTrick,
    lastTrick,
    lastTrickWinner: lastTrick ? lastTrick.winner : null,
    tricks: state.tricks,
    lastAction: state.lastAction,
    result: state.result,
  });
}
