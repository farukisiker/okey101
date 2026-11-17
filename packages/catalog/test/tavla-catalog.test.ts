// C3: tavla registered in the catalog.
import { describe, expect, it } from 'vitest';
import { seededRng } from '@kahve/core';
import { BOT_STEP_DELAY_MS, CATALOG, botStepDelayMs, getDefinition, tavlaDef, type TavlaAction, type TavlaView } from '../src';

describe('tavla in the catalog', () => {
  it('is active, in the tavla group, two seats only', () => {
    expect(CATALOG.find((g) => g.id === 'tavla')).toEqual({ id: 'tavla', group: 'tavla', status: 'active', seatChoices: [2], titleKey: 'game.tavla' });
    expect(getDefinition('tavla')).toBe(tavlaDef);
  });

  it('normalizes the lobby options (seats, partnerMode) it does not know into the default klasik match', () => {
    const d = getDefinition('tavla')!;
    const o = d.normalizeOptions({ seats: 2, partnerMode: false });
    expect(o).toEqual(tavlaDef.defaultOptions);
    expect(o).toEqual({ variant: 'klasik', targetScore: 5, koncinaPoints: 3 });
    expect(d.seats(o)).toBe(2);
    expect(d.normalizeOptions({ variant: 'gulbara', targetScore: 3, koncinaPoints: 2, extra: 1 })).toEqual({
      variant: 'klasik',
      targetScore: 3,
      koncinaPoints: 2,
    });
    for (const bad of [null, undefined, 'x', [], { targetScore: 4 }, { targetScore: '5' }, { koncinaPoints: 1 }])
      expect(d.normalizeOptions(bad)).toEqual(tavlaDef.defaultOptions);
  });

  it('deals a playable game whose views survive JSON and never carry the dice generator', () => {
    const d = getDefinition('tavla')!;
    const o = d.normalizeOptions(undefined);
    let s = d.create(o, ['A', 'B'], seededRng(3), 0);
    expect(typeof s.rngState).toBe('number');
    const turn = d.turn(s)!;
    expect(turn.first).toBe(true);
    for (let step = 0; step < 400 && d.turn(s); step++) {
      const seat = d.turn(s)!.seat;
      for (const viewer of [0, 1, -1]) {
        const v = d.viewFor(s, viewer, { clock: null, now: 0 }) as TavlaView;
        expect(JSON.parse(JSON.stringify(v))).toEqual(v);
        expect(JSON.stringify(v)).not.toContain('rngState');
        expect(v).not.toHaveProperty('rngState');
      }
      const a = d.botMove(s, seat, 'medium', seededRng(step)) as TavlaAction;
      expect(d.isAction(a)).toBe(true);
      const r = d.apply(s, seat, a);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.state;
    }
    expect(d.roundOver(s)).toBe(true);
    const points = d.scoreRound(s);
    expect(points.filter((p: number) => p > 0)).toHaveLength(1);
    expect(d.matchOver(points, 1, o)).toBe(false);
    expect(d.matchOver([5, 0], 3, o)).toBe(true);
  });

  it('bot step pacing: tavla steps at 600 ms (never above the bot delay), other games keep the bot delay', () => {
    expect(BOT_STEP_DELAY_MS.tavla).toBe(600);
    expect(botStepDelayMs('tavla', 1300)).toBe(600);
    expect(botStepDelayMs('tavla', 1000)).toBe(600);
    expect(botStepDelayMs('tavla', 20)).toBe(20);
    for (const id of ['okey101', 'okeyDuz', 'pisti', 'batak'] as const) expect(botStepDelayMs(id, 1300)).toBe(1300);
  });
});
