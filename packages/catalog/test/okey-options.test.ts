// A7: okey house rules islek + matchEnd (user decisions 7 and 8), noticeOf and renameSeat.
import { describe, expect, it } from 'vitest';
import { applyAction, seededRng, type GameState, type Tile } from '@okey/shared';
import { DEFAULT_OKEY_OPTIONS, normalizeOkeyOptions, okey101Def, okeyDuzDef, type OkeyOptions } from '../src';

const n = normalizeOkeyOptions;

describe('OkeyOptions: islek', () => {
  it('accepts the three modes, repairs anything else to "opened"', () => {
    for (const islek of ['off', 'opened', 'all'] as const) expect(n({ islek }).islek).toBe(islek);
    for (const bad of [undefined, null, '', 'OPENED', 1, true, {}, ['all']]) expect(n({ islek: bad }).islek).toBe('opened');
  });

  it('create passes it into the state', () => {
    const s = okey101Def.create({ ...DEFAULT_OKEY_OPTIONS, islek: 'all' }, ['A', 'B', 'C', 'D'], seededRng(1), 0);
    expect(s.islek).toBe('all');
    expect(okey101Def.viewFor(s, 2).islek).toBe('all');
    expect(okey101Def.create(DEFAULT_OKEY_OPTIONS, ['A', 'B', 'C', 'D'], seededRng(1), 0).islek).toBe('opened');
  });
});

describe('OkeyOptions: matchEnd', () => {
  it('accepts every listed option', () => {
    expect(n({ matchEnd: { kind: 'none' } }).matchEnd).toEqual({ kind: 'none' });
    for (const k of [5, 7, 11]) expect(n({ matchEnd: { kind: 'hands', n: k } }).matchEnd).toEqual({ kind: 'hands', n: k });
    for (const l of [501, 1001]) expect(n({ matchEnd: { kind: 'points', limit: l } }).matchEnd).toEqual({ kind: 'points', limit: l });
  });

  it('repairs broken input to five hands and drops unknown keys', () => {
    const bad = [
      undefined,
      null,
      'hands',
      [],
      {},
      { kind: 'hands' },
      { kind: 'hands', n: 6 },
      { kind: 'hands', n: '5' },
      { kind: 'points', limit: 500 },
      { kind: 'points', n: 501 },
      { kind: 'forever' },
    ];
    for (const b of bad) expect(n({ matchEnd: b }).matchEnd).toEqual({ kind: 'hands', n: 5 });
    expect(n({ matchEnd: { kind: 'none', n: 5 } }).matchEnd).toEqual({ kind: 'none' });
    expect(n({ matchEnd: { kind: 'hands', n: 7, x: 1 } }).matchEnd).toEqual({ kind: 'hands', n: 7 });
  });

  it('a hostile getter on one field only resets that field', () => {
    const raw = {
      reshuffles: 2,
      islek: 'all',
      get matchEnd() {
        throw new Error('boom');
      },
    };
    expect(n(raw)).toEqual({ reshuffles: 2, islek: 'all', matchEnd: { kind: 'hands', n: 5 } });
  });

  const opts = (matchEnd: OkeyOptions['matchEnd']): OkeyOptions => ({ ...DEFAULT_OKEY_OPTIONS, matchEnd });

  it('101 none: never over', () => {
    expect(okey101Def.matchOver([5000, 0, 0, 0], 99, opts({ kind: 'none' }))).toBe(false);
  });

  it('101 hands: over once N hands are played in this match', () => {
    for (const k of [5, 7, 11] as const) {
      expect(okey101Def.matchOver([0, 0, 0, 0], k - 1, opts({ kind: 'hands', n: k }))).toBe(false);
      expect(okey101Def.matchOver([0, 0, 0, 0], k, opts({ kind: 'hands', n: k }))).toBe(true);
    }
  });

  it('101 points: over once anyone reaches the limit', () => {
    for (const l of [501, 1001] as const) {
      expect(okey101Def.matchOver([l - 1, -200, 0, 30], 40, opts({ kind: 'points', limit: l }))).toBe(false);
      expect(okey101Def.matchOver([0, 0, l, 0], 1, opts({ kind: 'points', limit: l }))).toBe(true);
    }
  });

  it('düz ignores matchEnd: someone out of points, as before', () => {
    expect(okeyDuzDef.matchOver([19, 0, 0, 0], 50, opts({ kind: 'hands', n: 5 }))).toBe(false);
    expect(okeyDuzDef.matchOver([20, 0, 0, 0], 1, opts({ kind: 'none' }))).toBe(true);
  });
});

describe('noticeOf and renameSeat', () => {
  it('noticeOf is null at the deal and the latest penalty after one', () => {
    const s = okey101Def.create(DEFAULT_OKEY_OPTIONS, ['A', 'B', 'C', 'D'], seededRng(3), 0);
    expect(okey101Def.noticeOf!(s)).toBeNull();
    const okeyTile = { id: 9001, kind: 'normal', color: s.okey.color, value: s.okey.value } as Tile;
    const g: GameState = { ...s, players: s.players.map((p, i) => (i === 0 ? { ...p, hand: [okeyTile, ...p.hand] } : p)) };
    const r = applyAction(g, 0, { type: 'discard', tileId: okeyTile.id });
    if (!r.ok) throw new Error(r.error);
    expect(okey101Def.noticeOf!(r.state)).toEqual({ id: 1, seat: 0, reason: 'okeyDiscard', amount: 101 });
  });

  it('renameSeat changes only that name and leaves the input untouched', () => {
    const s = okey101Def.create(DEFAULT_OKEY_OPTIONS, ['A', 'B', 'C', 'D'], seededRng(3), 0);
    const before = JSON.stringify(s);
    const r = okey101Def.renameSeat!(s, 2, 'Zeki');
    expect(JSON.stringify(s)).toBe(before);
    expect(r.players.map((p) => p.name)).toEqual(['A', 'B', 'Zeki', 'D']);
    expect(JSON.stringify({ ...r, players: r.players.map((p) => ({ ...p, name: '' })) })).toBe(
      JSON.stringify({ ...s, players: s.players.map((p) => ({ ...p, name: '' })) }),
    );
  });
});
