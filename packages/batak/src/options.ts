import type { BatakOptions } from './types';

export const defaultOptions: BatakOptions = {
  variant: 'ihaleli',
  targetRounds: 9,
  minBid: 5,
  forcedDealerBid: 4,
  voidTrump: 'always',
  mustRaise: true,
  trumpLeadNeedsBreak: true,
  zeroTrickPenalty: 'bid',
  kozMacaOvertrickLimit: 2,
  partnerDummy: false,
};

const oneOf = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;

/** Untrusted input to full options. Unknown keys dropped, bad values defaulted, variants forced to 'ihaleli'. */
export function normalizeOptions(raw: unknown): BatakOptions {
  const v = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const d = defaultOptions;
  return {
    // Koz Maça and Eşli are designed but not playable in the first release.
    variant: 'ihaleli',
    targetRounds: oneOf(v.targetRounds, [5, 7, 9, 11, 13] as const, d.targetRounds),
    minBid: oneOf(v.minBid, [4, 5] as const, d.minBid),
    forcedDealerBid: oneOf(v.forcedDealerBid, [4, 5] as const, d.forcedDealerBid),
    voidTrump: oneOf(v.voidTrump, ['always', 'ifCanOvertrump', 'never'] as const, d.voidTrump),
    mustRaise: typeof v.mustRaise === 'boolean' ? v.mustRaise : d.mustRaise,
    trumpLeadNeedsBreak: typeof v.trumpLeadNeedsBreak === 'boolean' ? v.trumpLeadNeedsBreak : d.trumpLeadNeedsBreak,
    zeroTrickPenalty: oneOf(v.zeroTrickPenalty, ['bid', 'fixed5', 'none'] as const, d.zeroTrickPenalty),
    kozMacaOvertrickLimit: oneOf(v.kozMacaOvertrickLimit, [0, 2, 3] as const, d.kozMacaOvertrickLimit),
    partnerDummy: typeof v.partnerDummy === 'boolean' ? v.partnerDummy : d.partnerDummy,
  };
}
