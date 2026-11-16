import { describe, expect, it } from 'vitest';
import { batakNote, batakNoteFromView, signedPoints } from '../src/net/batakSummary';
import { computeCardLayout } from '../src/components/cards/computeCardLayout';
import { fitTrickLayout, rectsIntersect, trickLayout, type TrickPosition } from '../src/components/cards/trickLayout';

const names = ['Test', 'Filiz', 'Cem', 'Ayşe'];
const base = { names, mySeat: 0, you: 'Sen', tricksWon: [5, 3, 2, 3], scores: [5, 3, 2, 3], contract: 5, declarer: 0 };

describe('batakNote', () => {
  it('declarer is me and made it', () => {
    expect(batakNote({ ...base, scores: [6, 3, 2, 3], tricksWon: [6, 3, 2, 2] })).toEqual({
      key: 'batakNoteMade',
      vars: { name: 'Sen', n: 5, pts: '+6' },
    });
  });
  it('another declarer failed: negative with a real minus sign', () => {
    expect(batakNote({ ...base, declarer: 1, contract: 6, tricksWon: [4, 3, 3, 3], scores: [4, -6, 3, 3] })).toEqual({
      key: 'batakNoteFailed',
      vars: { name: 'Filiz', n: 6, pts: '\u22126' },
    });
  });
  it('exactly the contract counts as made', () => {
    expect(batakNote({ ...base, tricksWon: [5, 3, 3, 2], scores: [5, 3, 3, 2] })?.key).toBe('batakNoteMade');
  });
  it('no contract: no note', () => {
    expect(batakNote({ ...base, declarer: null })).toBeNull();
    expect(batakNote({ ...base, contract: 0 })).toBeNull();
  });
  it('signedPoints', () => {
    expect(signedPoints(0)).toBe('0');
    expect(signedPoints(7)).toBe('+7');
    expect(signedPoints(-7)).toBe('\u22127');
  });
});

describe('batakNoteFromView', () => {
  const tr = (k: string, v: { name: string; n: number; pts: string }) => `${k}|${v.name}|${v.n}|${v.pts}`;
  const view = {
    declarer: 2,
    contract: 7,
    players: [0, 1, 2, 3].map((seat) => ({ seat, tricksWon: [2, 1, 7, 3][seat] })),
  };
  it('builds the text from a view', () => {
    expect(batakNoteFromView(view, [2, 1, 7, 3], names, 0, 'Sen', tr)).toBe('batakNoteMade|Cem|7|+7');
  });
  it('ignores non-batak views and missing scores', () => {
    expect(batakNoteFromView({ players: [] }, [0, 0], names, 0, 'Sen', tr)).toBeUndefined();
    expect(batakNoteFromView(view, null, names, 0, 'Sen', tr)).toBeUndefined();
  });
});

const POS: TrickPosition[] = ['north', 'south', 'west', 'east'];
const inset0 = { left: 0, right: 0, top: 0, bottom: 0 };
const SIZES: [string, number, number][] = [
  ['tablet 1280x800', 1280, 800],
  ['phone 852x393', 852, 393],
  ['phone 812x375', 812, 375],
];

describe('trick area cross', () => {
  for (const mode of ['below', 'overlay'] as const) {
    for (const cw of [24, 30, 38, 44, 56, 70, 84]) {
      it(`slots never intersect (${mode}, card ${cw})`, () => {
        const l = trickLayout(cw, mode);
        for (let i = 0; i < POS.length; i++)
          for (let j = i + 1; j < POS.length; j++)
            expect(rectsIntersect(l.slots[POS[i]], l.slots[POS[j]]), `${POS[i]} vs ${POS[j]}`).toBe(false);
      });
    }
  }
  it('is a cross: north above south, west left of east, all inside the area', () => {
    const l = trickLayout(60);
    const { north, south, west, east } = l.slots;
    expect(north.y + north.h).toBeLessThanOrEqual(south.y);
    expect(west.x + west.w).toBeLessThanOrEqual(north.x);
    expect(north.x + north.w).toBeLessThanOrEqual(east.x);
    for (const r of Object.values(l.slots)) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(l.width);
      expect(r.y + r.h).toBeLessThanOrEqual(l.height);
    }
  });
  for (const [label, w, h] of SIZES) {
    it(`${label}: fitted cross has disjoint slots and fits the box`, () => {
      const lay = computeCardLayout(w, h, inset0, 13);
      const l = fitTrickLayout(lay.trickBoxWidth, lay.trickBoxHeight, lay.trickCardWidth);
      for (let i = 0; i < POS.length; i++)
        for (let j = i + 1; j < POS.length; j++) expect(rectsIntersect(l.slots[POS[i]], l.slots[POS[j]])).toBe(false);
      expect(l.width).toBeLessThanOrEqual(lay.trickBoxWidth);
      expect(l.height).toBeLessThanOrEqual(lay.trickBoxHeight);
      // B12: on short phone windows the trick cards must be readable (>= 44 dp wide).
      if (h < 500) expect(l.cardWidth).toBeGreaterThanOrEqual(44);
    });
  }
});
