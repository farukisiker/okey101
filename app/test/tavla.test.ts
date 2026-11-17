import { describe, expect, it } from 'vitest';
import type { CheckerMove, Step } from '@kahve/tavla';
import {
  applyStep,
  boardBefore,
  cellPoint,
  moveLabel,
  movableFroms,
  nextStepOffered,
  pipCount,
  planSteps,
  pointCell,
  stackShown,
  stepDestination,
  targetsFor,
  unapplyStep,
  usedDice,
  wouldHit,
} from '../src/components/tavla/boardMath';
import { FRAME, computeTavlaGeom, colX, slotCenter, trayX } from '../src/components/tavla/tavlaGeometry';
import { buildView, fakeMidGame, fakeOnBar, fakeOpening, makeBoard, openingBoard, simpleMoves } from '../src/components/tavla/fakeView';
import { tavlaSummary } from '../src/components/tavla/summary';

describe('orientation', () => {
  it('seat 0: home 1..6 bottom-right, own side at the bottom', () => {
    expect(pointCell(1, 0)).toEqual({ row: 'bottom', col: 11 });
    expect(pointCell(6, 0)).toEqual({ row: 'bottom', col: 6 });
    expect(pointCell(12, 0)).toEqual({ row: 'bottom', col: 0 });
    expect(pointCell(13, 0)).toEqual({ row: 'top', col: 0 });
    expect(pointCell(24, 0)).toEqual({ row: 'top', col: 11 });
  });
  it('seat 1: home 19..24 bottom-right too', () => {
    expect(pointCell(24, 1)).toEqual({ row: 'bottom', col: 11 });
    expect(pointCell(19, 1)).toEqual({ row: 'bottom', col: 6 });
    expect(pointCell(13, 1)).toEqual({ row: 'bottom', col: 0 });
    expect(pointCell(1, 1)).toEqual({ row: 'top', col: 11 });
  });
  it('cellPoint is the inverse for both seats, and all 24 cells are used once', () => {
    for (const viewer of [0, 1]) {
      const seen = new Set<string>();
      for (let n = 1; n <= 24; n++) {
        const c = pointCell(n, viewer);
        expect(cellPoint(c.row, c.col, viewer)).toBe(n);
        seen.add(`${c.row}${c.col}`);
      }
      expect(seen.size).toBe(24);
    }
  });
});

describe('steps', () => {
  it('stepDestination', () => {
    expect(stepDestination(13, 5, 0)).toBe(8);
    expect(stepDestination(13, 5, 1)).toBe(18);
    expect(stepDestination('bar', 2, 0)).toBe(23);
    expect(stepDestination('bar', 2, 1)).toBe(2);
  });
  it('planSteps sends each die from where the checker now stands', () => {
    const m: CheckerMove = { from: 13, to: 5, dice: [5, 3] };
    expect(planSteps(m, 0)).toEqual([
      { type: 'step', from: 13, die: 5 },
      { type: 'step', from: 8, die: 3 },
    ]);
    expect(planSteps({ from: 'bar', to: 20, dice: [2, 3] }, 0)).toEqual([
      { type: 'step', from: 'bar', die: 2 },
      { type: 'step', from: 23, die: 3 },
    ]);
    expect(planSteps({ from: 1, to: 9, dice: [4, 4] }, 1)).toEqual([
      { type: 'step', from: 1, die: 4 },
      { type: 'step', from: 5, die: 4 },
    ]);
  });
  it('nextStepOffered only while the view still lists it', () => {
    const view = { moves: [{ from: 8, to: 5, dice: [3] }] };
    expect(nextStepOffered(view, { type: 'step', from: 8, die: 3 })).toBe(true);
    expect(nextStepOffered(view, { type: 'step', from: 8, die: 5 })).toBe(false);
    expect(nextStepOffered(view, { type: 'commit' })).toBe(false);
  });
  it('targetsFor prefers the route with fewer dice', () => {
    const moves: CheckerMove[] = [
      { from: 13, to: 10, dice: [3] },
      { from: 13, to: 8, dice: [5] },
      { from: 13, to: 5, dice: [5, 3] },
      { from: 13, to: 5, dice: [3, 5] },
      { from: 6, to: 3, dice: [3] },
    ];
    const t = targetsFor(moves, 13);
    expect([...t.keys()].sort((a, b) => Number(a) - Number(b))).toEqual([5, 8, 10]);
    expect(t.get(5)?.dice).toEqual([5, 3]);
    expect([...movableFroms(moves)].sort()).toEqual([13, 6]);
  });
  it('moveLabel', () => {
    expect(moveLabel({ from: 8, to: 5, dice: [3] })).toEqual({ main: '3' });
    expect(moveLabel({ from: 13, to: 5, dice: [5, 3] })).toEqual({ main: '8', parts: '5+3' });
    expect(moveLabel({ from: 13, to: 1, dice: [3, 3, 3, 3] })).toEqual({ main: '12', parts: '4×3' });
  });
});

