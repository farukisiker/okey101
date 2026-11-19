import { describe, expect, it } from 'vitest';
import type { CheckerMove } from '@kahve/tavla';
import { pointCell, targetsFor } from '../src/components/tavla/boardMath';
import {
  PLACE_BAR,
  PLACE_NONE,
  PLACE_OFF,
  dragPlan,
  dropAt,
  fromOfKey,
  keyOfFrom,
  keyOfTo,
  pickAt,
  placeAt,
  placeRect,
  toOfKey,
} from '../src/components/tavla/dragHit';
import { barX, colX, computeTavlaGeom, rowY, slotCenter, trayX, type TavlaGeom } from '../src/components/tavla/tavlaGeometry';
import { makeBoard, openingBoard } from '../src/components/tavla/fakeView';

const phone = computeTavlaGeom(800, 380); // compact landscape phone
const tablet = computeTavlaGeom(1280, 800);
const narrow = computeTavlaGeom(600, 900); // 'stack' layout

/** Centre of a point's drawn touch area (the Pressable), from the drawing code's own helpers. */
function pointCentre(g: TavlaGeom, viewer: number, n: number) {
  const { row, col } = pointCell(n, viewer);
  return { x: colX(g, col) + g.colW / 2, y: rowY(g, row) + g.pointH / 2 };
}

describe('placeAt', () => {
  for (const [name, g] of [['phone', phone], ['tablet', tablet], ['narrow', narrow]] as const) {
    it(`${name}: every point's drawn area maps back to that point, both seats`, () => {
      expect(g.compact).toBe(name === 'phone');
      for (const viewer of [0, 1]) {
        for (let n = 1; n <= 24; n++) {
          const { row, col } = pointCell(n, viewer);
          const x0 = colX(g, col);
          const y0 = rowY(g, row);
          // centre and all four inner corners of the Pressable
          const c = pointCentre(g, viewer, n);
          expect(placeAt(g, viewer, c.x, c.y)).toBe(n);
          for (const [dx, dy] of [[1, 1], [g.colW - 1, 1], [1, g.pointH - 1], [g.colW - 1, g.pointH - 1]]) {
            expect(placeAt(g, viewer, x0 + dx, y0 + dy)).toBe(n);
          }
          // the top checker's own centre too
          expect(placeAt(g, viewer, slotCenter(g, viewer, { k: 'point', n }, 4).x, slotCenter(g, viewer, { k: 'point', n }, 4).y)).toBe(n);
        }
      }
    });
  }

  it('flipped board: the same screen spot is a different point for black', () => {
    const c = pointCentre(tablet, 0, 1); // bottom-right for white
    expect(placeAt(tablet, 0, c.x, c.y)).toBe(1);
    expect(placeAt(tablet, 1, c.x, c.y)).toBe(24);
    const top = pointCentre(tablet, 0, 13); // top-left for white
    expect(placeAt(tablet, 1, top.x, top.y)).toBe(12);
  });

  it('bar: only the viewer half (bottom), the opponent half is nothing', () => {
    const x = barX(tablet) + tablet.barW / 2;
    expect(placeAt(tablet, 0, x, tablet.boardH - 10)).toBe(PLACE_BAR);
    expect(placeAt(tablet, 1, x, tablet.boardH / 2 + 2)).toBe(PLACE_BAR);
    expect(placeAt(tablet, 0, x, 10)).toBe(PLACE_NONE);
    const own = slotCenter(tablet, 0, { k: 'bar', seat: 0 }, 0);
    expect(placeAt(tablet, 0, own.x, own.y)).toBe(PLACE_BAR);
  });

  it('bear-off tray: the whole tray column, a little past the right edge too', () => {
    const x = trayX(phone) + phone.trayW / 2;
    expect(placeAt(phone, 0, x, phone.boardH - 5)).toBe(PLACE_OFF);
    expect(placeAt(phone, 1, x, 5)).toBe(PLACE_OFF);
    expect(placeAt(phone, 0, phone.boardW + phone.colW * 0.3, phone.boardH - 5)).toBe(PLACE_OFF);
  });

  it('the gap between the rows splits in the middle; far outside the board is nothing', () => {
    const { x } = pointCentre(tablet, 0, 1);
    expect(placeAt(tablet, 0, x, tablet.boardH / 2 - 1)).toBe(24);
    expect(placeAt(tablet, 0, x, tablet.boardH / 2 + 1)).toBe(1);
    expect(placeAt(tablet, 0, x, tablet.boardH + tablet.colW)).toBe(PLACE_NONE);
    expect(placeAt(tablet, 0, -tablet.colW, 50)).toBe(PLACE_NONE);
    // just below the bottom edge (the frame) still counts
    expect(placeAt(tablet, 0, x, tablet.boardH + 4)).toBe(1);
  });

  it('placeRect is the area placeAt uses', () => {
    for (const viewer of [0, 1]) {
      for (const k of [1, 6, 7, 12, 13, 18, 19, 24, PLACE_OFF, PLACE_BAR]) {
        const r = placeRect(phone, viewer, k);
        expect(placeAt(phone, viewer, r.x + r.w / 2, r.y + r.h / 2)).toBe(k);
        expect(placeAt(phone, viewer, r.x + 0.5, r.y + 0.5)).toBe(k);
        expect(placeAt(phone, viewer, r.x + r.w - 0.5, r.y + r.h - 0.5)).toBe(k);
      }
    }
  });
});

