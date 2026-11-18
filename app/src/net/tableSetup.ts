// B5 (Claude Opus): the card lobby's remembered table setup (seats, partners). Plain data, no UI.
import type { GameId } from '@kahve/core';

/** What the player picked last time for this game (seats, partners), remembered on the device. */
export interface TableSetup {
  seats: number;
  partners: boolean;
  /** Tavla: points that win the match (1, 3, 5 or 7); the one who sets up the table picks it. */
  matchPoints: number;
}

export const MATCH_POINT_CHOICES = [1, 3, 5, 7] as const;
const DEFAULT_MATCH_POINTS = 5;

export const setupKey = (id: GameId) => `kahve.setup.${id}`;

/** Seat choice falls back to the game's first choice; partners only with four seats (pişti eşli). Default: solo. */
export function normalizeSetup(raw: unknown, seatChoices: readonly number[]): TableSetup {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const seats = typeof r.seats === 'number' && seatChoices.includes(r.seats) ? r.seats : (seatChoices[0] ?? 2);
  const matchPoints = MATCH_POINT_CHOICES.includes(r.matchPoints as 1) ? (r.matchPoints as number) : DEFAULT_MATCH_POINTS;
  return { seats, partners: seats === 4 && r.partners === true, matchPoints };
}

/** House rules sent to the game (normalizeOptions drops what a game doesn't know). */
export const setupOptions = (s: TableSetup, game?: GameId) =>
  game === 'tavla' ? { targetScore: s.matchPoints } : { seats: s.seats, partnerMode: s.partners };
