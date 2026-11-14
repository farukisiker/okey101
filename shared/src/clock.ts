import type { Action, GameState } from './game';

/** Seconds a player has for one turn; the very first turn of a hand gets double. */
export const TURN_MS = 30_000;

/** The turn clock is kept by whoever runs the game (server room or offline hook), not by the rules. */
export interface TurnClock {
  turnNumber: number;
  /** Epoch ms when the player runs out of time. */
  deadline: number;
  /** Opening or laying tiles refills the clock, once per turn. */
  refilled: boolean;
}

export function turnBudgetMs(state: Pick<GameState, 'turnNumber'>, base = TURN_MS): number {
  return state.turnNumber === 0 ? base * 2 : base;
}

/**
 * The clock after `action` brought the game to `state`: a new turn starts a
 * fresh clock; the first open/meld/add of a turn refills it (later ones don't).
 */
export function nextClock(
  prev: TurnClock | null,
  state: GameState,
  action: Action | null,
  now: number,
  base = TURN_MS,
): TurnClock | null {
  if (state.phase !== 'playing') return null;
  const budget = turnBudgetMs(state, base);
  if (!prev || prev.turnNumber !== state.turnNumber) return { turnNumber: state.turnNumber, deadline: now + budget, refilled: false };
  const lays = action?.type === 'open' || action?.type === 'meld' || action?.type === 'addToMeld';
  if (lays && !prev.refilled) return { ...prev, deadline: now + budget, refilled: true };
  return prev;
}
