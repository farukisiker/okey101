import type { TavlaOptions } from './types';

export const defaultOptions: TavlaOptions = { variant: 'klasik', targetScore: 5, koncinaPoints: 3 };

const oneOf = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;

/** Untrusted input to full options. Unknown keys dropped, bad values defaulted, variant always 'klasik'. */
export function normalizeOptions(raw: unknown): TavlaOptions {
  const v = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    // Gülbara / Tapa are reserved, not playable in the first release.
    variant: 'klasik',
    targetScore: oneOf(v.targetScore, [1, 3, 5, 7] as const, defaultOptions.targetScore),
    koncinaPoints: oneOf(v.koncinaPoints, [2, 3] as const, defaultOptions.koncinaPoints),
  };
}
