export const COLORS = ['red', 'yellow', 'blue', 'black'] as const;
export type Color = (typeof COLORS)[number];

export interface NormalTile {
  id: number;
  kind: 'normal';
  color: Color;
  value: number; // 1..13
}

export interface FakeOkeyTile {
  id: number;
  kind: 'fake';
}

export type Tile = NormalTile | FakeOkeyTile;

/** The face a tile shows once the okey of the round is known. */
export interface OkeyInfo {
  color: Color;
  value: number;
}

export type Rng = () => number;

/** 106 tiles: 4 colours x 1..13 x 2 sets + 2 fake okeys. */
export function createTileSet(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  for (let set = 0; set < 2; set++) {
    for (const color of COLORS) {
      for (let value = 1; value <= 13; value++) {
        tiles.push({ id: id++, kind: 'normal', color, value });
      }
    }
  }
  tiles.push({ id: id++, kind: 'fake' });
  tiles.push({ id: id++, kind: 'fake' });
  return tiles;
}

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deterministic PRNG (mulberry32) for tests and reproducible games. */
export function seededRng(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Okey is the tile one above the indicator, same colour; 13 wraps to 1. */
export function okeyFromIndicator(indicator: NormalTile): OkeyInfo {
  return { color: indicator.color, value: indicator.value === 13 ? 1 : indicator.value + 1 };
}

/** True when the tile is the real okey, i.e. a joker. */
export function isJoker(tile: Tile, okey: OkeyInfo): boolean {
  return tile.kind === 'normal' && tile.color === okey.color && tile.value === okey.value;
}

/**
 * The colour/value a non-joker tile stands for. A fake okey stands for the
 * okey tile's own face. Returns null for jokers.
 */
export function faceOf(tile: Tile, okey: OkeyInfo): OkeyInfo | null {
  if (isJoker(tile, okey)) return null;
  if (tile.kind === 'fake') return { color: okey.color, value: okey.value };
  return { color: tile.color, value: tile.value };
}

/** Penalty value of a tile left in hand. */
export function penaltyValue(tile: Tile, okey: OkeyInfo): number {
  if (isJoker(tile, okey)) return 101;
  return faceOf(tile, okey)!.value;
}
