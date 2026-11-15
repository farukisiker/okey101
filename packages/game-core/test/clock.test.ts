import { describe, expect, it } from 'vitest';
import { nextTurnClock, type ClockRules, type TurnInfo } from '../src/index';

const RULES: ClockRules = { baseMs: 30_000, firstTurnFactor: 2 };
const turn = (key: number, seat = key % 4): TurnInfo => ({ seat, key, first: key === 0 });

describe('nextTurnClock', () => {
  it('has no clock when nobody moves or the base time is 0', () => {
    expect(nextTurnClock(null, null, false, 1000, RULES)).toBeNull();
    const prev = { turnNumber: 3, deadline: 5000, refilled: false };
    expect(nextTurnClock(prev, null, true, 1000, RULES)).toBeNull();
    expect(nextTurnClock(null, turn(1), false, 1000, { ...RULES, baseMs: 0 })).toBeNull();
  });

  it('starts the first turn with firstTurnFactor x base, later turns with base', () => {
    expect(nextTurnClock(null, turn(0), false, 1000, RULES)).toEqual({ turnNumber: 0, deadline: 61_000, refilled: false });
    expect(nextTurnClock(null, turn(1), false, 1000, RULES)).toEqual({ turnNumber: 1, deadline: 31_000, refilled: false });
    expect(nextTurnClock(null, turn(0), false, 0, { baseMs: 10, firstTurnFactor: 3 })!.deadline).toBe(30);
  });

  it('starts a fresh clock when the turn key changes, even if the old one was refilled', () => {
    const prev = { turnNumber: 1, deadline: 31_000, refilled: true };
    expect(nextTurnClock(prev, turn(2), true, 40_000, RULES)).toEqual({ turnNumber: 2, deadline: 70_000, refilled: false });
  });

  it('keeps the running clock (same object) for a non-refilling action', () => {
    const prev = { turnNumber: 2, deadline: 70_000, refilled: false };
    expect(nextTurnClock(prev, turn(2), false, 50_000, RULES)).toBe(prev);
  });

  it('refills once per turn, then ignores further refills', () => {
    const prev = { turnNumber: 2, deadline: 70_000, refilled: false };
    const once = nextTurnClock(prev, turn(2), true, 50_000, RULES)!;
    expect(once).toEqual({ turnNumber: 2, deadline: 80_000, refilled: true });
    expect(prev.refilled).toBe(false); // input not mutated
    expect(nextTurnClock(once, turn(2), true, 60_000, RULES)).toBe(once);
  });

  it('refills a first turn with the doubled budget', () => {
    const prev = { turnNumber: 0, deadline: 60_000, refilled: false };
    expect(nextTurnClock(prev, turn(0), true, 10_000, RULES)).toEqual({ turnNumber: 0, deadline: 70_000, refilled: true });
  });
});
