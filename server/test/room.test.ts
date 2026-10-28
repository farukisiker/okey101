import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seededRng } from '@okey/shared';
import { Room } from '../src/room';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('room', () => {
  it('fills empty seats with bots on start', () => {
    const room = new Room('R1', () => {}, { botDelayMs: 10, rng: seededRng(1) });
    expect(room.join('Ali', 's1')).toBe(0);
    expect(room.join('Ayşe', 's2')).toBe(1);
    expect(room.start()).toBeNull();
    expect(room.info().seats.map((s) => s?.isBot)).toEqual([false, false, true, true]);
    expect(room.game!.players[0].hand).toHaveLength(22);
  });

  it('bots play their turns and stop at the human seat', () => {
    const room = new Room('R2', () => {}, { botDelayMs: 10, turnTimeoutMs: 0, rng: seededRng(4) });
    room.join('Ali', 's1');
    room.start(); // round 1: seat 0 (human) starts
    expect(room.game!.turn).toBe(0);
    const tile = room.game!.players[0].hand[0];
    expect(room.act(0, { type: 'discard', tileId: tile.id })).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(room.game!.turn).toBe(0);
    expect(room.game!.turnPhase).toBe('draw');
    expect(room.act(1, { type: 'draw', source: 'deck' })).toMatch(/Sıra/);
  });

  it('a human who times out gets an automatic draw + discard', () => {
    const room = new Room('R3', () => {}, { botDelayMs: 10, turnTimeoutMs: 1000, rng: seededRng(4) });
    room.join('Ali', 's1');
    room.start();
    vi.advanceTimersByTime(999);
    expect(room.game!.turn).toBe(0);
    vi.advanceTimersByTime(1);
    expect(room.game!.players[0].hand).toHaveLength(21);
    expect(room.game!.players[0].opened).toBe(false);
  });

  it('a disconnected human keeps the seat and can reconnect', () => {
    const room = new Room('R4', () => {}, { botDelayMs: 10, turnTimeoutMs: 0, rng: seededRng(4) });
    room.join('Ali', 's1');
    room.join('Veli', 's2');
    room.start();
    room.disconnect('s1');
    vi.advanceTimersByTime(50); // seat 0 autoplayed by bot
    expect(room.game!.turn).toBe(1);
    expect(room.join('Ali', 's9')).toBe(0);
    expect(room.seatOf('s9')).toBe(0);
  });

  it('accumulates totals and rotates the starter', () => {
    const room = new Room('R5', () => {}, { botDelayMs: 1, turnTimeoutMs: 1, rng: seededRng(7) });
    room.join('Ali', 's1');
    room.start();
    vi.advanceTimersByTime(100_000);
    expect(room.game!.phase).toBe('finished');
    const sum = room.game!.result!.scores;
    expect(room.totals).toEqual(sum);
    expect(room.nextRound()).toBeNull();
    expect(room.game!.startingSeat).toBe(1);
  });
});
