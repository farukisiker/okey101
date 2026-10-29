import { describe, expect, it } from 'vitest';
import { addableTiles, analyzeMeld, meldPoints, type Color, type OkeyInfo, type Tile } from '../src';

let nextId = 1000;
const t = (color: Color, value: number): Tile => ({ id: nextId++, kind: 'normal', color, value });
const fake = (): Tile => ({ id: nextId++, kind: 'fake' });
// Indicator red 4 -> okey red 5
const okey: OkeyInfo = { color: 'red', value: 5 };
const joker = () => t('red', 5);

describe('sets (aynı sayı, farklı renk)', () => {
  it('accepts 3 and 4 different colours', () => {
    expect(analyzeMeld([t('blue', 7), t('black', 7), t('yellow', 7)], okey)).toMatchObject({ type: 'set', points: 21 });
    expect(analyzeMeld([t('blue', 9), t('black', 9), t('yellow', 9), t('red', 9)], okey)?.points).toBe(36);
  });
  it('rejects repeated colour, mixed values, wrong sizes', () => {
    expect(analyzeMeld([t('blue', 7), t('blue', 7), t('yellow', 7)], okey)).toBeNull();
    expect(analyzeMeld([t('blue', 7), t('black', 8), t('yellow', 7)], okey)).toBeNull();
    expect(analyzeMeld([t('blue', 7), t('black', 7)], okey)).toBeNull();
  });
  it('a 5-tile same-number group is invalid', () => {
    expect(analyzeMeld([t('blue', 3), t('black', 3), t('yellow', 3), t('red', 3), t('red', 3)], okey)).toBeNull();
  });
});

describe('runs (aynı renk seri)', () => {
  it('accepts consecutive same colour in any order', () => {
    expect(analyzeMeld([t('blue', 3), t('blue', 1), t('blue', 2)], okey)).toMatchObject({ type: 'run', points: 6 });
    expect(analyzeMeld([t('black', 10), t('black', 11), t('black', 12), t('black', 13)], okey)?.points).toBe(46);
  });
  it('rejects gaps, mixed colours, duplicates', () => {
    expect(analyzeMeld([t('blue', 3), t('blue', 4), t('blue', 6)], okey)).toBeNull();
    expect(analyzeMeld([t('blue', 3), t('blue', 4), t('black', 5)], okey)).toBeNull();
    expect(analyzeMeld([t('blue', 3), t('blue', 4), t('blue', 4)], okey)).toBeNull();
  });
  it('has no 13-1 wrap', () => {
    expect(analyzeMeld([t('blue', 12), t('blue', 13), t('blue', 1)], okey)).toBeNull();
    expect(analyzeMeld([t('blue', 13), t('blue', 1), t('blue', 2)], okey)).toBeNull();
  });
});

describe('okey ve sahte okey', () => {
  it('okey fills a gap in a run', () => {
    const j = joker();
    const m = analyzeMeld([t('blue', 3), j, t('blue', 5)], okey)!;
    expect(m.type).toBe('run');
    expect(m.points).toBe(12);
    expect(m.represents[j.id]).toEqual({ color: 'blue', value: 4 });
  });
  it('okey extends a run upward, or downward at 13', () => {
    expect(analyzeMeld([t('blue', 8), t('blue', 9), joker()], okey)?.points).toBe(27);
    const j = joker();
    const m = analyzeMeld([t('blue', 12), t('blue', 13), j], okey)!;
    expect(m.points).toBe(36);
    expect(m.represents[j.id].value).toBe(11);
  });
  it('okey completes a set with a missing colour', () => {
    const j = joker();
    const m = analyzeMeld([t('blue', 11), t('black', 11), j], okey)!;
    expect(m.type).toBe('set');
    expect(m.points).toBe(33);
    expect(['red', 'yellow']).toContain(m.represents[j.id].color);
  });
  it('two okeys with one tile picks the best reading', () => {
    // set 12x3 = 36 vs run 11..13 = 36 vs run 12,13 +down = 36; with 10: run 10,11,12 = 33 vs set 30
    expect(analyzeMeld([t('blue', 10), joker(), joker()], okey)?.points).toBe(33);
  });
  it('fake okey plays as the okey face (red 5), not as a joker', () => {
    expect(analyzeMeld([t('red', 3), t('red', 4), fake()], okey)).toMatchObject({ type: 'run', points: 12 });
    expect(analyzeMeld([t('blue', 5), t('black', 5), fake()], okey)).toMatchObject({ type: 'set', points: 15 });
    expect(analyzeMeld([t('blue', 3), t('blue', 4), fake()], okey)).toBeNull();
  });
  it('the real okey tile always acts as a joker', () => {
    expect(analyzeMeld([t('red', 3), t('red', 4), joker()], okey)?.points).toBe(12);
  });
});

describe('101 toplamı', () => {
  it('sums meld points', () => {
    const groups = [
      [t('blue', 13), t('black', 13), t('yellow', 13)], // 39
      [t('black', 10), t('black', 11), t('black', 12)], // 33
      [t('yellow', 9), t('yellow', 10), t('yellow', 11)], // 30
    ];
    expect(meldPoints(groups, okey)).toBe(102);
    expect(meldPoints([...groups, [t('blue', 1), t('blue', 3), t('blue', 5)]], okey)).toBeNull();
  });
});

describe('işlek taşlar', () => {
  it('finds hand tiles that extend table melds', () => {
    const run = { id: 1, type: 'run' as const, tiles: [t('blue', 3), t('blue', 4), t('blue', 5)] };
    const set = { id: 2, type: 'set' as const, tiles: [t('blue', 9), t('black', 9), t('yellow', 9)] };
    const b6 = t('blue', 6), b2 = t('blue', 2), r9 = t('red', 9), r8 = t('red', 8), j = joker();
    const map = addableTiles([b6, b2, r9, r8, j], [run, set], okey);
    expect(map.get(b6.id)).toEqual([1]);
    expect(map.get(b2.id)).toEqual([1]);
    expect(map.get(r9.id)).toEqual([2]);
    expect(map.has(r8.id)).toBe(false);
    expect(map.has(j.id)).toBe(false);
  });
});
