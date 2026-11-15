import { describe, expect, it } from 'vitest';
import { GAME_IDS } from '@kahve/core';
import { DEFAULT_RESHUFFLES, seededRng, TURN_MS } from '@okey/shared';
import { CATALOG, gamesInGroup, getDefinition, okey101Def, okeyDuzDef, pistiDef } from '../src';

describe('CATALOG', () => {
  it('lists every game id once, with titleKey game.<id>', () => {
    expect(CATALOG.map((g) => g.id)).toEqual([...GAME_IDS]);
    for (const g of CATALOG) expect(g.titleKey).toBe(`game.${g.id}`);
  });

  it('okey and pişti are active; seat choices and groups', () => {
    const by = Object.fromEntries(CATALOG.map((g) => [g.id, g]));
    expect(CATALOG.filter((g) => g.status === 'active').map((g) => g.id)).toEqual(['okey101', 'okeyDuz', 'pisti']);
    expect(by.pisti!.seatChoices).toEqual([2, 4]);
    expect(by.batak!.seatChoices).toEqual([4]);
    expect(by.tavla!.seatChoices).toEqual([2]);
    for (const id of ['okey101', 'okeyDuz', 'king', 'konken', 'elli1']) expect(by[id]!.seatChoices).toEqual([4]);
    expect(gamesInGroup('okey').map((g) => g.id)).toEqual(['okey101', 'okeyDuz']);
    expect(gamesInGroup('kagit').map((g) => g.id)).toEqual(['pisti', 'batak', 'king', 'konken', 'elli1']);
    expect(gamesInGroup('tavla').map((g) => g.id)).toEqual(['tavla']);
    expect(gamesInGroup('dama')).toEqual([]);
  });

  it('getDefinition returns okey and pişti defs and null for soon games', () => {
    expect(getDefinition('okey101')).toBe(okey101Def);
    expect(getDefinition('okeyDuz')).toBe(okeyDuzDef);
    expect(getDefinition('pisti')).toBe(pistiDef);
    for (const id of ['batak', 'tavla', 'king', 'konken', 'elli1'] as const) expect(getDefinition(id)).toBeNull();
  });

  it('is plain JSON', () => {
    expect(JSON.parse(JSON.stringify(CATALOG))).toEqual(CATALOG);
  });
});

describe('okey definition details', () => {
  it('clock matches turnBudgetMs in @okey/shared/clock.ts (first turn x2 is hard-coded there)', () => {
    // If this fails, turnBudgetMs/nextClock and the adapter's ClockRules have drifted apart.
    for (const def of [okey101Def, okeyDuzDef]) {
      expect(def.clock.baseMs).toBe(TURN_MS);
      expect(def.clock.firstTurnFactor).toBe(2);
    }
  });

  it('normalizeOptions repairs bad input and drops unknown keys', () => {
    const n = okey101Def.normalizeOptions;
    // A7: islek and matchEnd joined the options (user decisions 7 and 8).
    const rest = { islek: 'opened', matchEnd: { kind: 'hands', n: 5 } };
    expect(okey101Def.defaultOptions).toEqual({ reshuffles: DEFAULT_RESHUFFLES, ...rest });
    expect(n({ reshuffles: 0 })).toEqual({ reshuffles: 0, ...rest });
    expect(n({ reshuffles: 5, extra: true })).toEqual({ reshuffles: 5, ...rest });
    for (const bad of [null, undefined, 'x', [], {}, { reshuffles: -1 }, { reshuffles: 1.5 }, { reshuffles: '2' }, { reshuffles: 99 }])
      expect(n(bad)).toEqual({ reshuffles: DEFAULT_RESHUFFLES, ...rest });
  });

  it('seats, create, refillsClock, matchOver', () => {
    expect(okey101Def.seats(okey101Def.defaultOptions)).toBe(4);
    const s = okeyDuzDef.create({ ...okeyDuzDef.defaultOptions, reshuffles: 0 }, ['A', 'B', 'C', 'D'], seededRng(1), 5);
    expect(s.mode).toBe('duz');
    expect(s.startingSeat).toBe(1);
    expect(s.reshufflesLeft).toBe(0);
    expect(okeyDuzDef.turn(s)).toEqual({ seat: 1, key: 0, first: true });
    expect(okey101Def.refillsClock({ type: 'open', melds: [[1]] })).toBe(true);
    expect(okey101Def.refillsClock({ type: 'meld', tileIds: [1] })).toBe(true);
    expect(okey101Def.refillsClock({ type: 'addToMeld', meldId: 0, tileIds: [1] })).toBe(true);
    expect(okey101Def.refillsClock({ type: 'discard', tileId: 1 })).toBe(false);
    expect(okey101Def.refillsClock({ type: 'draw', source: 'deck' })).toBe(false);
    // A7: 101 now ends after five hands by default; 'none' keeps the old endless table.
    expect(okey101Def.matchOver([999, 0, 0, 0], 50, { ...okey101Def.defaultOptions, matchEnd: { kind: 'none' } })).toBe(false);
    expect(okey101Def.matchOver([999, 0, 0, 0], 50, okey101Def.defaultOptions)).toBe(true);
    expect(okeyDuzDef.matchOver([20, 0, 0, 0], 3, okeyDuzDef.defaultOptions)).toBe(true);
    expect(okeyDuzDef.matchOver([19, 0, 0, 0], 3, okeyDuzDef.defaultOptions)).toBe(false);
  });

  it('quickMove is legal for the seat to move; viewFor passes the clock through and hides the seed', () => {
    const s = okey101Def.create(okey101Def.defaultOptions, ['A', 'B', 'C', 'D'], seededRng(3), 0);
    const seat = okey101Def.turn(s)!.seat;
    expect(okey101Def.apply(s, seat, okey101Def.quickMove(s, seat)).ok).toBe(true);
    const v = okey101Def.viewFor(s, 2, { clock: { turnNumber: 0, deadline: 1500, refilled: false }, now: 1000 });
    expect(v.turnMsLeft).toBe(500);
    expect(JSON.stringify(v)).not.toContain('"seed"');
  });
});
