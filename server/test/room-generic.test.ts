import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seededRng, type GameState } from '@okey/shared';
import { Room, replay, type RoomOptions } from '../src/room';
import { stubDef, type StubAction, type StubState, type StubView } from './stub-game';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const noop = () => {};
const stubRoom = (opts: RoomOptions = {}) =>
  new Room<StubState, StubAction, StubView>('S', noop, { definition: stubDef, botDelayMs: 10, seed: 7, ...opts });

describe('generic room', () => {
  it('`game` wins over the legacy mode', () => {
    const room = new Room('G1', noop, { game: 'okeyDuz', mode: '101', botDelayMs: 10, rng: seededRng(3) });
    expect(room.mode).toBe('duz');
    expect(room.info()).toMatchObject({ mode: 'duz', game: 'okeyDuz' });
    room.join('Ali', 's1');
    room.start();
    expect(room.game!.players.map((p) => p.hand.length)).toEqual([15, 14, 14, 14]);
    expect(room.summary().game).toBe('okeyDuz');
  });

  it('no mode and no game is okey 101, as before', () => {
    const room = new Room('G2', noop, { rng: seededRng(1) });
    expect(room.info()).toMatchObject({ mode: '101', game: 'okey101' });
  });

  it('refuses a game without a playable definition ("Yakında")', () => {
    expect(() => new Room('G3', noop, { game: 'king' })).toThrow(/king/);
  });

  it('seats, totals and bots come from the definition (2-seat stub)', () => {
    const room = stubRoom({ turnTimeoutMs: 0 });
    expect(room.seats).toHaveLength(2);
    expect(room.totals).toEqual([0, 0]);
    expect(room.mode).toBe('101'); // harmless placeholder for non-okey tables
    expect(room.info().game).toBe('pisti');
    room.join('Ali', 's1');
    room.start();
    expect(room.seats[1]!.isBot).toBe(true);
    expect(room.game!.names).toEqual(['Ali', room.seats[1]!.name]);
    expect(room.act(1, { type: 'add', n: 1 })).toBe('Sıra sizde değil');
    // Ali moves, the bot answers by itself.
    let guard = 0;
    while (!stubDef.roundOver(room.game!)) {
      if (++guard > 100) throw new Error('stub round did not end');
      if (room.game!.turn === 0) expect(room.act(0, { type: 'add', n: 2 })).toBeNull();
      else vi.advanceTimersByTime(10);
    }
    expect(room.totals.reduce((a, b) => a + b, 0)).toBe(1);
    expect(room.nextRound()).toBeNull();
    expect(room.game!.turn).toBe(1); // round 1 starts at seat 1
  });

  it('a new match resets the totals once matchOver says so', () => {
    const room = stubRoom({ turnTimeoutMs: 0, options: { target: 1 } });
    room.join('Ali', 's1');
    room.start();
    let resets = 0;
    for (let r = 0; r < 6; r++) {
      if (room.game!.turn === 0) room.act(0, { type: 'add', n: 1 });
      else vi.advanceTimersByTime(10);
      expect(stubDef.roundOver(room.game!)).toBe(true);
      const before = room.totals.slice();
      expect(room.nextRound()).toBeNull();
      expect(room.nextRound()).toBe('Tur bitmedi');
      if (before.some((t) => t >= 2)) {
        expect(room.totals).toEqual([0, 0]);
        resets++;
      } else expect(room.totals).toEqual(before);
    }
    expect(resets).toBeGreaterThan(0);
  });

  it('generic clock: game base time x first-turn factor, then base; quick move on timeout', () => {
    const room = stubRoom({ options: { target: 100 } });
    room.join('Ali', 's1');
    room.start(); // seat 0 (Ali) moves first
    const t0 = Date.now();
    expect(room.viewFor(0)!.clock).toEqual({ turnNumber: 0, deadline: t0 + 15_000, refilled: false });
    vi.advanceTimersByTime(14_999);
    expect(room.game!.moves).toBe(0);
    vi.advanceTimersByTime(1); // timed out: the game's quick move (+1)
    expect(room.game!.moves).toBe(1);
    expect(room.actionLog().at(-1)).toEqual({ t: 'act', seat: 0, action: { type: 'add', n: 1 } });
    vi.advanceTimersByTime(10); // the bot (seat 1) answers after the bot delay
    expect(room.game!.turn).toBe(0);
    expect(room.viewFor(0)!.clock).toEqual({ turnNumber: 2, deadline: Date.now() + 5000, refilled: false });
  });

  it('refillsClock refills the running clock once per turn', () => {
    const room = stubRoom({ options: { target: 100 }, turnTimeoutMs: 1000 });
    room.join('Ali', 's1');
    room.start();
    expect(room.viewFor(0)!.clock!.deadline - Date.now()).toBe(3000); // first turn: 3 x 1000
    vi.advanceTimersByTime(2000);
    room.act(0, { type: 'think' });
    expect(room.viewFor(0)!.clock).toMatchObject({ turnNumber: 0, refilled: true, deadline: Date.now() + 3000 });
    vi.advanceTimersByTime(2000);
    room.act(0, { type: 'think' }); // second refill in the same turn: ignored
    expect(room.viewFor(0)!.clock!.deadline - Date.now()).toBe(1000);
    vi.advanceTimersByTime(1000); // runs out: quick move
    expect(room.game!.moves).toBe(1);
  });

  it('turnTimeoutMs 0 disables the clock for any game', () => {
    const room = stubRoom({ turnTimeoutMs: 0 });
    room.join('Ali', 's1');
    room.start();
    expect(room.viewFor(0)!.clock).toBeNull();
    vi.advanceTimersByTime(1_000_000);
    expect(room.game!.moves).toBe(0);
  });
});

