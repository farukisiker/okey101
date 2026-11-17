import { randomInt, type BotLevel, type Rng } from '@kahve/core';
import { CHECKERS, NodeSet, OP, absFrom, canMove, doMove, remSig, sequences, swap, toPos, undoMove, without, type Pos, type Seq } from './board';
import { turnCtx } from './rules';
import type { TavlaAction, TavlaState } from './types';

/** Rolls (of 36) that hit a blot at this distance with no blocking points: direct and combined shots. */
const SHOTS = [0, 11, 12, 14, 15, 15, 17, 6, 6, 5, 3, 2, 3, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1];
/** Value of a made point by mover-relative number (home 1..6, the 7/8 bar points, anchors in the far home). */
const POINT = [0, 1, 2, 3, 4.5, 5, 5, 4.5, 3, 2, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 1.5, 2, 2, 1.5, 1];
const WIN = 1000;

/** One side's positional score: points and primes, blot risk, its own bar, the opponent on the bar. */
function side(p: Pos, m: number, o: number): number {
  let s = 0;
  let run = 0;
  let bestRun = 0;
  let homePoints = 0;
  let blots = 0;
  for (let r = 1; r <= 24; r++) {
    const n = p[m + r];
    if (n >= 2) {
      s += POINT[r];
      if (++run > bestRun) bestRun = run;
      if (r <= 6) homePoints++;
      if (n > 4) s -= (n - 4) * 0.4;
    } else {
      run = 0;
      if (n === 1) blots++;
    }
  }
  if (bestRun >= 3) s += (bestRun - 2) * (bestRun - 2) * 2.5;
  if (blots > 0) {
    // Opponent checkers in our coordinates (its point q is our 25 - q, its bar our 0); they move up towards our blots.
    const shooters: number[] = [];
    for (let x = 0; x < 24; x++) if (p[o + 25 - x] > 0) shooters.push(x);
    for (let r = 1; r <= 24; r++) {
      if (p[m + r] !== 1) continue;
      let miss = 1;
      for (const x of shooters) {
        if (x >= r) break;
        const shots = SHOTS[r - x];
        if (shots > 0) miss *= 1 - shots / 36;
      }
      if (miss < 1) s -= (1 - miss) * (4 + (25 - r) * 0.6);
    }
  }
  s -= p[m + 25] * 4;
  s += p[o + 25] * (1 + homePoints * 1.5);
  return s;
}

function highest(p: Pos, m: number): number {
  for (let r = 25; r >= 1; r--) if (p[m + r] > 0) return r;
  return 0;
}

/** Position score for the side in p[0..25] (antisymmetric: eval(swap(p)) === -eval(p)). */
export function evaluate(p: Pos): number {
  if (p[0] === CHECKERS) return WIN;
  if (p[OP] === CHECKERS) return -WIN;
  let myPip = 0;
  let opPip = 0;
  for (let r = 1; r <= 25; r++) {
    myPip += r * p[r];
    opPip += r * p[OP + r];
  }
  if (highest(p, 0) + highest(p, OP) <= 25) return opPip - myPip; // no contact: a pure race
  return (opPip - myPip) * 0.6 + side(p, 0, OP) - side(p, OP, 0);
}

/** The 21 distinct rolls with their weight out of 36. */
const ROLLS: [number[], number][] = [];
for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) ROLLS.push(a === b ? [[a, a, a, a], 1] : [[a, b], 2]);

/**
 * The value of the opponent's best reply to `dice` from its point of view (maximal sequences only, larger-die rule).
 * A lean copy of `sequences` with make/unmake and no paths. Nodes are deduplicated by the mover's half and the dice
 * left; two paths that end alike but hit different blots count once (a harmless approximation for a heuristic).
 */
