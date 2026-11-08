export interface AdHistory {
  totalHands: number;
  handsSinceAd: number;
  lastAdAtMs: number;
  shownAtMs: number[];
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function recentShows(shownAtMs: number[], now: number): number[] {
  return shownAtMs.filter((at) => Number.isFinite(at) && at > now - DAY_MS);
}

/** The first two result screens stay ad-free, including their leave buttons. */
export function eligibleForAd(history: AdHistory, now: number): boolean {
  return history.totalHands > 2 && history.handsSinceAd >= 2 &&
    now - history.lastAdAtMs >= 180_000 && recentShows(history.shownAtMs, now).length < 8;
}
