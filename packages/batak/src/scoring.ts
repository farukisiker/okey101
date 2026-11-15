import type { BatakOptions, BatakState } from './types';

/**
 * Declarer: made the contract -> +tricks, failed -> -contract (also with zero tricks, never doubled).
 * Others: +tricks; zero tricks -> -contract ('bid'), -5 ('fixed5') or 0 ('none').
 */
export function roundScores(tricksWon: readonly number[], declarer: number, contract: number, opts: Pick<BatakOptions, 'zeroTrickPenalty'>): number[] {
  return tricksWon.map((won, seat) => {
    if (seat === declarer) return won >= contract ? won : -contract;
    if (won > 0) return won;
    if (opts.zeroTrickPenalty === 'bid') return -contract;
    if (opts.zeroTrickPenalty === 'fixed5') return -5;
    return 0;
  });
}

/** Points of a finished round (only called when roundOver). */
export function scoreRound(state: BatakState): number[] {
  if (state.result) return state.result.scores.slice();
  if (state.declarer === null) return [0, 0, 0, 0];
  return roundScores(state.tricksWon, state.declarer, state.contract, state.options);
}

/**
 * Ends after `targetRounds` when one seat leads alone. A tie at the top plays one extra round;
 * if it is still tied after that, the match ends as a shared win.
 */
export function matchOver(totals: number[], rounds: number, opts: Pick<BatakOptions, 'targetRounds'>): boolean {
  if (rounds < opts.targetRounds) return false;
  if (rounds >= opts.targetRounds + 1) return true;
  const top = Math.max(...totals);
  return totals.filter(t => t === top).length === 1;
}
