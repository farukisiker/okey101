// B5: batak registered in the catalog.
import { describe, expect, it } from 'vitest';
import { seededRng } from '@kahve/core';
import { batakDef, type BatakView, CATALOG, getDefinition } from '../src';

describe('batak in the catalog', () => {
  it('is active, in the kağıt group, four seats only', () => {
    expect(CATALOG.find((g) => g.id === 'batak')).toEqual({ id: 'batak', group: 'kagit', status: 'active', seatChoices: [4], titleKey: 'game.batak' });
    expect(getDefinition('batak')).toBe(batakDef);
  });

  it('normalizes the lobby options it does not know into four-seat ihaleli', () => {
    const d = getDefinition('batak')!;
    const o = d.normalizeOptions({ seats: 4, partnerMode: false });
    expect(o).toEqual(batakDef.defaultOptions);
    expect(d.seats(o)).toBe(4);
    expect(d.normalizeOptions({ variant: 'esli' }).variant).toBe('ihaleli');
  });

  it('deals a playable table whose view survives JSON', () => {
    const d = getDefinition('batak')!;
    const o = d.normalizeOptions(undefined);
    const s = d.create(o, ['A', 'B', 'C', 'D'], seededRng(2), 0);
    const turn = d.turn(s)!;
    const v = d.viewFor(s, turn.seat) as BatakView;
    expect(v.phase).toBe('bidding');
    expect(v.hand).toHaveLength(13);
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);
  });
});
