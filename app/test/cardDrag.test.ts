// Drag-and-drop for the Pişti and Batak hands, in addition to the taps: the pure parts
// (does the held card land on the table zone, may this card be picked up at all).
import { describe, expect, it } from 'vitest';
import {
  CARD_DRAG_LIFT,
  CARD_DRAG_START_OTHER,
  CARD_DRAG_START_UP,
  type DropRect,
  canDragCard,
  heldCardCentre,
  hitDropZone,
  pistiDropPad,
  trickDropPad,
} from '../src/components/cards/cardDrag';
import { computeCardLayout } from '../src/components/cards/computeCardLayout';

const zone: DropRect = { x: 100, y: 50, width: 80, height: 120 };
const noPad = { x: 0, top: 0, bottom: 0 };

describe('hitDropZone', () => {
  it('hits inside the zone and on its edges', () => {
    expect(hitDropZone(zone, 140, 110, noPad)).toBe(true);
    expect(hitDropZone(zone, 100, 50, noPad)).toBe(true);
    expect(hitDropZone(zone, 180, 170, noPad)).toBe(true);
  });

  it('misses outside the zone without a pad', () => {
    expect(hitDropZone(zone, 99, 110, noPad)).toBe(false);
    expect(hitDropZone(zone, 181, 110, noPad)).toBe(false);
    expect(hitDropZone(zone, 140, 49, noPad)).toBe(false);
    expect(hitDropZone(zone, 140, 171, noPad)).toBe(false);
  });

  it('the pad widens the target to the sides and above, only a little below', () => {
    const pad = { x: 40, top: 40, bottom: 8 };
    expect(hitDropZone(zone, 61, 110, pad)).toBe(true); // 39 dp left of the pile
    expect(hitDropZone(zone, 219, 110, pad)).toBe(true); // 39 dp right
    expect(hitDropZone(zone, 140, 11, pad)).toBe(true); // 39 dp above
    expect(hitDropZone(zone, 140, 177, pad)).toBe(true); // 7 dp below
    expect(hitDropZone(zone, 140, 180, pad)).toBe(false); // 10 dp below: toward the hand, no play
    expect(hitDropZone(zone, 59, 110, pad)).toBe(false);
  });

  it('a zone not measured yet (or collapsed) never hits', () => {
    expect(hitDropZone(null, 140, 110, noPad)).toBe(false);
    expect(hitDropZone({ x: 0, y: 0, width: 0, height: 0 }, 0, 0, { x: 50, top: 50, bottom: 50 })).toBe(false);
  });
});

describe('heldCardCentre', () => {
  it('aims with the card, not the finger: grab offset and lift are taken off', () => {
    // Finger at (300, 400), it took the card 10 dp right and 20 dp below the card centre.
    expect(heldCardCentre(300, 400, 10, 20, CARD_DRAG_LIFT)).toEqual({ x: 290, y: 400 - CARD_DRAG_LIFT - 20 });
  });

  it('a card taken at its centre sits right above the finger', () => {
    expect(heldCardCentre(50, 60, 0, 0, 0)).toEqual({ x: 50, y: 60 });
  });
});

describe('drop pads', () => {
  it('the Pişti pile gets at least 40 dp around it and little below', () => {
    expect(pistiDropPad(30)).toEqual({ x: 40, top: 40, bottom: 8 });
    const big = pistiDropPad(100);
    expect(big.x).toBe(80);
    expect(big.top).toBe(80);
    expect(big.bottom).toBeLessThan(big.top);
  });

  it('the Batak cross (already the whole centre) gets a smaller pad', () => {
    expect(trickDropPad(40)).toEqual({ x: 16, top: 16, bottom: 4 });
    expect(trickDropPad(80).x).toBeLessThan(pistiDropPad(80).x);
  });

  it('a card resting in the hand is never on the zone (no accidental play)', () => {
    // Phone (compact) and tablet: the pile/cross sits above the hand; the gap from the zone's bottom
    // to the centre of a hand card is more than the bottom pad plus the activation move.
    for (const [w, h] of [[852, 393], [915, 412], [1280, 800], [1366, 1024]] as const) {
      for (const handCount of [4, 13]) {
        const l = computeCardLayout(w, h, { left: 0, right: 0, top: 0, bottom: 0 }, handCount);
        const pad = handCount <= 4 ? pistiDropPad(l.centerPileCardWidth) : trickDropPad(l.trickCardWidth);
        // Gap between the table centre's bottom and the hand card's centre: action bar + tray padding + half a card.
        const gap = l.actionBarHeight + 6 + l.cardHeight / 2;
        expect(gap - CARD_DRAG_START_UP).toBeGreaterThan(pad.bottom);
      }
    }
  });
});

describe('canDragCard', () => {
  const playable = [3, 7];

  it('only a playable card, only on my turn, only where the screen takes drops', () => {
    expect(canDragCard(3, true, playable, true)).toBe(true);
    expect(canDragCard(5, true, playable, true)).toBe(false); // Batak: must follow suit, dimmed card
    expect(canDragCard(3, false, playable, true)).toBe(false); // not my turn / bidding
    expect(canDragCard(3, true, playable, false)).toBe(false); // no drop zone given
  });

  it('without a playable list every card may go (same as the hand tap rule)', () => {
    expect(canDragCard(9, true, undefined, true)).toBe(true);
  });

  it('an empty playable list blocks every card', () => {
    expect(canDragCard(3, true, [], true)).toBe(false);
  });
});

describe('drag activation thresholds', () => {
  it('up toward the table starts sooner than any other way; both are beyond a tap jitter', () => {
    expect(CARD_DRAG_START_UP).toBeGreaterThanOrEqual(8);
    expect(CARD_DRAG_START_OTHER).toBeGreaterThan(CARD_DRAG_START_UP);
  });
});
