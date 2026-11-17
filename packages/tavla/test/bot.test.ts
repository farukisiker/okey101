import { describe, expect, it } from 'vitest';
import { seededRng, type BotLevel } from '@kahve/core';
import { tavlaDef, evaluate } from '../src';
import { sequences, swap, toPos } from '../src/board';
import type { TavlaAction, TavlaState } from '../src/types';
import { board, position } from './helpers';

/** Spread, contact-heavy positions: the worst case for move generation (many points, blots both sides). */
const SPREAD = [
  board({ w: { 24: 1, 22: 1, 20: 1, 18: 1, 16: 1, 14: 1, 13: 1, 11: 1, 10: 1, 9: 1, 8: 1, 7: 1, 5: 1, 4: 1, 2: 1 }, b: { 1: 1, 3: 1, 6: 1, 12: 1, 15: 1, 17: 1, 19: 1, 21: 1, 23: 1 } }),
  board({ w: { 23: 1, 21: 2, 19: 1, 17: 1, 15: 2, 13: 1, 11: 2, 9: 1, 7: 2, 5: 1, 3: 1 }, b: { 2: 1, 4: 1, 6: 1, 8: 1, 10: 1, 12: 1, 14: 1, 16: 1, 18: 1, 20: 1, 22: 1, 24: 1 } }),
  board({ w: { 24: 2, 13: 5, 8: 3, 6: 5 }, b: { 1: 2, 12: 5, 17: 3, 19: 5 } }),
];

function timeIt(fn: () => void): number {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

/** Plays a whole bot turn and returns the actions (each must be legal). */
function botTurn(s: TavlaState, level: BotLevel, seed = 1): { state: TavlaState; actions: TavlaAction[]; maxMs: number } {
  const rng = seededRng(seed);
  const seat = s.turn;
  const actions: TavlaAction[] = [];
  let maxMs = 0;
  for (let i = 0; i < 6; i++) {
    let a: TavlaAction = { type: 'commit' };
    // Medium/hard ignore the rng, so repeating the call is safe; the fastest of three filters out GC and machine noise.
    const reps = level === 'easy' ? 1 : 3;
    let best = Infinity;
    for (let k = 0; k < reps; k++) best = Math.min(best, timeIt(() => (a = tavlaDef.botMove(s, seat, level, rng))));
    maxMs = Math.max(maxMs, best);
    actions.push(a);
    const r = tavlaDef.apply(s, seat, a);
    if (!r.ok) throw new Error(`${level} illegal ${JSON.stringify(a)}: ${r.error}`);
    s = r.state;
    if (a.type === 'commit' || s.phase === 'finished') break;
  }
  return { state: s, actions, maxMs };
}

describe('evaluation', () => {
  it('is antisymmetric', () => {
    for (const b of SPREAD) {
      const p = toPos(b, 0);
      expect(evaluate(swap(p))).toBeCloseTo(-evaluate(p), 9);
    }
  });
});

describe('bots', () => {
  it('medium and hard hit a blot when it is clearly good; easy stays legal', () => {
    // White 6 and 8 points made; a black blot on 5 can be hit with 8/5 6/5 (3-1) making the 5 point.
    const s = position(board({ w: { 24: 2, 13: 4, 8: 3, 6: 5, 3: 1 }, b: { 5: 1, 1: 1, 12: 5, 17: 3, 19: 5 } }), 0, [3, 1]);
    for (const level of ['medium', 'hard'] as const) {
      const { state } = botTurn(s, level);
      expect(state.board.bar[1]).toBe(1);
      expect(state.lastTurn?.steps.some(x => x.hit)).toBe(true);
    }
    expect(botTurn(s, 'easy').state.turn).toBe(1);
  });

  it('easy picks among sequences with the given rng (different seeds give different play)', () => {
    const s = position(SPREAD[2], 0, [6, 4]);
    const boards = new Set<string>();
    for (let seed = 0; seed < 20; seed++) boards.add(JSON.stringify(botTurn(s, 'easy', seed).state.board));
    expect(boards.size).toBeGreaterThan(3);
  });

  it('botMove continues the steps already played (a human step, then the bot finishes the turn)', () => {
    let s = position(SPREAD[2], 0, [6, 4]);
    const r = tavlaDef.apply(s, 0, { type: 'step', from: 13, die: 4 });
    if (!r.ok) throw new Error(r.error);
    s = r.state;
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const { state } = botTurn(s, level);
      expect(state.lastTurn?.steps[0]).toEqual({ from: 13, to: 9, die: 4, hit: false });
      expect(state.lastTurn?.steps).toHaveLength(2);
    }
  });

  it('pass position: bots and quickMove commit', () => {
    const s = position(board({ w: { 6: 14 }, barW: 1, b: { 19: 2, 20: 2, 21: 2, 22: 2, 23: 2, 24: 2, 12: 3 } }), 0, [3, 5]);
    for (const level of ['easy', 'medium', 'hard'] as const) expect(tavlaDef.botMove(s, 0, level, seededRng(1))).toEqual({ type: 'commit' });
    expect(tavlaDef.quickMove(s, 0)).toEqual({ type: 'commit' });
  });

  it('quickMove is deterministic and completes a turn', () => {
    let s = position(SPREAD[0], 0, [5, 5]);
    expect(tavlaDef.quickMove(s, 0)).toEqual(tavlaDef.quickMove(JSON.parse(JSON.stringify(s)), 0));
    for (let i = 0; i < 5 && s.turn === 0; i++) {
      const r = tavlaDef.apply(s, 0, tavlaDef.quickMove(s, 0));
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s.turn).toBe(1);
    expect(s.lastTurn?.steps.length).toBe(4);
  });

  it('timing: move generation and every botMove call stay under 50 ms (doubles, spread checkers)', () => {
    const report: string[] = [];
    let genMax = 0;
    let botMax = 0;
    // Warm up the JIT once.
    botTurn(position(SPREAD[0], 0, [1, 1]), 'hard');
    for (const b of SPREAD) {
      for (const seat of [0, 1]) {
        for (const dice of [[1, 1], [2, 2], [3, 3], [4, 4], [6, 5], [2, 1]] as [number, number][]) {
          const s = position(b, seat, dice);
          const p = toPos(s.board, seat);
          const g = timeIt(() => sequences(p, s.remaining));
          genMax = Math.max(genMax, g);
          for (const level of ['medium', 'hard'] as const) {
            const { maxMs } = botTurn(s, level);
            botMax = Math.max(botMax, maxMs);
          }
        }
      }
    }
    report.push(`gen max ${genMax.toFixed(2)} ms, botMove max ${botMax.toFixed(2)} ms`);
    console.log(`[tavla timing] ${report.join('; ')}`);
    expect(genMax).toBeLessThan(50);
    expect(botMax).toBeLessThan(50);
  });
});
