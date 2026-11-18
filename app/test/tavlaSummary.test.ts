// C3: the hook's end-of-game numbers for Tavla (result { winner, kind, points } instead of result.scores).
import { describe, expect, it } from 'vitest';
import { tavlaNoteFromView, tavlaPointsFromView } from '../src/net/tavlaSummary';
import { cardSummary, viewScores } from '../src/net/cardSummary';
import { tr } from '../src/i18n/tr';
import { en } from '../src/i18n/locales/en';

const players = [
  { seat: 0, name: 'Sen', pips: 0 },
  { seat: 1, name: 'Cem', pips: 40 },
];
const fill = (s: string, vars?: Record<string, string | number>) =>
  Object.entries(vars ?? {}).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);
const trT = (k: keyof typeof tr, vars?: Record<string, string | number>) => fill(tr[k], vars);
const enT = (k: keyof typeof en, vars?: Record<string, string | number>) => fill(en[k], vars);

describe('tavla summary from the view', () => {
  it('points per seat for the winner only; nothing while the game is on', () => {
    expect(tavlaPointsFromView({ players, result: { winner: 1, kind: 'mars', points: 2 } })).toEqual([0, 2]);
    expect(tavlaPointsFromView({ players, result: { winner: 0, kind: 'tek', points: 1 } })).toEqual([1, 0]);
    expect(tavlaPointsFromView({ players, result: null })).toBeNull();
    expect(tavlaPointsFromView({ players, result: { scores: [1, 2] } })).toBeNull();
    expect(tavlaPointsFromView(null)).toBeNull();
    // The card games' convention does not read a tavla result (the hook falls back to tavlaPointsFromView).
    expect(viewScores({ players, result: { winner: 1, kind: 'mars', points: 2 } })).toBeNull();
  });

  it('the note names the kind and the points, in Turkish and English', () => {
    const v = { players, result: { winner: 0, kind: 'koncina', points: 3 } };
    expect(tavlaNoteFromView(v, trT)).toBe('Konçina — 3 sayı');
    expect(tavlaNoteFromView(v, enT)).toBe('Backgammon — 3 points');
    expect(tavlaNoteFromView({ players, result: null }, trT)).toBeUndefined();
    expect(tavlaNoteFromView({ players, result: { winner: 0, kind: 'x', points: 1 } }, trT)).toBeUndefined();
  });

  it('feeds cardSummary: winner row, totals, match over at the target', () => {
    const points = tavlaPointsFromView({ players, result: { winner: 0, kind: 'mars', points: 2 } })!;
    const s = cardSummary({ names: ['Ali', 'Cem'], points, totals: [5, 3], matchOver: true, mySeat: 0, you: 'Sen' });
    expect(s.rows.map((r) => [r.points, r.total])).toEqual([
      [2, 5],
      [0, 3],
    ]);
    expect(s.winnerSeats).toEqual([0]);
    expect(s.matchOver).toBe(true);
  });

  it('every locale has every tavla key the screen uses', async () => {
    const keys = Object.keys(tr).filter((k) => k.startsWith('tavla'));
    expect(keys).toHaveLength(28);
    for (const loc of ['de', 'en', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'pt', 'ru', 'zh']) {
      const mod = (await import(`../src/i18n/locales/${loc}.ts`)) as Record<string, Record<string, string>>;
      const dict = mod[loc];
      for (const k of keys) expect(typeof dict[k], `${loc}.${k}`).toBe('string');
    }
  });
});
