// B11 (Claude Sonnet): pure layout of the Batak trick area, a cross of four slots that never overlap.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TrickPosition = 'north' | 'south' | 'west' | 'east';
export type TagMode = 'below' | 'overlay';

export interface TrickLayout {
  cardWidth: number;
  cardHeight: number;
  /** 'below': the name tag sits under the card (part of the slot). 'overlay': on the card's bottom edge (tight screens). */
  tagMode: TagMode;
  tagHeight: number;
  width: number;
  height: number;
  /** Each slot = card (+ name tag when below). */
  slots: Record<TrickPosition, Rect>;
}

export const TRICK_TAG_HEIGHT = 22;
export const TRICK_GAP = 8;
/** The name tag may be wider than a small card; a slot is at least this wide. */
export const TRICK_MIN_SLOT_WIDTH = 80;
const MIN_CARD_BELOW = 44;
const MIN_CARD_OVERLAY = 24;

export const trickCardHeight = (cardWidth: number): number => Math.round(cardWidth * 1.38);

/** North on top, south at the bottom (the local player), west left and east right, all four slots disjoint. */
export function trickLayout(cardWidth: number, tagMode: TagMode = 'below'): TrickLayout {
  const cardHeight = trickCardHeight(cardWidth);
  const tagHeight = tagMode === 'below' ? TRICK_TAG_HEIGHT : 0;
  const slotW = Math.max(cardWidth, TRICK_MIN_SLOT_WIDTH);
  const slotH = cardHeight + tagHeight;
  const width = 3 * slotW + 2 * TRICK_GAP;
  const height = 2 * slotH + TRICK_GAP;
  const midY = Math.round((height - slotH) / 2);
  return {
    cardWidth,
    cardHeight,
    tagMode,
    tagHeight,
    width,
    height,
    slots: {
      north: { x: slotW + TRICK_GAP, y: 0, w: slotW, h: slotH },
      south: { x: slotW + TRICK_GAP, y: slotH + TRICK_GAP, w: slotW, h: slotH },
      west: { x: 0, y: midY, w: slotW, h: slotH },
      east: { x: 2 * (slotW + TRICK_GAP), y: midY, w: slotW, h: slotH },
    },
  };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * The biggest cross (card width at most `desired`) that fits the box. Names go under the cards while the cards stay
 * a readable size, and onto the cards' bottom edge when the screen is too short for that.
 */
export function fitTrickLayout(boxW: number, boxH: number, desired: number): TrickLayout {
  const fits = (l: TrickLayout) => l.width <= boxW && l.height <= boxH;
  for (let cw = Math.max(desired, MIN_CARD_BELOW); cw >= MIN_CARD_BELOW; cw--) {
    const l = trickLayout(cw, 'below');
    if (fits(l)) return l;
  }
  for (let cw = Math.max(Math.min(desired, MIN_CARD_BELOW), MIN_CARD_OVERLAY); cw >= MIN_CARD_OVERLAY; cw--) {
    const l = trickLayout(cw, 'overlay');
    if (fits(l)) return l;
  }
  return trickLayout(MIN_CARD_OVERLAY, 'overlay');
}
