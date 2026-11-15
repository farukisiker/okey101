// FIX-DRAG: a rack tile dropped on another slot now waits where it was dropped until the
// rack answers. `rackDrop` is that answer: non-null means "it moves" (the re-render re-aims
// the tile), null means "glide home". A wrong "moves" would leave the tile hanging.
import { describe, expect, it } from 'vitest';
import { RACK_COLS, type RackGeom, type RackSlots, emptyRack, placeTile, rackDrop, slotAt } from '../src/game/rackLayout';

/** Bottom-row slot for column `c`. */
const B = (c: number) => RACK_COLS + c;

function rack(entries: [slot: number, id: number][]): RackSlots {
  const s = emptyRack();
  for (const [slot, id] of entries) s[slot] = id;
  return s;
}

describe('rackDrop', () => {
  it('moves a tile to an empty slot', () => {
    const s = rack([[B(0), 1], [B(1), 2], [B(4), 3]]);
    const next = rackDrop(s, 2, B(7));
    expect(next).not.toBeNull();
    expect(next!.indexOf(2)).toBe(B(7));
    expect(next![B(1)]).toBeNull();
  });

  it('drops onto a tile: it lands next to it, toward the nearest gap', () => {
    // The tablet video: red 12 (id 2) right of red 9, dropped onto the "4" of "4 6".
    const s = rack([[B(0), 1], [B(1), 2], [B(4), 3], [B(5), 4]]);
    const next = rackDrop(s, 2, B(4));
    expect(next).not.toBeNull();
    expect(next!.indexOf(2)).toBe(B(3)); // nearest gap was on the left: just before the 4
    expect(next!.indexOf(3)).toBe(B(4));
    expect(next!.indexOf(4)).toBe(B(5));
  });

  it('drops onto a tile with the gap on the right: the row slides right', () => {
    const s = rack([[B(0), 1], [B(1), 5], [B(2), 6], [B(3), 8], [B(4), 3], [B(5), 4], [B(9), 2]]);
    const next = rackDrop(s, 2, B(4));
    expect(next!.indexOf(2)).toBe(B(4));
    expect(next!.indexOf(3)).toBe(B(5));
    expect(next!.indexOf(4)).toBe(B(6));
  });

  it('its own slot: stays (goes home)', () => {
    const s = rack([[B(1), 2]]);
    expect(rackDrop(s, 2, B(1))).toBeNull();
  });

  it('a full row: stays (goes home)', () => {
    const s = emptyRack();
    for (let c = 0; c < RACK_COLS; c++) s[c] = 100 + c;
    s[B(0)] = 7;
    expect(rackDrop(s, 7, 3)).toBeNull();
  });

  it('a nudge that puts the tile straight back counts as no move', () => {
    // Top row full except the dragged tile's own slot 5; drop it on 6. The only gap is the
    // slot it just left, so it lands right back there. placeTile still returns a fresh array,
    // so the old "next !== slots" test called this a move and the waiting tile would hang.
    const s = emptyRack();
    for (let c = 0; c < RACK_COLS; c++) s[c] = 100 + c;
    s[5] = 7;
    const placed = placeTile(s, 7, 6);
    expect(placed).not.toBe(s);
    expect(placed.indexOf(7)).toBe(5);
    expect(rackDrop(s, 7, 6)).toBeNull();
  });

  it('a tile not on the rack: no move', () => {
    expect(rackDrop(rack([[B(1), 2]]), 99, B(3))).toBeNull();
  });
});

describe('slotAt agrees with the drop target the UI thread uses', () => {
  const g: RackGeom = { x: 0, y: 600, padX: 0, padY: 4, tileW: 64, rowH: 90 };
  it('maps the tile centre to a slot', () => {
    expect(slotAt(g, 64 * 4 + 32, 604 + 90 + 40)).toBe(B(4));
    expect(slotAt(g, 64 * 2 + 10, 604 + 10)).toBe(2);
  });
  it('off the rack is -1 (a zone drop: the tile glides home, then is played)', () => {
    expect(slotAt(g, 300, 300)).toBe(-1);
    expect(slotAt(null, 300, 700)).toBe(-1);
  });
});
