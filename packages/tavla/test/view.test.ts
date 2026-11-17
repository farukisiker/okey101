import { describe, expect, it } from 'vitest';
import { tavlaDef } from '../src';
import { board, fresh, position } from './helpers';

const opening = (dice: [number, number]) =>
  position(board({ w: { 24: 2, 13: 5, 8: 3, 6: 5 }, b: { 1: 2, 12: 5, 17: 3, 19: 5 } }), 0, dice);

describe('viewFor', () => {
  it('never contains the dice generator (not as a key, not as a value)', () => {
    for (let seed = 0; seed < 20; seed++) {
      const s = fresh(seed);
      for (const seat of [0, 1, -1, 5]) {
        const v = tavlaDef.viewFor(s, seat);
        expect('rngState' in v).toBe(false);
        const text = JSON.stringify(v);
        expect(text).not.toContain('rngState');
        expect(text).not.toContain(String(s.rngState));
      }
    }
  });

  it('pips for both seats; hints only on the viewer turn; spectators get seat -1', () => {
    const s = opening([3, 1]);
    const mine = tavlaDef.viewFor(s, 0);
    const theirs = tavlaDef.viewFor(s, 1);
    const spect = tavlaDef.viewFor(s, 7);
    expect(mine.players.map(p => p.pips)).toEqual([167, 167]);
    expect(mine.seat).toBe(0);
    expect(mine.moves.length).toBeGreaterThan(0);
    expect(mine.canCommit).toBe(false);
    expect(mine.mustPass).toBe(false);
    expect(mine.canUndo).toBe(false);
    for (const v of [theirs, spect]) {
      expect(v.moves).toEqual([]);
      expect(v.canCommit).toBe(false);
      expect(v.mustPass).toBe(false);
      expect(v.canUndo).toBe(false);
    }
    expect(spect.seat).toBe(-1);
    expect(theirs.board).toEqual(mine.board);
    expect(mine.clock).toBeNull();
    const clock = { turnNumber: 10, deadline: 5, refilled: false };
    expect(tavlaDef.viewFor(s, 0, { clock, now: 0 }).clock).toEqual(clock);
  });

  it('moves: single steps first, then one checker over several dice, each (from,to) once with the shortest dice', () => {
    const s = opening([3, 1]);
    const moves = tavlaDef.viewFor(s, 0).moves;
    const singles = moves.filter(m => m.dice.length === 1);
    const firstMulti = moves.findIndex(m => m.dice.length > 1);
    expect(firstMulti).toBe(singles.length);
    expect(moves).toContainEqual({ from: 8, to: 5, dice: [3] });
    expect(moves).toContainEqual({ from: 6, to: 5, dice: [1] });
    expect(moves.find(m => m.from === 8 && m.to === 4)?.dice.length).toBe(2);
    expect(moves.find(m => m.from === 24 && m.to === 20)?.dice.length).toBe(2);
    const keys = moves.map(m => `${m.from}>${m.to}`);
    expect(new Set(keys).size).toBe(keys.length);
    // Every offered move can be played step by step.
    for (const m of moves) {
      let st = s;
      for (const die of m.dice) {
        const from = st === s ? m.from : (st.steps[st.steps.length - 1].to as number);
        const r = tavlaDef.apply(st, 0, { type: 'step', from, die });
        expect(r.ok).toBe(true);
        if (r.ok) st = r.state;
      }
      expect(st.steps[st.steps.length - 1].to).toBe(m.to);
    }
  });

  it('doubles: one checker can be offered up to four dice in a row', () => {
    const s = opening([2, 2]);
    const moves = tavlaDef.viewFor(s, 0).moves;
    expect(moves).toContainEqual({ from: 13, to: 5, dice: [2, 2, 2, 2] });
    expect(moves).toContainEqual({ from: 24, to: 18, dice: [2, 2, 2] });
  });

  it('canUndo after a step; canCommit once the turn is complete; a finished game shows no turn', () => {
    let s = opening([3, 1]);
    let r = tavlaDef.apply(s, 0, { type: 'step', from: 8, die: 3 });
    if (!r.ok) throw new Error(r.error);
    expect(tavlaDef.viewFor(r.state, 0).canUndo).toBe(true);
    r = tavlaDef.apply(r.state, 0, { type: 'step', from: 6, die: 1 });
    if (!r.ok) throw new Error(r.error);
    const v = tavlaDef.viewFor(r.state, 0);
    expect(v.canCommit).toBe(true);
    expect(v.moves).toEqual([]);
    const won = tavlaDef.apply(position(board({ w: { 1: 1 }, b: { 24: 15 } }), 0, [2, 1]), 0, { type: 'step', from: 1, die: 2 });
    if (!won.ok) throw new Error(won.error);
    const fv = tavlaDef.viewFor(won.state, 0);
    expect(fv.turn).toBeNull();
    expect(fv.phase).toBe('finished');
    expect(fv.result).toEqual({ winner: 0, kind: 'mars', points: 2 });
    expect(fv.moves).toEqual([]);
    s = won.state;
    expect(tavlaDef.viewFor(s, 1).lastTurn?.steps).toEqual([{ from: 1, to: 'off', die: 2, hit: false }]);
  });

  it('views are copies: changing one does not touch the state', () => {
    const s = opening([3, 1]);
    const snap = JSON.stringify(s);
    const v = tavlaDef.viewFor(s, 0);
    v.board.points[24] = 99;
    v.remaining.push(6);
    v.players[0].name = 'x';
    expect(JSON.stringify(s)).toBe(snap);
  });
});
