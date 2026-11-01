import { COLORS, type OkeyInfo, type Tile, faceOf, isJoker } from './tiles';

/**
 * Düz okey hand checks. A hand finishes when every tile is in a meld (sets and
 * runs, as in 101) or when it is seven pairs. Jokers (real okeys) fill any
 * slot; fake okeys play as the okey's own face.
 */

const keyOf = (colorIdx: number, value: number) => colorIdx * 13 + value - 1;

function countFaces(tiles: Tile[], okey: OkeyInfo) {
  const counts = new Array<number>(52).fill(0);
  let jokers = 0;
  for (const t of tiles) {
    if (isJoker(t, okey)) jokers++;
    else {
      const f = faceOf(t, okey)!;
      counts[keyOf(COLORS.indexOf(f.color), f.value)]++;
    }
  }
  return { counts, jokers };
}

/**
 * Most tiles of `tiles` that can be covered by disjoint melds. The search
 * takes the lowest remaining tile and either leaves it out or puts it in
 * every set or run it can belong to; `nodeLimit` bounds the work for bots.
 */
export function meldCover(tiles: Tile[], okey: OkeyInfo, nodeLimit = 200_000): number {
  const { counts, jokers } = countFaces(tiles, okey);
  let left = tiles.length - jokers;
  let best = 0;
  let nodes = 0;

  const dfs = (from: number, covered: number, J: number) => {
    if (covered > best) best = covered;
    if (++nodes > nodeLimit || covered + left + J <= best) return;
    let k = from;
    while (k < 52 && counts[k] === 0) k++;
    if (k === 52) return;
    const c = Math.floor(k / 13);
    const v = (k % 13) + 1;

    counts[k]--;
    left--;
    // Sets with this tile: any of the other colours (real if held, else a joker), 3-4 tiles.
    const others = [0, 1, 2, 3].filter((o) => o !== c);
    for (let mask = 1; mask < 8; mask++) {
      const pick = others.filter((_, i) => mask & (1 << i));
      if (pick.length < 2) continue;
      const reals = pick.filter((o) => counts[keyOf(o, v)] > 0);
      const need = pick.length - reals.length;
      if (need > J) continue;
      for (const o of reals) counts[keyOf(o, v)]--;
      left -= reals.length;
      dfs(k, covered + 1 + pick.length, J - need);
      left += reals.length;
      for (const o of reals) counts[keyOf(o, v)]++;
    }
    // Runs with this tile: it is the lowest real tile of its colour left, so
    // anything below it is a joker; above it a held tile is always used first.
    for (let low = v; low >= Math.max(1, v - J); low--) {
      const below = v - low;
      const used: number[] = [];
      let need = below;
      for (let high = v + 1; high <= 13 && need <= J; high++) {
        const hk = keyOf(c, high);
        if (counts[hk] > 0) {
          counts[hk]--;
          used.push(hk);
        } else need++;
        if (need > J) break;
        if (high - low + 1 >= 3) {
          left -= used.length;
          dfs(k, covered + high - low + 1, J - need);
          left += used.length;
        }
      }
      for (const hk of used) counts[hk]++;
    }
    // Or leave it out of every meld.
    dfs(k, covered, J);
    left++;
    counts[k]++;
  };
  dfs(0, 0, jokers);
  return best;
}

/** Seven pairs: two of the same colour and number; a joker pairs with anything. */
export function isSevenPairs(tiles: Tile[], okey: OkeyInfo): boolean {
  if (tiles.length !== 14) return false;
  const { counts, jokers } = countFaces(tiles, okey);
  const singles = counts.reduce((s, n) => s + (n % 2), 0);
  return singles <= jokers;
}

export type FinishShape = 'melds' | 'pairs';

/** How these 14 tiles finish a düz okey hand, or null when they don't. */
export function finishShape(tiles: Tile[], okey: OkeyInfo): FinishShape | null {
  if (tiles.length !== 14) return null;
  // Pairs pay double, so they win when a hand reads both ways.
  if (isSevenPairs(tiles, okey)) return 'pairs';
  if (meldCover(tiles, okey) === 14) return 'melds';
  return null;
}

/**
 * Which tile to throw to finish from a 15-tile hand. Finishing by throwing the
 * okey pays double, so that is tried first. Null when the hand can't finish.
 */
export function findFinish(hand: Tile[], okey: OkeyInfo): { tileId: number; shape: FinishShape } | null {
  if (hand.length !== 15) return null;
  const order = [...hand].sort((a, b) => Number(isJoker(b, okey)) - Number(isJoker(a, okey)));
  const tried = new Set<string>();
  for (const t of order) {
    // Identical tiles give identical results.
    const f = faceOf(t, okey);
    const face = f ? `${f.color}${f.value}` : 'J';
    if (tried.has(face)) continue;
    tried.add(face);
    const shape = finishShape(
      hand.filter((x) => x.id !== t.id),
      okey,
    );
    if (shape) return { tileId: t.id, shape };
  }
  return null;
}
