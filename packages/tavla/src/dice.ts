import type { Rng } from '@kahve/core';

/** Seeds the hidden dice counter from the host's rng (consumes exactly one value). */
export const seedDice = (rng: Rng): number => Math.floor(rng() * 4294967296) >>> 0;

/** One die from the mulberry32 counter `state` (same mixing as @kahve/core seededRng). Returns [die, nextState]. */
export function rollDie(state: number): [number, number] {
  const t = (state + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  const f = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return [Math.floor(f * 6) + 1, t];
}

/** Two dice for a normal turn. Returns [[d1, d2], nextState]. */
export function rollPair(state: number): [[number, number], number] {
  const [a, s1] = rollDie(state);
  const [b, s2] = rollDie(s1);
  return [[a, b], s2];
}

/** Dice values to play for a roll: four entries on doubles. */
export const diceToPlay = (dice: readonly [number, number]): number[] =>
  dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : [dice[0], dice[1]];
