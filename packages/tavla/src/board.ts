import type { Board, From, To } from './types';

/**
 * Fast mover-relative position used by move generation and the bots.
 * p[0..25] = the mover: index = pips to bear off (1..24 points, 25 = bar, 0 = borne off).
 * p[26..51] = the opponent in its own relative coordinates (OP + i). Mover's point r is the opponent's 25 - r.
 * White's relative point equals the absolute point; Black's is 25 - absolute.
 */
export type Pos = Int8Array;
export const OP = 26;
export const CHECKERS = 15;

/** A step in mover-relative coordinates: from r (25 = bar) by die d. */
export interface RelStep {
  r: number;
  d: number;
  hit: boolean;
}

export const relOf = (seat: number, point: number): number => (seat === 0 ? point : 25 - point);
export const absFrom = (seat: number, r: number): From => (r === 25 ? 'bar' : relOf(seat, r));
export const absTo = (seat: number, t: number): To => (t <= 0 ? 'off' : relOf(seat, t));

export function initialBoard(): Board {
  const points = new Array<number>(25).fill(0);
  points[24] = 2;
  points[13] = 5;
  points[8] = 3;
  points[6] = 5;
  points[1] = -2;
  points[12] = -5;
  points[17] = -3;
  points[19] = -5;
  return { points, bar: [0, 0], off: [0, 0] };
}

export const copyBoard = (b: Board): Board => ({ points: b.points.slice(), bar: [b.bar[0], b.bar[1]], off: [b.off[0], b.off[1]] });

export function toPos(b: Board, seat: number): Pos {
  const p = new Int8Array(52);
  for (let a = 1; a <= 24; a++) {
    const v = b.points[a];
    if (v > 0) {
      if (seat === 0) p[a] = v;
      else p[OP + a] = v;
    } else if (v < 0) {
      if (seat === 1) p[25 - a] = -v;
      else p[OP + 25 - a] = -v;
    }
  }
  p[25] = b.bar[seat];
  p[0] = b.off[seat];
  p[OP + 25] = b.bar[1 - seat];
  p[OP] = b.off[1 - seat];
  return p;
}

export function fromPos(p: Pos, seat: number): Board {
  const points = new Array<number>(25).fill(0);
  for (let a = 1; a <= 24; a++) {
    const white = seat === 0 ? p[a] : p[OP + a];
    const black = seat === 1 ? p[25 - a] : p[OP + 25 - a];
    points[a] = white - black;
  }
  const bar: [number, number] = [0, 0];
  const off: [number, number] = [0, 0];
  bar[seat] = p[25];
  off[seat] = p[0];
  bar[1 - seat] = p[OP + 25];
  off[1 - seat] = p[OP];
  return { points, bar, off };
}

/** Mover and opponent swapped (the opponent's point of view). */
export function swap(p: Pos): Pos {
  const q = new Int8Array(52);
  q.set(p.subarray(OP, 52), 0);
  q.set(p.subarray(0, OP), OP);
  return q;
}

export function allHome(p: Pos): boolean {
  if (p[25] > 0) return false;
  for (let i = 7; i <= 24; i++) if (p[i] > 0) return false;
  return true;
}

/** True if the mover may move one checker from r by d (bar priority, blocked points, bear-off rules). */
export function canMove(p: Pos, r: number, d: number): boolean {
  if (p[r] <= 0) return false;
  if (p[25] > 0 && r !== 25) return false;
  const t = r - d;
  if (t >= 1) return p[OP + 25 - t] < 2;
  if (!allHome(p)) return false;
  if (t === 0) return true;
  for (let i = r + 1; i <= 6; i++) if (p[i] > 0) return false;
  return true;
}

/** Moves one checker in place (call only after canMove). Returns true on a hit. */
export function doMove(p: Pos, r: number, d: number): boolean {
  p[r]--;
  const t = r - d;
  if (t <= 0) {
    p[0]++;
    return false;
  }
  let hit = false;
  if (p[OP + 25 - t] === 1) {
    p[OP + 25 - t] = 0;
    p[OP + 25]++;
    hit = true;
  }
  p[t]++;
  return hit;
}

/** Takes back doMove(p, r, d) that returned `hit`. */
export function undoMove(p: Pos, r: number, d: number, hit: boolean): void {
  const t = r - d;
  if (t <= 0) p[0]--;
  else {
    p[t]--;
    if (hit) {
      p[OP + 25 - t] = 1;
      p[OP + 25]--;
    }
  }
  p[r]++;
}

export const without = (rem: readonly number[], i: number): number[] => rem.slice(0, i).concat(rem.slice(i + 1));

export function removeDie(rem: readonly number[], d: number): number[] {
  const i = rem.indexOf(d);
  return i < 0 ? rem.slice() : without(rem, i);
}

