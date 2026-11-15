// B5 (Claude Opus): the card lobby's remembered table setup (seats, partners). Plain data, no UI.
import type { GameId } from '@kahve/core';

/** What the player picked last time for this game (seats, partners), remembered on the device. */
export interface TableSetup {
  seats: number;
  partners: boolean;
}

export const setupKey = (id: GameId) => `kahve.setup.${id}`;

/** Seat choice falls back to the game's first choice; partners only with four seats (pişti eşli). Default: solo. */
export function normalizeSetup(raw: unknown, seatChoices: readonly number[]): TableSetup {
  const r = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const seats = typeof r.seats === 'number' && seatChoices.includes(r.seats) ? r.seats : (seatChoices[0] ?? 2);
  return { seats, partners: seats === 4 && r.partners === true };
}

/** House rules sent to the game (normalizeOptions drops what a game doesn't know). */
export const setupOptions = (s: TableSetup) => ({ seats: s.seats, partnerMode: s.partners });
