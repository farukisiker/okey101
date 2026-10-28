import { COLORS, type OkeyInfo, type Tile, faceOf, isJoker } from './tiles';

/**
 * Finds a set of disjoint melds in a hand that maximises total points.
 * Used by bots and for hints. Bounded search: fast but not guaranteed
 * optimal for pathological hands.
 */
export interface SolveOptions {
  /** Upper bound on how many tiles the melds may use (e.g. keep one to discard). */
  maxTiles?: number;
  /** Prefer this tile id when choosing among identical copies. */
  preferTileId?: number;
  nodeLimit?: number;
}

export interface SolveResult {
  melds: Tile[][];
  points: number;
}

interface Candidate {
  keys: number[]; // indexes into counts (colorIdx * 13 + value - 1)
  jokers: number;
  points: number;
}

const keyOf = (colorIdx: number, value: number) => colorIdx * 13 + value - 1;

export function findBestMelds(hand: Tile[], okey: OkeyInfo, opts: SolveOptions = {}): SolveResult {
  const maxTiles = opts.maxTiles ?? hand.length;
  const nodeLimit = opts.nodeLimit ?? 40000;

  const pools: Tile[][] = Array.from({ length: 52 }, () => []);
  const jokerTiles: Tile[] = [];
  for (const t of hand) {
    if (isJoker(t, okey)) jokerTiles.push(t);
    else {
      const f = faceOf(t, okey)!;
      pools[keyOf(COLORS.indexOf(f.color), f.value)].push(t);
    }
  }
  if (opts.preferTileId !== undefined) {
    for (const p of [...pools, jokerTiles]) {
      const i = p.findIndex((t) => t.id === opts.preferTileId);
      if (i > 0) p.unshift(...p.splice(i, 1));
    }
  }

  const counts = pools.map((p) => p.length);
  const J = jokerTiles.length;
  const candidates = buildCandidates(counts, J);
  candidates.sort((a, b) => b.points - a.points);

  let remainingValue = 0;
  for (let k = 0; k < 52; k++) remainingValue += counts[k] * ((k % 13) + 1);

  let best: Candidate[] = [];
  let bestPoints = 0;
  const chosen: Candidate[] = [];
  let nodes = 0;
  let jokersLeft = J;
  let tilesUsed = 0;

  const dfs = (start: number, points: number) => {
    if (++nodes > nodeLimit) return;
    if (points > bestPoints) {
      bestPoints = points;
      best = chosen.slice();
    }
    if (points + remainingValue + jokersLeft * 13 <= bestPoints) return;
    for (let i = start; i < candidates.length; i++) {
      const c = candidates[i];
      const size = c.keys.length + c.jokers;
      if (c.jokers > jokersLeft || tilesUsed + size > maxTiles) continue;
      if (!fits(counts, c.keys)) continue;
      for (const k of c.keys) {
        counts[k]--;
        remainingValue -= (k % 13) + 1;
      }
      jokersLeft -= c.jokers;
      tilesUsed += size;
      chosen.push(c);
      dfs(i, points + c.points);
      chosen.pop();
      tilesUsed -= size;
      jokersLeft += c.jokers;
      for (const k of c.keys) {
        counts[k]++;
        remainingValue += (k % 13) + 1;
      }
    }
  };
  dfs(0, 0);

  // Map abstract candidates back to concrete tiles.
  const taken = new Array(52).fill(0);
  let jokerIdx = 0;
  const melds = best.map((c) => {
    const tiles: Tile[] = c.keys.map((k) => pools[k][taken[k]++]);
    for (let n = 0; n < c.jokers; n++) tiles.push(jokerTiles[jokerIdx++]);
    return tiles;
  });
  return { melds, points: bestPoints };
}

function fits(counts: number[], keys: number[]): boolean {
  // keys within a candidate are distinct, so a simple check suffices
  for (const k of keys) if (counts[k] <= 0) return false;
  return true;
}

function buildCandidates(counts: number[], J: number): Candidate[] {
  const out: Candidate[] = [];
  // Runs: same colour, consecutive, no wrap.
  for (let c = 0; c < 4; c++) {
    for (let s = 1; s <= 11; s++) {
      const keys: number[] = [];
      let missing = 0;
      let points = 0;
      for (let e = s; e <= 13; e++) {
        const k = keyOf(c, e);
        if (counts[k] > 0) keys.push(k);
        else missing++;
        if (missing > J) break;
        points += e;
        if (e - s + 1 >= 3 && keys.length > 0) {
          out.push({ keys: keys.slice(), jokers: missing, points });
        }
      }
    }
  }
  // Sets: same value, distinct colours, 3 or 4 tiles.
  const subsets = [
    [0, 1, 2, 3],
    [0, 1, 2],
    [0, 1, 3],
    [0, 2, 3],
    [1, 2, 3],
  ];
  for (let v = 1; v <= 13; v++) {
    for (const sub of subsets) {
      const keys = sub.map((c) => keyOf(c, v)).filter((k) => counts[k] > 0);
      const missing = sub.length - keys.length;
      if (keys.length > 0 && missing <= J) {
        out.push({ keys, jokers: missing, points: v * sub.length });
      }
    }
  }
  return out;
}
