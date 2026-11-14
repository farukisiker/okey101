import { COLORS, type OkeyInfo, type Tile, faceOf, isJoker } from './tiles';

/** 'pair': two identical tiles, laid only by a player who opened with pairs (101). */
export type MeldType = 'set' | 'run' | 'pair';

export interface MeldAnalysis {
  type: MeldType;
  points: number;
  /** Tile ids in display order (runs ascending, jokers at the slot they fill). */
  ordered: number[];
  /** What each tile stands for on the table (jokers resolved). */
  represents: Record<number, OkeyInfo>;
}

/**
 * Validates a group of tiles as a set (same number, different colours, 3-4
 * tiles) or a run (same colour, consecutive, at least 3, no 13-1 wrap).
 * Order of the input does not matter. Jokers (real okeys) fill any gap; fake
 * okeys play as the okey's own face. When both readings are valid the one
 * worth more points wins.
 */
export function analyzeMeld(tiles: Tile[], okey: OkeyInfo): MeldAnalysis | null {
  if (tiles.length < 3 || new Set(tiles.map((t) => t.id)).size !== tiles.length) return null;
  const jokers = tiles.filter((t) => isJoker(t, okey));
  const reals = tiles
    .filter((t) => !isJoker(t, okey))
    .map((t) => ({ id: t.id, face: faceOf(t, okey)! }));
  if (reals.length === 0) return null;

  const candidates = [analyzeSet(reals, jokers), analyzeRun(reals, jokers)].filter(
    (m): m is MeldAnalysis => m !== null,
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.points > a.points ? b : a));
}

interface Real {
  id: number;
  face: OkeyInfo;
}

function analyzeSet(reals: Real[], jokers: Tile[]): MeldAnalysis | null {
  const total = reals.length + jokers.length;
  if (total < 3 || total > 4) return null;
  const value = reals[0].face.value;
  if (reals.some((r) => r.face.value !== value)) return null;
  const colors = new Set(reals.map((r) => r.face.color));
  if (colors.size !== reals.length) return null;

  const represents: Record<number, OkeyInfo> = {};
  for (const r of reals) represents[r.id] = r.face;
  const missing = COLORS.filter((c) => !colors.has(c));
  jokers.forEach((j, i) => (represents[j.id] = { color: missing[i], value }));
  const ordered = [...reals.map((r) => r.id), ...jokers.map((j) => j.id)];
  return { type: 'set', points: value * total, ordered, represents };
}

function analyzeRun(reals: Real[], jokers: Tile[]): MeldAnalysis | null {
  const color = reals[0].face.color;
  if (reals.some((r) => r.face.color !== color)) return null;
  const values = reals.map((r) => r.face.value).sort((a, b) => a - b);
  for (let i = 1; i < values.length; i++) if (values[i] === values[i - 1]) return null;

  const total = reals.length + jokers.length;
  if (total < 3 || total > 13) return null;
  let low = values[0];
  let high = values[values.length - 1];
  const gaps = high - low + 1 - reals.length;
  if (gaps > jokers.length) return null;
  // Spare jokers extend the run upward first (worth more), then downward.
  let spare = jokers.length - gaps;
  while (spare > 0 && high < 13) {
    high++;
    spare--;
  }
  while (spare > 0 && low > 1) {
    low--;
    spare--;
  }
  if (spare > 0) return null;

  const represents: Record<number, OkeyInfo> = {};
  const ordered: number[] = [];
  const byValue = new Map(reals.map((r) => [r.face.value, r.id]));
  let j = 0;
  let points = 0;
  for (let v = low; v <= high; v++) {
    const id = byValue.get(v) ?? jokers[j++].id;
    represents[id] = { color, value: v };
    ordered.push(id);
    points += v;
  }
  return { type: 'run', points, ordered, represents };
}

export function meldPoints(groups: Tile[][], okey: OkeyInfo): number | null {
  let sum = 0;
  for (const g of groups) {
    const m = analyzeMeld(g, okey);
    if (!m) return null;
    sum += m.points;
  }
  return sum;
}

/**
 * Tiles in a hand that can be added to melds on the table ("işlek" tiles):
 * tile id -> ids of the melds that accept it. Jokers are left out; they fit
 * almost anywhere and are better kept.
 */
export function addableTiles(
  hand: Tile[],
  table: { id: number; type: MeldType; tiles: Tile[] }[],
  okey: OkeyInfo,
): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const tile of hand) {
    if (isJoker(tile, okey)) continue;
    const fits = table
      .filter((m) => m.type !== 'pair' && analyzeMeld([...m.tiles, tile], okey)?.type === m.type)
      .map((m) => m.id);
    if (fits.length) out.set(tile.id, fits);
  }
  return out;
}

/** 101 opens with pairs: at least this many, laid in one turn instead of 101 points. */
export const PAIRS_TO_OPEN = 5;

/**
 * Two identical tiles (same colour and number) as a pair. The okey pairs with
 * any tile and stands for its partner; two okeys stand for the okey itself.
 * Pairs carry no points: tile values don't count toward opening.
 */
export function analyzePair(tiles: Tile[], okey: OkeyInfo): MeldAnalysis | null {
  if (tiles.length !== 2 || tiles[0].id === tiles[1].id) return null;
  const [a, b] = tiles.map((t) => faceOf(t, okey));
  if (a && b && (a.color !== b.color || a.value !== b.value)) return null;
  const face = a ?? b ?? { color: okey.color, value: okey.value };
  const ordered = tiles.map((t) => t.id);
  return { type: 'pair', points: 0, ordered, represents: { [ordered[0]]: face, [ordered[1]]: face } };
}

/**
 * As many disjoint pairs as the hand holds: identical tiles first, then each
 * okey with the highest leftover single (it would cost the most in hand),
 * then spare okeys with each other. `preferTileId` is used first when it can be,
 * and its pair comes first in the list.
 */
export function findPairs(hand: Tile[], okey: OkeyInfo, preferTileId?: number): Tile[][] {
  const byFace = new Map<string, Tile[]>();
  const jokers: Tile[] = [];
  for (const t of hand) {
    const f = faceOf(t, okey);
    if (!f) jokers.push(t);
    else {
      const k = f.color + f.value;
      const list = byFace.get(k) ?? [];
      if (t.id === preferTileId) list.unshift(t);
      else list.push(t);
      byFace.set(k, list);
    }
  }
  const pairs: Tile[][] = [];
  const singles: Tile[] = [];
  for (const list of byFace.values()) {
    for (let i = 0; i + 1 < list.length; i += 2) pairs.push([list[i], list[i + 1]]);
    if (list.length % 2) singles.push(list[list.length - 1]);
  }
  const value = (t: Tile) => (t.id === preferTileId ? 100 : faceOf(t, okey)!.value);
  singles.sort((x, y) => value(y) - value(x));
  while (jokers.length && singles.length) pairs.push([singles.shift()!, jokers.shift()!]);
  while (jokers.length >= 2) pairs.push([jokers.shift()!, jokers.shift()!]);
  // The pair with the preferred tile first, so it is laid even when the list gets cut.
  const has = (pr: Tile[]) => (pr.some((t) => t.id === preferTileId) ? 0 : 1);
  return pairs.sort((x, y) => has(x) - has(y));
}
