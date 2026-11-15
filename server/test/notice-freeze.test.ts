// A7: a live penalty (GameNotice) freezes the turn clock and the bots for NOTICE_MS; 101 match end.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTICE_MS } from '@kahve/core';
import { analyzeMeld, type Color, type GameState, type Tile } from '@okey/shared';
import { Room } from '../src/room';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

let nextId = 30000;
const okeyTile = (g: GameState): Tile => ({ id: nextId++, kind: 'normal', color: g.okey.color, value: g.okey.value });
const tile = (color: Color, value: number): Tile => ({ id: nextId++, kind: 'normal', color, value });
const otherColor = (g: GameState): Color => (['red', 'yellow', 'blue', 'black'] as Color[]).find((c) => c !== g.okey.color)!;

/** Seat 0 (a human, the starter) throws the okey: an 'okeyDiscard' notice, turn passes to seat 1. */
function throwOkey(room: Room) {
  const g = room.game!;
  const o = okeyTile(g);
  g.players[0].hand[0] = o;
  expect(room.act(0, { type: 'discard', tileId: o.id })).toBeNull();
  expect(room.game!.notice).toMatchObject({ id: 1, seat: 0, reason: 'okeyDiscard' });
}

describe('notice freeze', () => {
  it('bots wait out the panel, then play on', () => {
    const room = new Room('F1', () => {}, { botDelayMs: 10, turnTimeoutMs: 10_000, seed: 11 });
    room.join('Ali', 's1');
    room.start();
    throwOkey(room);
    expect(room.viewFor(0)!.noticeMsLeft).toBe(NOTICE_MS);
    vi.advanceTimersByTime(NOTICE_MS - 1);
    expect(room.game!.turn).toBe(1);
    expect(room.game!.turnPhase).toBe('draw');
    vi.advanceTimersByTime(1);
    expect(room.game!.turnPhase).toBe('play'); // the bot drew
    expect(room.viewFor(0)!.noticeMsLeft).toBeUndefined();
    room.dispose();
  });

  it('the next player’s clock stays still during the panel and then runs with the full time', () => {
    const room = new Room('F2', () => {}, { botDelayMs: 10, turnTimeoutMs: 10_000, seed: 11 });
    room.join('Ali', 's1');
    room.join('Veli', 's2');
    room.start();
    throwOkey(room);
    expect(room.viewFor(1)).toMatchObject({ turnMsLeft: 10_000, noticeMsLeft: NOTICE_MS });
    vi.advanceTimersByTime(3000);
    expect(room.viewFor(1)).toMatchObject({ turnMsLeft: 10_000, noticeMsLeft: NOTICE_MS - 3000 });
    vi.advanceTimersByTime(NOTICE_MS - 3000);
    expect(room.viewFor(1)!.turnMsLeft).toBe(10_000);
    expect(room.viewFor(1)!.noticeMsLeft).toBeUndefined();
    vi.advanceTimersByTime(9_999);
    expect(room.game!.players[1].hand).toHaveLength(21); // still thinking
    vi.advanceTimersByTime(1); // out of time: quick move draws
    expect(room.game!.players[1].hand).toHaveLength(22);
    room.dispose();
  });

  it('a notice in the middle of a turn keeps the time the player had left', () => {
    const room = new Room('F3', () => {}, { botDelayMs: 10, turnTimeoutMs: 10_000, seed: 12 });
    room.join('Ali', 's1');
    room.join('Veli', 's2');
    room.start();
    room.act(0, { type: 'discard', tileId: room.game!.players[0].hand.find((x) => x.kind === 'fake' || x.color !== room.game!.okey.color || x.value !== room.game!.okey.value)!.id });
    vi.advanceTimersByTime(1000);
    expect(room.act(1, { type: 'draw', source: 'deck' })).toBeNull();
    // Rig: seat 1 has opened; seat 2 owns two runs with an okey in the middle; seat 1 holds the real tiles.
    const g = room.game!;
    const c = otherColor(g);
    const runA = [tile(c, 2), okeyTile(g), tile(c, 4)];
    const runB = [tile(c, 6), okeyTile(g), tile(c, 8)];
    const [three, seven] = [tile(c, 3), tile(c, 7)];
    g.players[1].opened = true;
    g.players[1].hand.push(three, seven);
    g.table = [runA, runB].map((tiles, i) => {
      const a = analyzeMeld(tiles, g.okey)!;
      return { id: 50 + i, owner: 2, type: a.type, points: a.points, tiles, ordered: a.ordered, represents: a.represents };
    });
    // First take: the first lay of the turn refills the clock (10 s), then the panel freezes it.
    expect(room.act(1, { type: 'addToMeld', meldId: 50, tileIds: [three.id] })).toBeNull();
    expect(room.game!.notice).toMatchObject({ id: 1, seat: 2, reason: 'okeyTaken', amount: 101 });
    expect(room.viewFor(1)!.turnMsLeft).toBe(10_000);
    vi.advanceTimersByTime(NOTICE_MS + 3000);
    expect(room.viewFor(1)!.turnMsLeft).toBe(7000);
    // Second take (no refill): the 7 s left stay 7 s during the panel, then count down again.
    expect(room.act(1, { type: 'addToMeld', meldId: 51, tileIds: [seven.id] })).toBeNull();
    expect(room.game!.notice).toMatchObject({ id: 2, seat: 2, reason: 'okeyTaken' });
    expect(room.viewFor(1)).toMatchObject({ turnMsLeft: 7000, noticeMsLeft: NOTICE_MS });
    vi.advanceTimersByTime(NOTICE_MS);
    expect(room.viewFor(1)!.turnMsLeft).toBe(7000);
    vi.advanceTimersByTime(6999);
    expect(room.game!.turn).toBe(1);
    vi.advanceTimersByTime(1); // out of time: the quick move throws
    expect(room.game!.turn).toBe(2);
    room.dispose();
  });

  it('a table without a clock does not freeze by default; noticeMs can still ask for it', () => {
    const plain = new Room('F4', () => {}, { botDelayMs: 10, turnTimeoutMs: 0, seed: 11 });
    plain.join('Ali', 's1');
    plain.start();
    throwOkey(plain);
    expect(plain.viewFor(0)!.noticeMsLeft).toBeUndefined();
    vi.advanceTimersByTime(10);
    expect(plain.game!.turnPhase).toBe('play');
    plain.dispose();

    const asked = new Room('F5', () => {}, { botDelayMs: 10, turnTimeoutMs: 0, noticeMs: 200, seed: 11 });
    asked.join('Ali', 's1');
    asked.start();
    throwOkey(asked);
    expect(asked.viewFor(0)!.turnMsLeft).toBeNull();
    vi.advanceTimersByTime(199);
    expect(asked.game!.turnPhase).toBe('draw');
    vi.advanceTimersByTime(1);
    expect(asked.game!.turnPhase).toBe('play');
    asked.dispose();
  });

  it('two penalties in one throw: both in the view, the freeze lasts 2 × NOTICE_MS', () => {
    const room = new Room('F7', () => {}, { botDelayMs: 10, turnTimeoutMs: 10_000, seed: 13 });
    room.join('Ali', 's1');
    room.join('Veli', 's2');
    room.start();
    // Rig: seat 1 (human) opened; seat 2's run is on the table; seat 0's last throw is a tile seat 1 takes and keeps.
    const g = room.game!;
    const c = otherColor(g);
    const run = [tile(c, 9), tile(c, 10), tile(c, 11)];
    const a = analyzeMeld(run, g.okey)!;
    g.table = [{ id: 60, owner: 2, type: a.type, points: a.points, tiles: run, ordered: a.ordered, represents: a.represents }];
    g.players[1].opened = true;
    const fits = tile(c, 12);
    g.players[1].hand[0] = fits;
    const taken = tile(c, 1);
    g.players[0].hand[0] = taken;
    expect(room.act(0, { type: 'discard', tileId: taken.id })).toBeNull();
    expect(room.act(1, { type: 'draw', source: 'discard' })).toBeNull();
    expect(room.act(1, { type: 'discard', tileId: fits.id })).toBeNull();
    const v = room.viewFor(1)!;
    expect(v.notices!.map((x) => x.reason)).toEqual(['sideTileUnused', 'islek']);
    expect(v.notice).toMatchObject({ id: 2, reason: 'islek' });
    expect(v.noticeMsLeft).toBe(2 * NOTICE_MS);
    expect(room.viewFor(2)!.turnMsLeft).toBe(10_000);
    vi.advanceTimersByTime(2 * NOTICE_MS - 1);
    expect(room.viewFor(2)).toMatchObject({ turnMsLeft: 10_000, noticeMsLeft: 1 });
    expect(room.game!.turnPhase).toBe('draw'); // seat 2 is a bot: still waiting
    vi.advanceTimersByTime(1);
    expect(room.game!.turnPhase).toBe('play');
    room.dispose();
  });

  it('the same notice id never freezes twice; a new deal starts clean', () => {
    const room = new Room('F6', () => {}, { botDelayMs: 10, turnTimeoutMs: 10_000, seed: 11 });
    room.join('Ali', 's1');
    room.start();
    throwOkey(room);
    vi.advanceTimersByTime(NOTICE_MS + 10); // the bot drew
    expect(room.noticeMsLeft()).toBe(0);
    vi.advanceTimersByTime(10); // the bot threw: no new notice, so no new panel
    expect(room.game!.turn).toBe(2);
    expect(room.noticeMsLeft()).toBe(0);
    room.dispose();
  });
});

