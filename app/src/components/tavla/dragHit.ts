// Drag-and-drop hit-testing for the Tavla board. Pure maths on TavlaGeom (no react-native import), so vitest
// can load it; every function is a worklet because the drag runs it on the UI thread on each finger move.
import type { Board, CheckerMove, From, To } from '@kahve/tavla';
import { countAt, movableFroms, stackShown, targetsFor } from './boardMath';
import { type TavlaGeom, slotCenter } from './tavlaGeometry';

/**
 * A place on the board as one number, so the UI thread can compare it cheaply:
 * 1..24 a point, PLACE_OFF the bear-off tray, PLACE_BAR the viewer's half of the bar, PLACE_NONE nothing.
 */
export type PlaceKey = number;
export const PLACE_NONE = 0;
export const PLACE_OFF = 25;
export const PLACE_BAR = 26;

export const keyOfFrom = (f: From): PlaceKey => (f === 'bar' ? PLACE_BAR : f);
export const keyOfTo = (t: To): PlaceKey => (t === 'off' ? PLACE_OFF : t);
export const fromOfKey = (k: PlaceKey): From => (k === PLACE_BAR ? 'bar' : k);
export const toOfKey = (k: PlaceKey): To => (k === PLACE_OFF ? 'off' : k);

export interface PlaceRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A finger this far outside the inner board (dp, in colW) still counts as on its edge. */
const EDGE_SLACK = 0.5;
/** A drop this close to a legal target (in colW) still lands there: shaky hands miss by a little. */
const NEAR_MISS = 0.4;

/**
 * The place under a point of the inner board (x, y in dp from its top-left). Each point owns its whole half-column
 * (top or bottom half of the board, so the gap between the rows splits in the middle); the bar column counts only on
 * the viewer's (bottom) half; the tray column is the bear-off tray from top to bottom. The board flips with `viewer`
 * exactly like pointCell (seat 1 sees point 24 bottom-right).
 */
export function placeAt(g: TavlaGeom, viewer: number, x: number, y: number): PlaceKey {
  'worklet';
  const slack = g.colW * EDGE_SLACK;
  if (x < -slack || y < -slack || x > g.boardW + slack || y > g.boardH + slack) return PLACE_NONE;
  const cx = Math.min(Math.max(x, 0), g.boardW - 0.001);
  const cy = Math.min(Math.max(y, 0), g.boardH - 0.001);
  const bottom = cy >= g.boardH / 2;
  const barL = 6 * g.colW;
  const trayL = 12 * g.colW + g.barW;
  if (cx >= trayL) return PLACE_OFF;
  if (cx >= barL && cx < barL + g.barW) return bottom ? PLACE_BAR : PLACE_NONE;
  const raw = cx < barL ? Math.floor(cx / g.colW) : 6 + Math.floor((cx - barL - g.barW) / g.colW);
  const col = Math.min(11, Math.max(0, raw));
  // cellPoint: the low points (1..12) are on the bottom row for seat 0, on the top row for seat 1.
  const lowRow = viewer === 1 ? !bottom : bottom;
  return lowRow ? 12 - col : 13 + col;
}

/** The touch area of a place inside the inner board: the same half-column placeAt uses. */
export function placeRect(g: TavlaGeom, viewer: number, k: PlaceKey): PlaceRect {
  'worklet';
  const half = g.boardH / 2;
  if (k === PLACE_OFF) return { x: 12 * g.colW + g.barW, y: 0, w: g.trayW, h: g.boardH };
  if (k === PLACE_BAR) return { x: 6 * g.colW, y: half, w: g.barW, h: half };
  const low = k <= 12;
  const col = low ? 12 - k : k - 13;
  const bottom = viewer === 1 ? !low : low;
  const x = col < 6 ? col * g.colW : 6 * g.colW + g.barW + (col - 6) * g.colW;
  return { x, y: bottom ? half : 0, w: g.colW, h: half };
}

/** The checker a finger picks up at (x, y): one of `froms` (place keys), or PLACE_NONE. */
export function pickAt(g: TavlaGeom, viewer: number, x: number, y: number, froms: readonly PlaceKey[]): PlaceKey {
  'worklet';
  const k = placeAt(g, viewer, x, y);
  return k !== PLACE_NONE && froms.indexOf(k) >= 0 ? k : PLACE_NONE;
}

/**
 * Where a checker dropped at (x, y) lands: one of `targets` (place keys), or PLACE_NONE. A drop right on a target wins;
 * otherwise the nearest target whose area is within NEAR_MISS colW of the drop.
 */
export function dropAt(g: TavlaGeom, viewer: number, x: number, y: number, targets: readonly PlaceKey[]): PlaceKey {
  'worklet';
  if (targets.length === 0) return PLACE_NONE;
  const k = placeAt(g, viewer, x, y);
  if (k !== PLACE_NONE && targets.indexOf(k) >= 0) return k;
  const limit = g.colW * NEAR_MISS;
  let best = PLACE_NONE;
  let bestD = limit;
  for (let i = 0; i < targets.length; i++) {
    const r = placeRect(g, viewer, targets[i]);
    const dx = x < r.x ? r.x - x : x > r.x + r.w ? x - r.x - r.w : 0;
    const dy = y < r.y ? r.y - y : y > r.y + r.h ? y - r.y - r.h : 0;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= bestD) {
      best = targets[i];
      bestD = d;
    }
  }
  return best;
}

/** One checker the player may drag: where its top checker sits, and where each legal drop puts it. */
export interface DragEntry {
  from: PlaceKey;
  /** Centre of the checker that is picked up (inner-board dp): it glides back here after a missed drop. */
  x: number;
  y: number;
  targets: { k: PlaceKey; x: number; y: number }[];
}

/**
 * Everything the UI thread needs for a drag this turn, built from the same `moves` the tap flow reads
 * (movableFroms / targetsFor), so a drag can only offer what a tap offers. Empty when `moves` is empty.
 */
export function dragPlan(g: TavlaGeom, viewer: number, board: Board, seat: number, moves: CheckerMove[]): DragEntry[] {
  if (seat < 0) return [];
  const out: DragEntry[] = [];
  for (const from of movableFroms(moves)) {
    let origin: { x: number; y: number };
    if (from === 'bar') {
      const n = Math.min(board.bar[seat], 4);
      if (n <= 0) continue;
      origin = slotCenter(g, viewer, { k: 'bar', seat }, n - 1);
    } else {
      const { shown } = stackShown(countAt(board, seat, from));
      if (shown <= 0) continue;
      origin = slotCenter(g, viewer, { k: 'point', n: from }, shown - 1);
    }
    const targets: DragEntry['targets'] = [];
    for (const to of targetsFor(moves, from).keys()) {
      // Same landing slot as the target chip: the next free slot of an own stack, the first one on an empty point or a hit.
      const c =
        to === 'off'
          ? slotCenter(g, viewer, { k: 'off', seat }, board.off[seat])
          : slotCenter(g, viewer, { k: 'point', n: to }, Math.min(countAt(board, seat, to), 4));
      targets.push({ k: keyOfTo(to), x: c.x, y: c.y });
    }
    out.push({ from: keyOfFrom(from), x: origin.x, y: origin.y, targets });
  }
  return out;
}
