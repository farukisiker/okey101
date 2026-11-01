import { describe, expect, it } from 'vitest';
import {
  type Action,
  type Color,
  type GameState,
  type Tile,
  DUZ_START_POINTS,
  applyAction,
  botStep,
  createGame,
  createTileSet,
  findFinish,
  finishShape,
  isSevenPairs,
  matchOver,
  meldCover,
  okeyFromIndicator,
  seededRng,
  viewFor,
} from '../src';

let nextId = 7000;
const t = (color: Color, value: number): Tile => ({ id: nextId++, kind: 'normal', color, value });
const fake = (): Tile => ({ id: nextId++, kind: 'fake' });
// Okey for these tests: red 5 (indicator red 4).
const okey = { color: 'red' as const, value: 5 };

function ok(state: GameState, seat: number, action: Action): GameState {
  const r = applyAction(state, seat, action);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** Düz game, indicator red 4, seat 0 to play holding `hand0`. */
function rigged(hand0: Tile[]): GameState {
  const g = createGame({ mode: 'duz', rng: seededRng(3) });
  g.indicator = { id: 9999, kind: 'normal', color: 'red', value: 4 };
  g.okey = okeyFromIndicator(g.indicator);
  g.gosterge = null;
  g.players[0].hand = hand0;
  return g;
}

// 14 tiles in melds: run of 4, run of 3, set of 4, set of 3.
const finished14 = () => [
  t('blue', 1), t('blue', 2), t('blue', 3), t('blue', 4),
  t('black', 9), t('black', 10), t('black', 11),
  t('red', 7), t('yellow', 7), t('blue', 7), t('black', 7),
  t('red', 12), t('yellow', 12), t('black', 12),
];

describe('düz okey: dağıtım', () => {
  it('deals 15 to the starter and 14 to the others; 48 stay in the middle', () => {
    const g = createGame({ mode: 'duz', rng: seededRng(1) });
    expect(createTileSet()).toHaveLength(106);
    expect(g.players.map((p) => p.hand.length)).toEqual([15, 14, 14, 14]);
    expect(g.deck).toHaveLength(106 - 1 - 57);
    expect(g.turnPhase).toBe('play');
  });

  it('notes who holds the indicator twin (gösterge)', () => {
    for (let seed = 1; seed < 20; seed++) {
      const g = createGame({ mode: 'duz', rng: seededRng(seed) });
      const holder = g.players.find((p) =>
        p.hand.some((x) => x.kind === 'normal' && x.color === g.indicator.color && x.value === g.indicator.value),
      );
      expect(g.gosterge).toBe(holder?.seat ?? null);
    }
  });
});

describe('düz okey: el kontrolü', () => {
  it('a hand of melds finishes; one stray tile does not', () => {
    expect(finishShape(finished14(), okey)).toBe('melds');
    const h = finished14();
    h[13] = t('blue', 13);
    expect(finishShape(h, okey)).toBeNull();
    expect(meldCover(h, okey)).toBe(11);
  });

  it('the okey fills a gap; a fake okey plays as red 5', () => {
    const h = finished14();
    h[1] = t('red', 5); // okey stands in for blue 2
    expect(finishShape(h, okey)).toBe('melds');
    const f = [
      t('red', 3), t('red', 4), fake(), t('red', 6), // fake okey = red 5
      ...finished14().slice(4),
    ];
    expect(f).toHaveLength(14);
    expect(finishShape(f, okey)).toBe('melds');
  });

  it('runs do not wrap from 13 to 1', () => {
    const h = [t('blue', 12), t('blue', 13), t('blue', 1), ...finished14().slice(3)];
    expect(h).toHaveLength(14);
    expect(finishShape(h, okey)).toBeNull();
  });

  it('seven pairs finish; an okey pairs with anything', () => {
    const pairs = (n: number) => {
      const out: Tile[] = [];
      // Every other number, so the pairs can't also be read as runs.
      for (let v = 1; v <= n; v++) out.push(t('black', 2 * v - 1), t('black', 2 * v - 1));
      return out;
    };
    expect(isSevenPairs(pairs(7), okey)).toBe(true);
    expect(finishShape(pairs(7), okey)).toBe('pairs');
    const h = [...pairs(6), t('yellow', 9), t('red', 5)];
    expect(finishShape(h, okey)).toBe('pairs');
    // Reads as both two runs and seven pairs: pairs, they pay double.
    const both: Tile[] = [];
    for (let v = 1; v <= 7; v++) both.push(t('blue', v), t('blue', v));
    expect(finishShape(both, okey)).toBe('pairs');
    expect(isSevenPairs([...pairs(6), t('yellow', 9), t('yellow', 10)], okey)).toBe(false);
  });

  it('a tile can be split between overlapping readings', () => {
    // 3-4-5-6-7 blue + 7 yellow/red: blue 7 must go to the set or the run, not both.
    const h = [
      t('blue', 3), t('blue', 4), t('blue', 5), t('blue', 6), t('blue', 7), t('yellow', 7), t('black', 7),
      t('yellow', 1), t('yellow', 2), t('yellow', 3),
      t('black', 11), t('black', 12), t('black', 13), t('yellow', 13),
    ];
    expect(meldCover(h, okey)).toBe(13);
    h[13] = t('red', 7);
    expect(finishShape(h, okey)).toBe('melds');
  });

  it('findFinish prefers throwing the okey', () => {
    const hand = [...finished14(), t('red', 5)];
    const f = findFinish(hand, okey)!;
    expect(hand.find((x) => x.id === f.tileId)).toMatchObject({ color: 'red', value: 5 });
  });
});

describe('düz okey: oyun', () => {
  it('no melds on the table; finishing ends the round, others lose 2', () => {
    const g = rigged([...finished14(), t('yellow', 2)]);
    const bad = applyAction(g, 0, { type: 'open', melds: [] });
    expect(bad.ok).toBe(false);
    const wrong = applyAction(g, 0, { type: 'finish', tileId: g.players[0].hand[0].id });
    expect(wrong.ok).toBe(false);
    const s = ok(g, 0, { type: 'finish', tileId: g.players[0].hand[14].id });
    expect(s.phase).toBe('finished');
    expect(s.result).toMatchObject({ winner: 0, okeyFinish: false, pairs: false, scores: [0, 2, 2, 2] });
  });

  it('finishing by throwing the okey doubles; gösterge costs the others 1', () => {
    const g = rigged([...finished14(), t('red', 5)]);
    g.gosterge = 2;
    const okeyTile = g.players[0].hand[14];
    const s = ok(g, 0, { type: 'finish', tileId: okeyTile.id });
    expect(s.result).toMatchObject({ okeyFinish: true, multiplier: 2, scores: [1, 5, 4, 5] });
  });

  it('a picked-up discard can be kept; the round is a draw when the middle runs out', () => {
    let g = createGame({ mode: 'duz', rng: seededRng(5) });
    g.gosterge = null;
    g = ok(g, 0, { type: 'discard', tileId: g.players[0].hand[0].id });
    g = ok(g, 1, { type: 'draw', source: 'discard' });
    expect(g.mustUseTileId).toBeNull();
    g.deck = [];
    g = ok(g, 1, { type: 'discard', tileId: g.players[1].hand[0].id });
    expect(g.phase).toBe('finished');
    expect(g.result).toMatchObject({ winner: null, scores: [0, 0, 0, 0] });
  });

  it('the game is over once someone has lost 20', () => {
    expect(matchOver('duz', [4, DUZ_START_POINTS, 0, 2])).toBe(true);
    expect(matchOver('duz', [4, 19, 0, 2])).toBe(false);
    expect(matchOver('101', [400, 500, 0, 2])).toBe(false);
  });

  it('bots play whole düz rounds to an end, mostly with a winner', () => {
    let winners = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const rng = seededRng(seed);
      let g = createGame({ mode: 'duz', rng, startingSeat: seed % 4 });
      for (let n = 0; n < 1000 && g.phase === 'playing'; n++) {
        g = ok(g, g.turn, botStep(viewFor(g, g.turn), { rng }));
      }
      expect(g.phase).toBe('finished');
      if (g.result!.winner !== null) winners++;
    }
    expect(winners).toBeGreaterThan(6);
  }, 30_000);
});