describe('101 match end (Room.nextRound)', () => {
  const finish = (room: Room) => {
    room.game = { ...room.game!, phase: 'finished', result: { winner: null, okeyFinish: false, elden: false, pairs: false, cancelled: false, multiplier: 1, scores: [0, 0, 0, 0] } };
  };

  it('default: five hands, then the totals start over and five more', () => {
    const room = new Room('M1', () => {}, { botDelayMs: 10, turnTimeoutMs: 0, seed: 3 });
    room.join('Ali', 's1');
    room.start();
    for (let hand = 1; hand <= 10; hand++) {
      finish(room);
      room.totals = [hand, 0, 0, 0];
      const over = hand === 5 || hand === 10;
      expect(room.info().matchOver).toBe(over);
      expect(room.nextRound()).toBeNull();
      expect(room.totals).toEqual(over ? [0, 0, 0, 0] : [hand, 0, 0, 0]);
      expect(room.info().matchOver).toBe(false); // a fresh round is not over
    }
    room.dispose();
  });

  it('hands 7 and 11', () => {
    for (const n of [7, 11]) {
      const room = new Room('M2', () => {}, { botDelayMs: 10, turnTimeoutMs: 0, seed: 3, options: { matchEnd: { kind: 'hands', n } } });
      room.join('Ali', 's1');
      room.start();
      for (let hand = 1; hand < n; hand++) {
        finish(room);
        expect(room.info().matchOver).toBe(false);
        room.nextRound();
      }
      finish(room);
      expect(room.info().matchOver).toBe(true);
      room.dispose();
    }
  });

  it('points 501 / 1001: over once someone reaches the limit', () => {
    for (const limit of [501, 1001]) {
      const room = new Room('M3', () => {}, { botDelayMs: 10, turnTimeoutMs: 0, seed: 3, options: { matchEnd: { kind: 'points', limit } } });
      room.join('Ali', 's1');
      room.start();
      finish(room);
      room.totals = [limit - 1, 0, 0, 0];
      expect(room.info().matchOver).toBe(false);
      room.nextRound();
      expect(room.totals).toEqual([limit - 1, 0, 0, 0]);
      finish(room);
      room.totals = [limit - 1, 0, limit, 0];
      expect(room.info().matchOver).toBe(true);
      room.nextRound();
      expect(room.totals).toEqual([0, 0, 0, 0]);
      room.dispose();
    }
  });

  it('none: the table never ends a match', () => {
    const room = new Room('M4', () => {}, { botDelayMs: 10, turnTimeoutMs: 0, seed: 3, options: { matchEnd: { kind: 'none' } } });
    room.join('Ali', 's1');
    room.start();
    for (let hand = 1; hand <= 12; hand++) {
      finish(room);
      room.totals = [5000, 0, 0, 0];
      expect(room.info().matchOver).toBe(false);
      room.nextRound();
      expect(room.totals).toEqual([5000, 0, 0, 0]);
    }
    room.dispose();
  });
});