function bestReply(p: Pos, dice: readonly number[], budget: Budget): number {
  let bestLen = -1;
  let bestVal = -Infinity;
  let bigVal = -Infinity;
  const two = dice.length === 2 && dice[0] !== dice[1];
  const hi = two ? Math.max(dice[0], dice[1]) : 0;
  const seen = new NodeSet();
  const q = p.slice();
  const rec = (left: readonly number[], depth: number, first: number) => {
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
          if (--budget.nodes < 0) return;
          const hit = doMove(q, r, d);
          if (seen.add(q, sig)) rec(rest, depth + 1, depth === 0 ? d : first);
          undoMove(q, r, d, hit);
        }
      }
    }
    if (moved) return;
    const len = q[0] === CHECKERS ? depth + left.length : depth;
    if (len < bestLen) return;
    const v = evaluate(q);
    if (len > bestLen) {
      bestLen = len;
      bestVal = -Infinity;
      bigVal = -Infinity;
    }
    if (v > bestVal) bestVal = v;
    if (first === hi && v > bigVal) bigVal = v;
  };
  rec(dice, 0, 0);
  if (budget.nodes < 0) return NaN;
  return two && bestLen === 1 && bigVal > -Infinity ? bigVal : bestVal;
}

/** Search nodes the hard bot may spend per botMove call. Counted, not timed, so the choice stays deterministic. */
export const HARD_NODES = 8000;
interface Budget {
  nodes: number;
}

/** Expected score after our move over the opponent's 21 rolls and its best reply to each; NaN if the budget ran out. */
function expectation(p: Pos, budget: Budget): number {
  if (p[0] === CHECKERS) return WIN;
  const opp = swap(p);
  let sum = 0;
  for (const [dice, w] of ROLLS) {
    const v = bestReply(opp, dice, budget);
    if (Number.isNaN(v)) return NaN;
    sum += w * -v;
  }
  return sum / 36;
}

/** Candidates the hard bot looks one roll ahead for (best by the medium evaluation). */
export const HARD_WIDTH = 4;

function choose(cands: Seq[], level: BotLevel, rng: Rng): Seq {
  if (cands.length === 1) return cands[0];
  if (level === 'easy') return cands[randomInt(rng, cands.length)];
  const scored = cands.map((c, i) => ({ c, i, v: evaluate(c.pos) }));
  scored.sort((a, b) => b.v - a.v || a.i - b.i);
  if (level === 'medium') return scored[0].c;
  // A race needs no lookahead: the pip count decides.
  const top = scored[0].c.pos;
  if (highest(top, 0) + highest(top, OP) <= 25 || top[0] === CHECKERS) return scored[0].c;
  let best = scored[0];
  let bestV = -Infinity;
  const budget: Budget = { nodes: HARD_NODES };
  // Best medium candidates first; when the budget runs out the ones not finished are dropped (the medium pick stays
  // in unless a finished candidate beat it).
  for (const s of scored.slice(0, HARD_WIDTH)) {
    const v = expectation(s.c.pos, budget);
    if (Number.isNaN(v)) break;
    if (v > bestV) {
      bestV = v;
      best = s;
    }
  }
  return best.c;
}

/** One action: the next step of the chosen maximal sequence continuing this turn's steps, or commit. */
export function botMove(s: TavlaState, seat: number, level: BotLevel, rng: Rng): TavlaAction {
  if (s.phase !== 'playing' || s.turn !== seat) return { type: 'commit' };
  const c = turnCtx(s);
  if (c.left === 0) return { type: 'commit' };
  const pick = choose(sequences(c.pos, c.rem), level, rng);
  const st = pick.steps[0];
  return st ? { type: 'step', from: absFrom(seat, st.r), die: st.d } : { type: 'commit' };
}

/** Timeout move: commit when complete, else the next step of the first legal sequence, else commit. */
export function quickMove(s: TavlaState, seat: number): TavlaAction {
  if (s.phase !== 'playing' || s.turn !== seat) return { type: 'commit' };
  const c = turnCtx(s);
  if (c.left === 0) return { type: 'commit' };
  const st = sequences(c.pos, c.rem)[0]?.steps[0];
  return st ? { type: 'step', from: absFrom(seat, st.r), die: st.d } : { type: 'commit' };
}

/** All distinct positions reachable this turn from the current steps (exported for tests). */
export const continuations = (s: TavlaState): Seq[] => sequences(toPos(s.board, s.turn), s.remaining);
