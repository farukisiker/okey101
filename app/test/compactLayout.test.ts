import { describe, expect, it } from 'vitest';
import { opponentOrder } from '../src/components/cards/opponentOrder';
import {
  COMPACT_BAR_HEIGHT,
  COMPACT_OPPONENTS_HEIGHT,
  FULL_HEADER_HEIGHT,
  isCompactShell,
  shellHeaderBudget,
} from '../src/components/shellBudget';
import { COMPACT_ROW_PADDING, COMPACT_SIDE_WIDTH, computeCardLayout } from '../src/components/cards/computeCardLayout';
import { fitTrickLayout, rectsIntersect, type TrickPosition } from '../src/components/cards/trickLayout';

const POS: TrickPosition[] = ['north', 'south', 'west', 'east'];
const flat = { left: 0, right: 0, top: 0, bottom: 0 };
const notch = { left: 44, right: 44, top: 0, bottom: 21 };
const PHONES: [string, number, number][] = [
  ['812x375', 812, 375],
  ['852x393', 852, 393],
];

describe('GameShell header budget', () => {
  it('is compact below 500 dp window height only', () => {
    expect(isCompactShell(375)).toBe(true);
    expect(isCompactShell(499)).toBe(true);
    expect(isCompactShell(500)).toBe(false);
    expect(isCompactShell(800)).toBe(false);
  });
  it('compact header = bar (status merged in) + one opponent row = 96 dp, no separate status line', () => {
    const b = shellHeaderBudget(375);
    expect(b).toMatchObject({ compact: true, bar: COMPACT_BAR_HEIGHT, opponents: COMPACT_OPPONENTS_HEIGHT, status: 0, total: 96 });
    expect(b.total).toBe(b.bar + b.opponents + b.status);
    // 56 dp touch targets still fit in the bar
    expect(COMPACT_BAR_HEIGHT).toBeGreaterThanOrEqual(56);
    // at least ~45 dp freed against the 144-156 dp tablet header
    expect(FULL_HEADER_HEIGHT - b.total).toBeGreaterThanOrEqual(45);
  });
  it('without opponents the compact header is just the bar', () => {
    expect(shellHeaderBudget(375, 1, false).total).toBe(COMPACT_BAR_HEIGHT);
  });
  it('tablet header is the old 144 dp estimate scaled up to 1.2', () => {
    expect(shellHeaderBudget(800, 1).total).toBe(144);
    expect(shellHeaderBudget(800, 1.5).total).toBe(173);
  });
});

describe('compact card layout on 6-inch landscape phones', () => {
  for (const [label, w, h] of PHONES) {
    for (const [iname, ins] of [['no insets', flat], ['notch insets', notch]] as const) {
      describe(`${label} (${iname})`, () => {
        const bat = computeCardLayout(w, h, ins, 13);
        const pis = computeCardLayout(w, h, ins, 4);

        it('is compact: no action bar row', () => {
          expect(bat.compact).toBe(true);
          expect(bat.actionBarHeight).toBe(0);
        });
        it('Batak: trick cards >= 44 dp, cross disjoint and inside the box', () => {
          expect(bat.trickCardWidth).toBeGreaterThanOrEqual(44);
          const l = fitTrickLayout(bat.trickBoxWidth, bat.trickBoxHeight, bat.trickCardWidth);
          expect(l.cardWidth).toBe(bat.trickCardWidth);
          for (let i = 0; i < POS.length; i++)
            for (let j = i + 1; j < POS.length; j++) expect(rectsIntersect(l.slots[POS[i]], l.slots[POS[j]])).toBe(false);
          expect(l.width).toBeLessThanOrEqual(bat.trickBoxWidth);
          expect(l.height).toBeLessThanOrEqual(bat.trickBoxHeight);
          // each side column keeps room for the Sort / Play buttons (120 dp) and the badges
          const side = (bat.width - 2 * COMPACT_ROW_PADDING - l.width) / 2 - (ins.left + ins.right) / 2;
          expect(side).toBeGreaterThanOrEqual(COMPACT_SIDE_WIDTH);
        });
        it('Batak: 13-card hand needs no horizontal scrolling and keeps >= 15 pt rank text', () => {
          expect(bat.handTotalWidth).toBeLessThanOrEqual(bat.usableWidth - 16);
          // CardView corner rank = max(16, 0.32 * width)
          expect(Math.max(16, Math.round(bat.cardWidth * 0.32))).toBeGreaterThanOrEqual(15);
        });
        it('Pişti: centre card >= 56 dp and the pile fits the centre', () => {
          expect(pis.centerPileCardWidth).toBeGreaterThanOrEqual(56);
          expect(Math.round(pis.centerPileCardWidth * 1.38) + 10).toBeLessThanOrEqual(pis.centerBoxHeight);
          expect(pis.handTotalWidth).toBeLessThanOrEqual(pis.usableWidth - 16);
        });
        it('vertical budget: header + centre + hand row fits the window', () => {
          for (const lay of [bat, pis]) {
            const header = shellHeaderBudget(h, lay.s).total;
            const used = header + lay.centerBoxHeight + lay.cardHeight + 26 + lay.insets.bottom;
            expect(used).toBeLessThanOrEqual(h);
          }
        });
      });
    }
  }

  it('freed height: trick box is at least 2x the old 77 dp', () => {
    expect(computeCardLayout(812, 375, flat, 13).trickBoxHeight).toBeGreaterThanOrEqual(154);
  });
});

describe('tablet 1280x800 is unchanged', () => {
  const lay = computeCardLayout(1280, 800, flat, 13);
  const pis = computeCardLayout(1280, 800, flat, 4);
  it('keeps the old numbers', () => {
    expect(lay.compact).toBe(false);
    expect(lay.actionBarHeight).toBe(84);
    expect(lay.trickBoxHeight).toBe(401);
    expect(lay.trickCardWidth).toBe(84);
    expect(fitTrickLayout(lay.trickBoxWidth, lay.trickBoxHeight, lay.trickCardWidth)).toMatchObject({ cardWidth: 84, tagMode: 'below' });
    expect(lay.cardWidth).toBe(84);
    expect(lay.cardStep).toBe(88);
    expect(pis.centerPileCardWidth).toBe(96);
    expect(pis.cardWidth).toBe(101);
  });
});

describe('opponentOrder (panels left to right = west, north, east)', () => {
  it('4 players: seat-1, seat+2, seat+1', () => {
    expect(opponentOrder(0, 4)).toEqual([3, 2, 1]);
    expect(opponentOrder(1, 4)).toEqual([0, 3, 2]);
    expect(opponentOrder(3, 4)).toEqual([2, 1, 0]);
  });
  it('matches the trick cross slots (west = seat+3, north = seat+2, east = seat+1)', () => {
    for (let s = 0; s < 4; s++) expect(opponentOrder(s, 4)).toEqual([(s + 3) % 4, (s + 2) % 4, (s + 1) % 4]);
  });
  it('2 players: the other seat; never includes me', () => {
    expect(opponentOrder(0, 2)).toEqual([1]);
    expect(opponentOrder(1, 2)).toEqual([0]);
    expect(opponentOrder(2, 3)).not.toContain(2);
  });
});
