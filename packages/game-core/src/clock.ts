import type { ClockRules, TurnClock, TurnInfo } from './types';

/**
 * The host's turn clock after an action (A4, Claude Opus; one-off addition to @kahve/core).
 * Kept by whoever runs the game (server Room or offline hook), never by the rules.
 *  - nobody to move (`turn` null) or `baseMs` 0: no clock
 *  - a new turn (`turn.key` changed) starts a fresh clock: baseMs, x firstTurnFactor on the round's first turn
 *  - `refills` (the game's `refillsClock(action)`) restarts the running clock once per turn
 * For okey this equals `nextClock` in @okey/shared/clock.ts (proved in packages/catalog/test/clock-equivalence.test.ts).
 */
export function nextTurnClock(
  prev: TurnClock | null,
  turn: TurnInfo | null,
  refills: boolean,
  now: number,
  rules: ClockRules,
): TurnClock | null {
  if (!turn || rules.baseMs <= 0) return null;
  const budget = turn.first ? rules.baseMs * rules.firstTurnFactor : rules.baseMs;
  if (!prev || prev.turnNumber !== turn.key) return { turnNumber: turn.key, deadline: now + budget, refilled: false };
  if (refills && !prev.refilled) return { ...prev, deadline: now + budget, refilled: true };
  return prev;
}