describe('dice and stacks', () => {
  it('usedDice follows remaining', () => {
    expect(usedDice([5, 3], [5, 3])).toEqual([false, false]);
    expect(usedDice([5, 3], [3])).toEqual([true, false]);
    expect(usedDice([5, 3], [])).toEqual([true, true]);
    expect(usedDice([4, 4], [4, 4])).toEqual([false, false]);
    expect(usedDice([4, 4], [])).toEqual([true, true]);
  });
  it('stackShown draws at most 5', () => {
    expect(stackShown(3)).toEqual({ shown: 3, extra: null });
    expect(stackShown(5)).toEqual({ shown: 5, extra: null });
    expect(stackShown(7)).toEqual({ shown: 5, extra: 7 });
  });
});

describe('board changes', () => {
  const hit: Step = { from: 8, to: 7, die: 1, hit: true };
  it('applyStep / unapplyStep round trip, with a hit, from the bar and bearing off', () => {
    const b = makeBoard({ 8: 2, 6: 1 }, { 7: 1, 20: 3 }, [0, 0]);
    const after = applyStep(b, 0, hit);
    expect(after.points[7]).toBe(1);
    expect(after.points[8]).toBe(1);
    expect(after.bar[1]).toBe(1);
    expect(unapplyStep(after, 0, hit)).toEqual(b);
    const onBar = makeBoard({ 6: 1 }, { 20: 3 }, [1, 0]);
    const enter: Step = { from: 'bar', to: 23, die: 2, hit: false };
    expect(unapplyStep(applyStep(onBar, 0, enter), 0, enter)).toEqual(onBar);
    const home = makeBoard({ 2: 1 }, {}, [0, 0], [3, 0]);
    const off: Step = { from: 2, to: 'off', die: 3, hit: false };
    expect(applyStep(home, 0, off).off[0]).toBe(4);
    expect(unapplyStep(applyStep(home, 0, off), 0, off)).toEqual(home);
  });
  it('boardBefore undoes a whole opponent turn (black hits white)', () => {
    const before = makeBoard({ 3: 1, 13: 2 }, { 1: 2 }, [0, 0]);
    const steps: Step[] = [
      { from: 1, to: 3, die: 2, hit: true },
      { from: 3, to: 6, die: 3, hit: false },
    ];
    let after = before;
    for (const s of steps) after = applyStep(after, 1, s);
    expect(after.bar[0]).toBe(1);
    expect(boardBefore(after, { turnNumber: 1, seat: 1, dice: [2, 3], steps })).toEqual(before);
  });
  it('wouldHit and pip count', () => {
    const b = makeBoard({ 6: 2 }, { 5: 1, 4: 2 });
    expect(wouldHit(b, 0, 5)).toBe(true);
    expect(wouldHit(b, 0, 4)).toBe(false);
    expect(wouldHit(b, 0, 'off')).toBe(false);
    expect(pipCount(openingBoard(), 0)).toBe(167);
    expect(pipCount(openingBoard(), 1)).toBe(167);
  });
});

