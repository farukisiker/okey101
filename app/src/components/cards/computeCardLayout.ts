// Pure card-game layout maths (no react-native import, so vitest can load it).
export interface CardGameLayout {
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

  /** Action bar height */
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

  // Header consumed by GameShell (top bar ~56-64dp + opponents ~48-52dp + status line ~28-36dp)
  const shellHeaderHeight = Math.round(144 * Math.min(1.2, s));
  const availableGameHeight = Math.max(180, usableHeight - shellHeaderHeight);
  const isCompactHeight = availableGameHeight < 280;

  // Action bar height (>= 56 dp touch target for 60+ ergonomics)
  const actionBarHeight = Math.max(56, Math.round(56 * s));

  // Available vertical space for center section + Hand cards
  const remainingCardsHeight = Math.max(120, availableGameHeight - actionBarHeight);

  let cardWidth: number;
  let cardStep: number;

  if (handCount <= 4) {
    // Pişti style (4 cards, no overlap needed)
    const maxHandH = isCompactHeight ? Math.floor(remainingCardsHeight * 0.44) : 140;
    const maxHandW = Math.floor(maxHandH / 1.38);
    const targetWidth = Math.min(Math.round(68 * s), Math.floor((usableWidth - 64) / Math.max(1, handCount)));
    cardWidth = Math.max(46, Math.min(targetWidth, maxHandW));
    cardStep = cardWidth + Math.round(12 * s);
  } else {
    // Batak style (up to 13 cards, slight overlap on compact screens)
    const maxHandH = isCompactHeight ? Math.floor(remainingCardsHeight * 0.42) : 120;
    const maxHandW = Math.floor(maxHandH / 1.38);
    const baseWidth = Math.max(40, Math.min(Math.round(56 * s), maxHandW));
    const maxAvailableStep = Math.floor((usableWidth - 32 - baseWidth) / Math.max(1, handCount - 1));
    cardWidth = baseWidth;
    cardStep = Math.min(baseWidth + 4, Math.max(40, maxAvailableStep));
  }

  const cardHeight = Math.round(cardWidth * 1.38);
  const handTotalWidth = handCount > 0 ? (handCount - 1) * cardStep + cardWidth : 0;

  // Center pile (Pişti)
  const maxCenterPileH = isCompactHeight ? Math.floor(remainingCardsHeight * 0.48) : Math.round(90 * s);
  const centerPileCardWidth = Math.max(42, Math.min(Math.round(64 * s), Math.floor(maxCenterPileH / 1.38)));
  const centerPileCardHeight = Math.round(centerPileCardWidth * 1.38);

  // Trick area (Batak)
  const maxTrickH = isCompactHeight ? Math.floor(remainingCardsHeight * 0.46) : Math.round(80 * s);
  const trickCardWidth = Math.max(38, Math.min(Math.round(56 * s), Math.floor(maxTrickH / 1.38)));
  const trickCardHeight = Math.round(trickCardWidth * 1.38);

  // The hand row is cardHeight + ~26 dp (padding); the trick area gets what is left above the action bar.
  const trickBoxHeight = Math.max(60, availableGameHeight - actionBarHeight - (cardHeight + 26));
  const trickBoxWidth = Math.max(120, usableWidth - 32);

  const oppPanelWidth = Math.round(160 * s);
  const oppPanelHeight = Math.round(52 * s);

  return {
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
    actionBarHeight,
  };
}