/** Dice left, as a small number (doubles: how many; two different dice: which one is left). */
export const remSig = (left: readonly number[]): number => left.length * 8 + (left.length === 1 ? left[0] : 0);

/**
 * Exact set of visited nodes keyed by three numbers: the mover's points 0..12 and 13..25 (4 bits each, so each half
 * fits a double exactly) and an extra number (dice left, hits). No strings, no hashing collisions.
 */
export class NodeSet {
  private readonly m = new Map<number, Map<number, Set<number>>>();
  /** Adds the node; false if it was already there. */
  add(q: Pos, extra: number): boolean {
    let lo = 0;
    let hi = 0;
    for (let i = 12; i >= 0; i--) lo = lo * 16 + q[i];
    for (let i = 25; i >= 13; i--) hi = hi * 16 + q[i];
    let a = this.m.get(extra);
    if (!a) {
      a = new Map();
      this.m.set(extra, a);
    }
    let b = a.get(lo);
    if (!b) {
      b = new Set();
      a.set(lo, b);
    }
    if (b.has(hi)) return false;
    b.add(hi);
    return true;
  }
}

/**
 * Most dice the mover can still play from p with `rem`. Bearing off the last checker counts as using every die left
 * (the game is over, nothing remains to be played). Hits never change what the mover can play (a blot is no block),
 * so the mover's half plus the dice left identifies a node exactly.
 */
export function maxPlayable(p: Pos, rem: readonly number[]): number {
  const total = rem.length;
  let best = 0;
  const seen = new NodeSet();
  const q = p.slice();
  const rec = (left: readonly number[], depth: number): boolean => {
    const won = q[0] === CHECKERS;
    const reach = won ? depth + left.length : depth;
    if (reach > best) best = reach;
    if (best === total) return true;
    if (won) return false;
    for (let i = 0; i < left.length; i++) {
      const d = left[i];
      if (left.indexOf(d) !== i) continue;
      const rest = without(left, i);
      const sig = remSig(rest);
      for (let r = 25; r >= 1; r--) {
        if (!canMove(q, r, d)) continue;
        const hit = doMove(q, r, d);
        const fresh = seen.add(q, sig);
        const done = fresh && rec(rest, depth + 1);
        undoMove(q, r, d, hit);
        if (done) return true;
      }
    }
    return false;
  };
  rec(rem, 0);
  return best;
}

export interface Seq {
  steps: RelStep[];
  pos: Pos;
}

/** True if the larger-die rule can apply: two different dice. */
const twoDifferent = (rem: readonly number[]): boolean => rem.length === 2 && rem[0] !== rem[1];

/**
 * Every legal maximal continuation from p with `rem`, one per resulting position. Generation order is deterministic
 * (dice in `rem` order, points from the bar down). Always returns at least one entry (zero steps when nothing moves).
 * Applies the larger-die rule when `rem` holds two different dice.
 */
export function sequences(p: Pos, rem: readonly number[]): Seq[] {
  let leaves: Seq[] = [];
  let best = -1;
  const seen = new NodeSet();
  const q = p.slice();
  const path: RelStep[] = [];
  // The opponent's half only changes by hits, so the set of hit points (opponent-relative) completes the key.
  let hitMask = 0;
  const rec = (left: readonly number[]) => {
    let moved = false;
    if (q[0] !== CHECKERS) {
      for (let i = 0; i < left.length; i++) {
        const d = left[i];
        if (left.indexOf(d) !== i) continue;
        const rest = without(left, i);
        const sig = remSig(rest);
        for (let r = 25; r >= 1; r--) {
          if (!canMove(q, r, d)) continue;
          moved = true;
          const hit = doMove(q, r, d);
          const bit = hit ? 2 ** (25 - (r - d)) : 0;
          hitMask += bit;
          if (seen.add(q, sig + 64 * hitMask)) {
            path.push({ r, d, hit });
            rec(rest);
            path.pop();
          }
          hitMask -= bit;
          undoMove(q, r, d, hit);
        }
      }
    }
    if (!moved) {
      const len = q[0] === CHECKERS ? path.length + left.length : path.length;
      if (len > best) {
        best = len;
        leaves = [];
      }
      if (len === best) leaves.push({ steps: path.slice(), pos: q.slice() });
    }
  };
  rec(rem);
  if (best === 1 && twoDifferent(rem)) {
    const hi = Math.max(rem[0], rem[1]);
    const big = leaves.filter(l => l.steps[0].d === hi);
    if (big.length > 0) return big;
  }
  return leaves;
}

/** Pip count of the mover in p (bar = 25). */
export function pips(p: Pos, base = 0): number {
  let s = 0;
  for (let r = 1; r <= 25; r++) s += r * p[base + r];
  return s;
}

export function boardPips(b: Board, seat: number): number {
  return pips(toPos(b, seat));
}
