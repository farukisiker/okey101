import { COLORS, type OkeyInfo, type Tile, faceOf, isJoker } from './tiles';

export type MeldType = 'set' | 'run';

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
    const fits = table.filter((m) => analyzeMeld([...m.tiles, tile], okey)?.type === m.type).map((m) => m.id);
    if (fits.length) out.set(tile.id, fits);
  }
  return out;
}