describe('geometry: nothing overflows', () => {
  const cases: [string, number, number, { left: number; right: number; top: number; bottom: number }][] = [
    ['tablet 1280x800', 1280, 800, { left: 0, right: 0, top: 0, bottom: 0 }],
    ['tablet 1024x600', 1024, 600, { left: 0, right: 0, top: 0, bottom: 0 }],
    ['phone 812x375 (notch)', 812, 375, { left: 44, right: 44, top: 0, bottom: 21 }],
    ['phone 667x375', 667, 375, { left: 0, right: 0, top: 0, bottom: 0 }],
    ['phone 932x430', 932, 430, { left: 59, right: 59, top: 0, bottom: 21 }],
    ['portrait 400x800', 400, 800, { left: 0, right: 0, top: 0, bottom: 0 }],
  ];
  for (const [name, w, h, insets] of cases) {
    it(name, () => {
      const g = computeTavlaGeom(w, h, insets);
      expect(g.boardW + 2 * FRAME + (g.mode === 'side' ? g.panelW + 12 : 0)).toBeLessThanOrEqual(g.areaW + 1);
      const boardOuterH = g.boardH + 2 * FRAME;
      expect(g.mode === 'side' ? boardOuterH : boardOuterH + g.panelH + 12).toBeLessThanOrEqual(g.areaH + 1);
      expect(g.panelW).toBeGreaterThan(190);
      // Five stacked checkers leave room for the 15 pt point number.
      expect(g.pointH - (4 * g.step + g.d)).toBeGreaterThanOrEqual(15);
    });
  }
  it('checker sizes', () => {
    expect(computeTavlaGeom(1280, 800).d).toBeGreaterThanOrEqual(50);
    expect(computeTavlaGeom(812, 375, { left: 44, right: 44, top: 0, bottom: 21 }).d).toBeGreaterThanOrEqual(20);
    expect(computeTavlaGeom(812, 375).compact).toBe(true);
    expect(computeTavlaGeom(1280, 800).compact).toBe(false);
  });
  it('slots stay inside the board', () => {
    const g = computeTavlaGeom(1280, 800);
    for (const viewer of [0, 1]) {
      for (let n = 1; n <= 24; n++) {
        for (let i = 0; i < 7; i++) {
          const c = slotCenter(g, viewer, { k: 'point', n }, i);
          expect(c.x - g.d / 2).toBeGreaterThanOrEqual(0);
          expect(c.x + g.d / 2).toBeLessThanOrEqual(g.boardW);
          expect(c.y - g.d / 2).toBeGreaterThanOrEqual(0);
          expect(c.y + g.d / 2).toBeLessThanOrEqual(g.boardH);
        }
      }
      for (const seat of [0, 1]) {
        const b = slotCenter(g, viewer, { k: 'bar', seat }, 3);
        expect(b.y - g.d / 2).toBeGreaterThanOrEqual(0);
        expect(b.y + g.d / 2).toBeLessThanOrEqual(g.boardH);
        const o = slotCenter(g, viewer, { k: 'off', seat }, 14);
        expect(o.y).toBeGreaterThan(0);
        expect(o.y).toBeLessThan(g.boardH);
        expect(o.x).toBeGreaterThan(trayX(g));
      }
    }
    expect(colX(g, 11) + g.colW).toBeLessThanOrEqual(trayX(g));
  });
  it('mine at the bottom, the far side at the top, for both seats', () => {
    const g = computeTavlaGeom(1280, 800);
    expect(slotCenter(g, 0, { k: 'point', n: 6 }, 0).y).toBeGreaterThan(g.boardH / 2);
    expect(slotCenter(g, 0, { k: 'point', n: 19 }, 0).y).toBeLessThan(g.boardH / 2);
    expect(slotCenter(g, 1, { k: 'point', n: 19 }, 0).y).toBeGreaterThan(g.boardH / 2);
  });
});

describe('fake views and summary', () => {
  it('opening 5-3 offers targets 10, 8 and 5 from point 13', () => {
    const v = fakeOpening(0);
    const t = targetsFor(v.moves, 13);
    expect([...t.keys()].sort((a, b) => Number(a) - Number(b))).toEqual([5, 8, 10]);
    expect(v.canCommit).toBe(false);
    expect(v.mustPass).toBe(false);
  });
  it('black opening works the other way round', () => {
    const v = fakeOpening(1);
    expect(v.moves.length).toBeGreaterThan(0);
    expect(targetsFor(v.moves, 12).has(17)).toBe(true);
  });
  it('bar: only entering is offered', () => {
    const v = fakeOnBar();
    expect([...movableFroms(v.moves)]).toEqual(['bar']);
    expect(v.moves[0].to).toBe(23);
  });
  it('blocked bar: pass', () => {
    const v = buildView({ seat: 0, board: makeBoard({ 13: 14 }, { 22: 2, 20: 2 }, [1, 0]), turn: 0, turnNumber: 5, dice: [3, 5] });
    expect(v.mustPass).toBe(true);
    expect(v.moves).toEqual([]);
  });
  it('mid-game has a black checker on the bar and a stack of 6', () => {
    const v = fakeMidGame();
    expect(v.board.bar[1]).toBe(1);
    expect(v.board.points[13]).toBe(6);
    expect(simpleMoves(v.board, 0, [4, 3]).length).toBeGreaterThan(0);
  });
  it('tavlaSummary: mars gives 2 points to the winner', () => {
    const s = tavlaSummary({
      names: ['Ayşe', 'Mehmet'],
      result: { winner: 0, kind: 'mars', points: 2 },
      totals: [4, 1],
      matchOver: false,
      mySeat: 0,
      you: 'Sen',
      kindLabel: { tek: 'Tek', mars: 'Mars', koncina: 'Konçina' },
      note: (k, n) => `${k} — ${n} sayı`,
    });
    expect(s.rows.map((r) => r.points)).toEqual([2, 0]);
    expect(s.winnerSeats).toEqual([0]);
    expect(s.note).toBe('Mars — 2 sayı');
    expect(s.wording).toBe('tavla');
  });
});