describe('pickAt / dropAt', () => {
  it('pickAt only starts on a movable place', () => {
    const c = pointCentre(tablet, 0, 13);
    expect(pickAt(tablet, 0, c.x, c.y, [13, 24])).toBe(13);
    expect(pickAt(tablet, 0, c.x, c.y, [24])).toBe(PLACE_NONE);
    const bar = slotCenter(tablet, 1, { k: 'bar', seat: 1 }, 0);
    expect(pickAt(tablet, 1, bar.x, bar.y, [PLACE_BAR])).toBe(PLACE_BAR);
    expect(pickAt(tablet, 1, bar.x, bar.y, [])).toBe(PLACE_NONE);
  });

  it('dropAt: on a target, a near miss, a real miss', () => {
    const t8 = pointCentre(tablet, 0, 8);
    expect(dropAt(tablet, 0, t8.x, t8.y, [8, 5])).toBe(8);
    expect(dropAt(tablet, 0, t8.x, t8.y, [])).toBe(PLACE_NONE);
    // On point 9 (not a target), 0.2 colW from point 8's edge: lands on 8.
    const r8 = placeRect(tablet, 0, 8);
    expect(placeAt(tablet, 0, r8.x - tablet.colW * 0.2, r8.y + 20)).toBe(9);
    expect(dropAt(tablet, 0, r8.x - tablet.colW * 0.2, r8.y + 20, [8, 5])).toBe(8);
    // Two columns away: no.
    expect(dropAt(tablet, 0, r8.x - tablet.colW * 1.5, r8.y + 20, [8, 5])).toBe(PLACE_NONE);
    // Over the bar (never a target) next to point 6: lands on 6 if 6 is a target and close enough.
    const nextTo6 = placeRect(tablet, 0, 6).x - 2;
    expect(placeAt(tablet, 0, nextTo6, tablet.boardH - 20)).toBe(PLACE_BAR);
    expect(dropAt(tablet, 0, nextTo6, tablet.boardH - 20, [6])).toBe(6);
  });

  it('dropAt: bear-off tray, flipped board', () => {
    const x = trayX(phone) + phone.trayW / 2;
    expect(dropAt(phone, 1, x, phone.boardH - 10, [PLACE_OFF, 22])).toBe(PLACE_OFF);
    const p22 = placeRect(phone, 1, 22);
    expect(dropAt(phone, 1, p22.x + 2, p22.y + 2, [PLACE_OFF, 22])).toBe(22);
  });

  it('key round trips', () => {
    expect(fromOfKey(keyOfFrom('bar'))).toBe('bar');
    expect(fromOfKey(keyOfFrom(7))).toBe(7);
    expect(toOfKey(keyOfTo('off'))).toBe('off');
    expect(toOfKey(keyOfTo(19))).toBe(19);
  });
});

describe('dragPlan', () => {
  it('offers exactly the tap targets, with origin on the top checker', () => {
    const board = openingBoard();
    const moves: CheckerMove[] = [
      { from: 13, to: 10, dice: [3] },
      { from: 13, to: 8, dice: [5] },
      { from: 13, to: 5, dice: [3, 5] },
      { from: 13, to: 5, dice: [5, 3] },
      { from: 24, to: 21, dice: [3] },
    ];
    const plan = dragPlan(tablet, 0, board, 0, moves);
    expect(plan.map((e) => e.from).sort((a, b) => a - b)).toEqual([13, 24]);
    const e13 = plan.find((e) => e.from === 13)!;
    expect(e13.targets.map((t) => t.k)).toEqual([...targetsFor(moves, 13).keys()].map(keyOfTo));
    // 5 white checkers on 13: the top one is the 5th slot
    expect({ x: e13.x, y: e13.y }).toEqual(slotCenter(tablet, 0, { k: 'point', n: 13 }, 4));
    // landing on 8 (3 own checkers there): the 4th slot
    const to8 = e13.targets.find((t) => t.k === 8)!;
    expect({ x: to8.x, y: to8.y }).toEqual(slotCenter(tablet, 0, { k: 'point', n: 8 }, 3));
  });

  it('bar entry and bearing off, black (flipped)', () => {
    const bar = makeBoard({ 1: 2 }, { 24: 3 }, [0, 1]);
    const p = dragPlan(phone, 1, bar, 1, [{ from: 'bar', to: 3, dice: [3] }]);
    expect(p).toHaveLength(1);
    expect(p[0].from).toBe(PLACE_BAR);
    expect({ x: p[0].x, y: p[0].y }).toEqual(slotCenter(phone, 1, { k: 'bar', seat: 1 }, 0));
    // point 3 is empty: first slot
    expect({ x: p[0].targets[0].x, y: p[0].targets[0].y }).toEqual(slotCenter(phone, 1, { k: 'point', n: 3 }, 0));

    const home = makeBoard({}, { 22: 2, 24: 1 }, [0, 0], [0, 12]);
    const q = dragPlan(phone, 1, home, 1, [{ from: 22, to: 'off', dice: [3] }]);
    expect(q[0].targets[0].k).toBe(PLACE_OFF);
    expect({ x: q[0].targets[0].x, y: q[0].targets[0].y }).toEqual(slotCenter(phone, 1, { k: 'off', seat: 1 }, 12));
  });

  it('no moves or a spectator: nothing to drag', () => {
    expect(dragPlan(tablet, 0, openingBoard(), 0, [])).toEqual([]);
    expect(dragPlan(tablet, 0, openingBoard(), -1, [{ from: 13, to: 8, dice: [5] }])).toEqual([]);
  });
});
