// Pure drag-and-drop maths for the card hands (no react-native import, so vitest can load it).
// The worklet functions also run on the UI thread inside the pan gesture.

/** A drop zone in window coordinates (measureInWindow, same space as the pan's absoluteX/Y). */
export interface DropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Extra room around the zone that still counts as a hit. Generous to the sides and above,
 * small below: the hand sits under the zone, so a card only nudged up must not play.
 */
export interface DropPad {
  x: number;
  top: number;
  bottom: number;
}

/** The held card rides this far above the finger so the finger doesn't hide it. */
export const CARD_DRAG_LIFT = 28;
/** Held card scale (slightly enlarged above the hand). */
export const CARD_DRAG_SCALE = 1.15;
/**
 * Pan activation: an upward move of this many dp starts a drag (the zone is above the hand) ...
 * A short tap moves far less, so it stays a tap.
 */
export const CARD_DRAG_START_UP = 10;
/** ... any other direction needs this much, so a sideways brush or a shaky tap in the fan stays a tap. */
export const CARD_DRAG_START_OTHER = 28;

/** True when the point (the held card's centre) lands on the zone, its pad included. */
export function hitDropZone(rect: DropRect | null, px: number, py: number, pad: DropPad): boolean {
  'worklet';
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  return (
    px >= rect.x - pad.x &&
    px <= rect.x + rect.width + pad.x &&
    py >= rect.y - pad.top &&
    py <= rect.y + rect.height + pad.bottom
  );
}

/**
 * Where the held card's centre is on screen. `grabX/grabY` is where the finger took the card,
 * measured from the card's centre; the card is drawn `lift` dp above the finger.
 */
export function heldCardCentre(absX: number, absY: number, grabX: number, grabY: number, lift: number): { x: number; y: number } {
  'worklet';
  return { x: absX - grabX, y: absY - lift - grabY };
}

/** Pişti pile: small target, so a wide pad (the pile plus about a card all round, little below). */
export function pistiDropPad(cardWidth: number): DropPad {
  const w = Math.max(40, Math.round(cardWidth * 0.8));
  return { x: w, top: w, bottom: 8 };
}

/** Batak trick cross: already the whole table centre, a small pad is enough. */
export function trickDropPad(cardWidth: number): DropPad {
  const w = Math.max(16, Math.round(cardWidth * 0.3));
  return { x: w, top: w, bottom: 4 };
}

/**
 * May this hand card be picked up? Only on my turn, only a card the rules allow
 * (the same list the hand uses to dim cards), and only when the screen takes drops.
 */
export function canDragCard(
  cardId: number,
  canPlay: boolean,
  playableCardIds: readonly number[] | undefined,
  dropsEnabled: boolean,
): boolean {
  if (!dropsEnabled || !canPlay) return false;
  return playableCardIds ? playableCardIds.includes(cardId) : true;
}
