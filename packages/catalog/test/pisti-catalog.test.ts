// B5: pişti registered in the catalog.
import { describe, expect, it } from 'vitest';
import { seededRng } from '@kahve/core';
import { CATALOG, gamesInGroup, getDefinition, pistiDef, type PistiView } from '../src';

describe('pişti in the catalog', () => {
  it('is active, in the kağıt group, with 2 or 4 seats', () => {
    const meta = CATALOG.find((g) => g.id === 'pisti')!;
    expect(meta).toEqual({ id: 'pisti', group: 'kagit', status: 'active', seatChoices: [2, 4], titleKey: 'game.pisti' });
    expect(gamesInGroup('kagit').find((g) => g.id === 'pisti')!.status).toBe('active');
    expect(getDefinition('pisti')).toBe(pistiDef);
  });

  it('normalizes options: two seats by default, partners only with four, junk dropped', () => {
    const d = getDefinition('pisti')!;
    expect(d.normalizeOptions(undefined)).toEqual(pistiDef.defaultOptions);
    expect(d.normalizeOptions({ seats: 3 }).seats).toBe(2);
    expect(d.normalizeOptions({ seats: 2, partnerMode: true }).partnerMode).toBe(false);
    expect(d.normalizeOptions({ seats: 4, partnerMode: true })).toMatchObject({ seats: 4, partnerMode: true });
    expect(d.normalizeOptions({ seats: 4 })).toMatchObject({ seats: 4, partnerMode: false });
    expect(d.normalizeOptions({ seats: 4, evil: 1 })).not.toHaveProperty('evil');
    expect(d.seats(d.normalizeOptions({ seats: 4 }))).toBe(4);
  });

  it('the lobby setup options deal a playable table', () => {
    const d = getDefinition('pisti')!;
    for (const opts of [{ seats: 2, partnerMode: false }, { seats: 4, partnerMode: false }, { seats: 4, partnerMode: true }]) {
      const o = d.normalizeOptions(opts);
      const names = Array.from({ length: d.seats(o) }, (_, i) => `P${i}`);
      const s = d.create(o, names, seededRng(5), 0);
      const turn = d.turn(s)!;
      const v = d.viewFor(s, turn.seat) as PistiView;
      expect(v.hand.length).toBeGreaterThan(0);
      expect(v.players).toHaveLength(names.length);
      expect(JSON.parse(JSON.stringify(v))).toEqual(v);
    }
  });
});