describe('seed, action log and replay', () => {
  /** An okey hand with joins, a leave and a seat change, then a few moves of the next hand. */
  function playSeeded(seed: number) {
    const room = new Room('P', noop, { seed, botDelayMs: 1, turnTimeoutMs: 1 });
    room.join('Ali', 's1');
    room.join('Bora', 's2');
    room.start();
    vi.advanceTimersByTime(40);
    room.leave('s2'); // a bot takes seat 1 for good (rename)
    room.join('Cem', 's3'); // Cem takes a bot seat (rename)
    let guard = 0;
    while (room.game!.phase !== 'finished') {
      vi.advanceTimersByTime(50);
      if (++guard > 10_000) throw new Error('hand did not finish');
    }
    expect(room.nextRound()).toBeNull();
    vi.advanceTimersByTime(20);
    return room;
  }

  it('replay(seed, log) rebuilds exactly the same state', () => {
    const room = playSeeded(424242);
    const log = room.actionLog();
    expect(log.filter((e) => e.t === 'deal')).toHaveLength(2);
    expect(log.filter((e) => e.t === 'rename').length).toBeGreaterThanOrEqual(2);
    expect(log.filter((e) => e.t === 'act').length).toBeGreaterThan(20);
    room.dispose();
    const rebuilt = replay(room.def, room.options, room.seed!, log);
    expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(room.game));
  });

  it('the same seed and the same events give the same game (bot moves are seeded too)', () => {
    // Bot names come from Math.random (not part of the game): compare everything else.
    const strip = (g: GameState) => JSON.stringify({ ...g, players: g.players.map(({ name: _n, ...p }) => p) });
    const a = playSeeded(99);
    a.dispose(); // stop its timers so it doesn't keep playing while b runs
    const snapA = { game: strip(a.game!), totals: [...a.totals], acts: a.actionLog().length };
    const b = playSeeded(99);
    b.dispose();
    expect({ game: strip(b.game!), totals: b.totals, acts: b.actionLog().length }).toEqual(snapA);
  });

  it('bot names do not draw from the deal rng on the seed path', () => {
    const one = new Room('N1', noop, { seed: 5, botDelayMs: 1000 });
    one.join('Ali', 's1');
    one.start();
    const three = new Room('N3', noop, { seed: 5, botDelayMs: 1000 });
    ['Ali', 'Bora', 'Cem'].forEach((n, i) => three.join(n, `s${i}`));
    three.start();
    expect(three.game!.players.map((p) => p.hand)).toEqual(one.game!.players.map((p) => p.hand));
    expect(three.game!.indicator).toEqual(one.game!.indicator);
  });

  it('a legacy rng table has no seed; the log and seed never reach info, summary or views', () => {
    expect(new Room('L', noop, { rng: seededRng(1) }).seed).toBeNull();
    const room = new Room('V', noop, { seed: 31337, botDelayMs: 1000 });
    room.join('Ali', 's1');
    room.start();
    for (const payload of [room.info(), room.summary(), room.viewFor(0)]) {
      expect(JSON.stringify(payload)).not.toContain('31337');
      expect(payload).not.toHaveProperty('log');
      expect(payload).not.toHaveProperty('seed');
    }
  });

  it('a stub game replays too', () => {
    const room = stubRoom({ seed: 11, options: { seats: 4, target: 30 }, turnTimeoutMs: 1 });
    room.join('Ali', 's1');
    room.start();
    vi.advanceTimersByTime(5000);
    expect(stubDef.roundOver(room.game!)).toBe(true);
    expect(replay(room.def, room.options, 11, room.actionLog())).toEqual(room.game);
  });
});
