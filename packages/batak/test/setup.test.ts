import { describe, expect, it } from 'vitest';
import { seededRng } from '@kahve/core';
import { defaultOptions, normalizeOptions } from '../src/options';
import { create } from '../src/setup';
import { clone } from '../src/clone';
import { fresh, names } from './helpers';

describe('options', () => {
  it('defaults', () => {
    expect(normalizeOptions(undefined)).toEqual(defaultOptions);
    expect(normalizeOptions([1])).toEqual(defaultOptions);
    expect(normalizeOptions(null)).toEqual(defaultOptions);
    expect(defaultOptions).toMatchObject({ variant: 'ihaleli', targetRounds: 9, minBid: 5, forcedDealerBid: 4, voidTrump: 'always', mustRaise: true, trumpLeadNeedsBreak: true, zeroTrickPenalty: 'bid' });
  });
  it('keeps valid values, drops invalid and unknown', () => {
    const o = normalizeOptions({ targetRounds: 5, minBid: 4, voidTrump: 'never', mustRaise: false, trumpLeadNeedsBreak: false, zeroTrickPenalty: 'fixed5', forcedDealerBid: 5, kozMacaOvertrickLimit: 3, partnerDummy: true, extra: 1 });
    expect(o).toEqual({ ...defaultOptions, targetRounds: 5, minBid: 4, voidTrump: 'never', mustRaise: false, trumpLeadNeedsBreak: false, zeroTrickPenalty: 'fixed5', forcedDealerBid: 5, kozMacaOvertrickLimit: 3, partnerDummy: true });
    expect('extra' in o).toBe(false);
    expect(normalizeOptions({ targetRounds: 8, minBid: 3, voidTrump: 'x', mustRaise: 'yes' })).toEqual(defaultOptions);
  });
  it('variants are not playable yet: normalized to ihaleli', () => {
    expect(normalizeOptions({ variant: 'kozMaca' }).variant).toBe('ihaleli');
    expect(normalizeOptions({ variant: 'esli' }).variant).toBe('ihaleli');
  });
});

describe('create', () => {
  it('BAT-T01: 4 x 13 unique cards, bidding phase', () => {
    const s = fresh(7);
    expect(s.players.map(p => p.hand.length)).toEqual([13, 13, 13, 13]);
    const ids = s.players.flatMap(p => p.hand.map(c => c.id));
    expect(new Set(ids).size).toBe(52);
    expect(s.phase).toBe('bidding');
    expect(s.players.map(p => p.name)).toEqual(names);
  });
  it('dealer rotates; seat round % 4 speaks first', () => {
    for (let r = 0; r < 8; r++) {
      const s = fresh(1, {}, r);
      expect(s.turn).toBe(r % 4);
      expect(s.dealer).toBe((r + 3) % 4);
    }
  });
  it('is deterministic per seed and JSON safe', () => {
    expect(fresh(42)).toEqual(fresh(42));
    expect(fresh(42)).not.toEqual(fresh(43));
    const s = fresh(5);
    expect(clone(s)).toEqual(s);
  });
  it('normalizes options, bad round and missing names', () => {
    const s = create({ variant: 'esli' } as never, [], seededRng(1), -3);
    expect(s.options.variant).toBe('ihaleli');
    expect(s.round).toBe(0);
    expect(s.players[2].name).toBe('Oyuncu 3');
  });
});
