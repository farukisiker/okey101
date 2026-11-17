import { describe, expect, it } from 'vitest';
import { seededRng } from '@kahve/core';
import { tavlaDef, boardPips } from '../src';
import { rollDie, rollPair } from '../src/dice';
import { fresh, names } from './helpers';

describe('definition and options', () => {
  it('meta, options and clock follow the task sheet', () => {
    expect(tavlaDef).toMatchObject({ id: 'tavla', group: 'tavla', status: 'active', seatChoices: [2], titleKey: 'game.tavla' });
    expect(tavlaDef.seats(tavlaDef.defaultOptions)).toBe(2);
    expect(tavlaDef.defaultOptions).toEqual({ variant: 'klasik', targetScore: 5, koncinaPoints: 3 });
    expect(tavlaDef.clock).toEqual({ baseMs: 60000, firstTurnFactor: 1 });
    expect(tavlaDef.noticeOf).toBeUndefined();
    expect(tavlaDef.refillsClock({ type: 'commit' })).toBe(false);
  });

  it('normalizeOptions drops unknown keys, defaults bad values, forces klasik', () => {
    expect(tavlaDef.normalizeOptions({ variant: 'tapa', targetScore: 3, koncinaPoints: 2, extra: 1 })).toEqual({
      variant: 'klasik',
      targetScore: 3,
      koncinaPoints: 2,
    });
    expect(tavlaDef.normalizeOptions({ targetScore: 4, koncinaPoints: '3' })).toEqual(tavlaDef.defaultOptions);
    for (const raw of [null, undefined, 5, 'x', []]) expect(tavlaDef.normalizeOptions(raw)).toEqual(tavlaDef.defaultOptions);
  });
});

describe('create', () => {
  it('T01: classic starting layout, 15 checkers and 167 pips each', () => {
    const s = fresh(1);
    const p = s.board.points;
    expect([p[24], p[13], p[8], p[6]]).toEqual([2, 5, 3, 5]);
    expect([p[1], p[12], p[17], p[19]]).toEqual([-2, -5, -3, -5]);
    expect(p.filter(x => x !== 0)).toHaveLength(8);
    expect(p[0]).toBe(0);
    expect(p).toHaveLength(25);
    expect(s.board.bar).toEqual([0, 0]);
    expect(s.board.off).toEqual([0, 0]);
    expect(boardPips(s.board, 0)).toBe(167);
    expect(boardPips(s.board, 1)).toBe(167);
  });

  it('opening roll: one die each, never a tie, the higher die starts and plays both', () => {
    let starters = [0, 0];
    for (let seed = 0; seed < 200; seed++) {
      const s = fresh(seed);
      const [w, b] = s.openingRoll;
      expect(w).not.toBe(b);
      expect(s.dice).toEqual([w, b]);
      expect(s.remaining).toEqual([w, b]);
      expect(s.turn).toBe(w > b ? 0 : 1);
      expect(s.turnNumber).toBe(0);
      expect(s.phase).toBe('playing');
      expect(s.steps).toEqual([]);
      expect(s.lastTurn).toBeNull();
      expect(s.turnStart).toEqual(s.board);
      expect(tavlaDef.turn(s)).toEqual({ seat: s.turn, key: 0, first: true });
      starters[s.turn]++;
    }
    expect(Math.min(...starters)).toBeGreaterThan(60);
  });

  it('same seed gives the same game; the rng is used once; names and round are kept', () => {
    expect(fresh(42)).toEqual(fresh(42));
    let calls = 0;
    const base = seededRng(5);
    const s = tavlaDef.create(tavlaDef.defaultOptions, names, () => (calls++, base()), 3);
    expect(calls).toBe(1);
    expect(s.round).toBe(3);
    expect(s.players).toEqual([{ seat: 0, name: 'Ali' }, { seat: 1, name: 'Ayşe' }]);
    expect(Number.isInteger(s.rngState) && s.rngState >= 0 && s.rngState < 2 ** 32).toBe(true);
    const seen = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(fresh(i).openingRoll)));
    expect(seen.size).toBeGreaterThan(10);
  });

  it('dice come from the counter only: uniform 1..6 and repeatable', () => {
    const hist = [0, 0, 0, 0, 0, 0, 0];
    let st = 123;
    for (let i = 0; i < 60000; i++) {
      const [d, n] = rollDie(st);
      hist[d]++;
      st = n;
    }
    for (let d = 1; d <= 6; d++) expect(Math.abs(hist[d] - 10000)).toBeLessThan(500);
    expect(rollPair(99)).toEqual(rollPair(99));
  });

  it('renameSeat only changes the name', () => {
    const s = fresh(3);
    const r = tavlaDef.renameSeat!(s, 1, 'Bot');
    expect(r.players[1].name).toBe('Bot');
    expect({ ...r, players: s.players }).toEqual(s);
    expect(s.players[1].name).toBe('Ayşe');
  });
});
