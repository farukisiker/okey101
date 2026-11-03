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

  it('plays düz okey: 15/14 tiles, points lost; a new game once someone is out of points', () => {
    const room = new Room('R6', () => {}, { mode: 'duz', botDelayMs: 1, turnTimeoutMs: 1, rng: seededRng(8) });
    room.join('Ali', 's1');
    room.start();
    expect(room.info().mode).toBe('duz');
    expect(room.game!.players.map((p) => p.hand.length)).toEqual([15, 14, 14, 14]);
    vi.advanceTimersByTime(100_000);
    expect(room.game!.phase).toBe('finished');
    expect(room.totals).toEqual(room.game!.result!.scores);
    room.totals = [3, 20, 0, 6];
    expect(room.nextRound()).toBeNull();
    expect(room.totals).toEqual([0, 0, 0, 0]);
  });

  it('a host who leaves before the start passes the table on; a full table starts', () => {
    const room = new Room('R7', () => {}, { botDelayMs: 1, rng: seededRng(9) });
    room.join('A', 'a');
    room.join('B', 'b');
    room.leave('a');
    expect(room.hostSeat).toBe(1);
    expect(room.startIfFull()).toBe(false);
    room.join('C', 'c');
    room.join('D', 'd');
    room.join('E', 'e');
    expect(room.startIfFull()).toBe(true);
    expect(room.info().seats.every((s) => s && !s.isBot)).toBe(true);
  });

  it('leaving mid-game hands the seat to a bot for good', () => {
    const room = new Room('R8', () => {}, { botDelayMs: 1000, turnTimeoutMs: 0, rng: seededRng(9) });
    room.join('A', 'a');
    room.join('B', 'b');
    room.start();
    room.leave('b');
    const seat = room.info().seats[1]!;
    expect(seat.isBot).toBe(true);
    expect(seat.name).not.toBe('B');
    expect(room.game!.players[1].name).toBe(seat.name);
    expect(room.summary()).toMatchObject({ free: 3, started: true });
  });
});
