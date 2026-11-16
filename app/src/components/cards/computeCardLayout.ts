// Pure card-game layout maths (no react-native import, so vitest can load it).
import { isCompactShell, shellHeaderBudget } from '../shellBudget';
import { fitTrickLayout } from './trickLayout';

/** Compact (short window) layout: the side columns beside the table centre each get at least this much width. */
export const COMPACT_SIDE_WIDTH = 140;
/** Compact side padding of the table row (on top of the safe-area insets). */
export const COMPACT_ROW_PADDING = 12;
export interface CardGameLayout {
  /** B12: short window (< 500 dp high): merged header, action buttons beside the table centre, no action bar row. */
  compact: boolean;
  /** Tablet scale factor clamp(W / 852, 1, 1.6) */
  s: number;
  width: number;
  height: number;
  usableWidth: number;
  usableHeight: number;
  insets: { left: number; right: number; top: number; bottom: number };

  /** Card dimensions for player's Hand */
  cardWidth: number;
  cardHeight: number;
  cardStep: number;
  handTotalWidth: number;

  /** Pişti center pile card dimensions */
  centerPileCardWidth: number;
  centerPileCardHeight: number;

  /** Batak trick area card dimensions */
  trickCardWidth: number;
  trickCardHeight: number;
  /** Room for the Batak trick area: between the header and the action bar + hand (B11). */
  trickBoxWidth: number;
  trickBoxHeight: number;

  /** Card opponent panel dimensions */
  oppPanelWidth: number;
  oppPanelHeight: number;

  /** Height of the table centre between the header and the hand (action bar included when it is a row). */
  centerBoxHeight: number;

  /** Action bar row height; 0 when compact (Sort and Play sit beside the table centre instead). */
  actionBarHeight: number;
}

export function computeCardLayout(
  width: number,
  height: number,
  insets: { left: number; right: number; top: number; bottom: number },
  handCount = 4,
): CardGameLayout {
  const s = Math.min(1.6, Math.max(1, width / 852));
  const usableWidth = width - insets.left - insets.right;
  const usableHeight = height - insets.top - insets.bottom;

  // Header consumed by GameShell: tablet ~144 dp (top bar + opponents + status line), compact 96 dp (B12).
  const compact = isCompactShell(height);
  const shellHeaderHeight = shellHeaderBudget(height, s).total;
  const availableGameHeight = Math.max(180, usableHeight - shellHeaderHeight);
  const isCompactHeight = availableGameHeight < 280;

  // Action bar height (>= 56 dp touch target for 60+ ergonomics); compact: buttons sit beside the table centre.
  const actionBarHeight = compact ? 0 : Math.max(56, Math.round(56 * s));

  // Available vertical space for center section + Hand cards
  const remainingCardsHeight = Math.max(120, availableGameHeight - actionBarHeight);

  let cardWidth: number;
  let cardStep: number;

  if (handCount <= 4) {
    // Pişti style (4 cards, no overlap needed)
    const maxHandH = isCompactHeight ? Math.floor(remainingCardsHeight * 0.44) : 140;
    const maxHandW = Math.floor(maxHandH / 1.38);
    const targetWidth = Math.min(Math.round(68 * s), Math.floor((usableWidth - 64) / Math.max(1, handCount)));
    cardWidth = compact ? Math.min(60, Math.max(46, targetWidth)) : Math.max(46, Math.min(targetWidth, maxHandW));
    cardStep = cardWidth + Math.round(12 * s);
  } else {
    // Batak style (up to 13 cards, slight overlap on compact screens)
    const maxHandH = isCompactHeight ? Math.floor(remainingCardsHeight * 0.42) : 120;
    const maxHandW = Math.floor(maxHandH / 1.38);
    const baseWidth = compact ? 46 : Math.max(40, Math.min(Math.round(56 * s), maxHandW));
    const maxAvailableStep = Math.floor((usableWidth - 32 - baseWidth) / Math.max(1, handCount - 1));
    cardWidth = baseWidth;
    cardStep = Math.min(baseWidth + 4, Math.max(40, maxAvailableStep));
  }

  const cardHeight = Math.round(cardWidth * 1.38);
  const handTotalWidth = handCount > 0 ? (handCount - 1) * cardStep + cardWidth : 0;

  // The hand row is cardHeight + ~26 dp (padding); the table centre gets what is left above the action bar.
  const centerBoxHeight = Math.max(60, availableGameHeight - actionBarHeight - (cardHeight + 26));

  // Center pile (Pişti); compact: the badge sits beside the pile, so the whole centre height is the pile's
  const maxCenterPileH = compact
    ? centerBoxHeight - 10
    : isCompactHeight ? Math.floor(remainingCardsHeight * 0.48) : Math.round(90 * s);
  const centerPileCardWidth = compact
    ? Math.max(42, Math.min(72, Math.floor(maxCenterPileH / 1.38)))
    : Math.max(42, Math.min(Math.round(64 * s), Math.floor(maxCenterPileH / 1.38)));
  const centerPileCardHeight = Math.round(centerPileCardWidth * 1.38);

  // Trick area (Batak)
  const maxTrickH = isCompactHeight ? Math.floor(remainingCardsHeight * 0.46) : Math.round(80 * s);
  const trickBoxHeight = centerBoxHeight;
  const trickBoxWidth = compact
    ? Math.max(120, usableWidth - 2 * COMPACT_ROW_PADDING - 2 * COMPACT_SIDE_WIDTH)
    : Math.max(120, usableWidth - 32);
  // Compact: the biggest cross that fits (names go on the cards' edge when that gives clearly bigger cards).
  const trickCardWidth = compact
    ? fitTrickLayout(trickBoxWidth, trickBoxHeight, 72).cardWidth
    : Math.max(38, Math.min(Math.round(56 * s), Math.floor(maxTrickH / 1.38)));
  const trickCardHeight = Math.round(trickCardWidth * 1.38);

  const oppPanelWidth = Math.round(160 * s);
  const oppPanelHeight = Math.round(52 * s);

  return {
    compact,
    s,
    width,
    height,
    usableWidth,
    usableHeight,
    insets,
    cardWidth,
    cardHeight,
    cardStep,
    handTotalWidth,
    centerPileCardWidth,
    centerPileCardHeight,
    trickCardWidth,
    trickCardHeight,
    trickBoxWidth,
    trickBoxHeight,
    oppPanelWidth,
    oppPanelHeight,
    centerBoxHeight,
    actionBarHeight,
  };
}
