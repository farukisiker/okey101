import type { Rng } from './types';

/** Deterministic mulberry32, identical to shared/src/tiles.ts. */
export function seededRng(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates copy; consumes length - 1 random values for nonempty inputs. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Returns an integer in [0, n). Requires positive integer n and rng in [0, 1). */
export function randomInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

/** Empty inputs return undefined without consuming randomness. */
export function pick<T>(rng: Rng, items: readonly T[]): T | undefined {
  return items.length === 0 ? undefined : items[randomInt(rng, items.length)];
}

/** Host-only seed generation; game rules must use their supplied RNG. */
export function newSeed(): number {
  return Math.floor(Math.random() * 4294967296);
}
