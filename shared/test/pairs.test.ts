import { describe, expect, it } from 'vitest';
import {
  addableTiles,
  analyzePair,
  applyAction,
  botStep,
  createGame,
  findPairs,
  okeyFromIndicator,
  seededRng,
  viewFor,
  type Action,
  type Color,
  type GameState,
  type Tile,
} from '../src';

let nextId = 7000;
const t = (color: Color, value: number): Tile => ({ id: nextId++, kind: 'normal', color, value });
/** Two identical tiles. */
const pair = (color: Color, value: number) => [t(color, value), t(color, value)];
const ids = (g: Tile[][]) => g.map((m) => m.map((x) => x.id));

function ok(state: GameState, seat: number, action: Action): GameState {
  const r = applyAction(state, seat, action);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
function err(state: GameState, seat: number, action: Action): string {
  const r = applyAction(state, seat, action);
  if (r.ok) throw new Error('expected failure');
  return r.error;
}

/** Indicator red 4, so the okey is red 5. */
const OKEY = { color: 'red', value: 5 } as const;
function rigged(hand0: Tile[]): GameState {
  const g = createGame({ rng: seededRng(1) });
  g.indicator = { id: 9999, kind: 'normal', color: 'red', value: 4 };
  g.okey = okeyFromIndicator(g.indicator);
  g.players[0].hand = hand0;
  return g;
}
const fivePairs = () => [pair('blue', 1), pair('blue', 2), pair('black', 3), pair('yellow', 4), pair('black', 6)];

describe('çift (analyzePair / findPairs)', () => {
  it('needs two identical tiles; the okey pairs with anything', () => {
    expect(analyzePair(pair('blue', 7), OKEY)?.type).toBe('pair');
    expect(analyzePair([t('blue', 7), t('black', 7)], OKEY)).toBeNull();
    expect(analyzePair([t('blue', 7), t('blue', 8)], OKEY)).toBeNull();
    const j = t('red', 5);
    const a = analyzePair([t('blue', 7), j], OKEY)!;
    expect(a.represents[j.id]).toEqual({ color: 'blue', value: 7 });
    expect(analyzePair([t('red', 5), t('red', 5)], OKEY)?.type).toBe('pair');
    // Fake okeys both show the okey's face, so two of them pair.
    expect(analyzePair([{ id: 1, kind: 'fake' }, { id: 2, kind: 'fake' }], OKEY)?.type).toBe('pair');
    expect(analyzePair([t('blue', 7), t('blue', 7), t('blue', 7)], OKEY)).toBeNull();
  });
  it('finds identical pairs, then pairs the okey with the highest single', () => {
    const j = t('red', 5);
    const hand = [...pair('blue', 1), t('black', 13), t('yellow', 2), j, t('blue', 1)];
    const p = findPairs(hand, OKEY);
    expect(p).toHaveLength(2);
    expect(p.some((pr) => pr.includes(j) && pr.some((x) => x.kind === 'normal' && x.value === 13))).toBe(true);
  });
});

describe('çiftten açma', () => {
  it('opens with 5 pairs whatever their values, not with 4', () => {
    const pairs = fivePairs();
    const g = rigged([...pairs.flat(), t('blue', 9)]);
    expect(err(g, 0, { type: 'open', melds: ids(pairs.slice(0, 4)) })).toBe('Çiftten açmak için en az 5 çift gerekli (4)');
    const s = ok(g, 0, { type: 'open', melds: ids(pairs) });
    expect(s.players[0]).toMatchObject({ opened: true, pairs: true });
    expect(s.table.every((m) => m.type === 'pair')).toBe(true);
    expect(s.lastAction).toMatchObject({ type: 'open', pairs: true, points: 5 });
    expect(viewFor(s, 1).players[0].pairs).toBe(true);
  });
  it('the okey can stand in a pair', () => {
    const pairs = [...fivePairs().slice(0, 4), [t('blue', 11), t('red', 5)]];
    const s = ok(rigged([...pairs.flat(), t('blue', 9)]), 0, { type: 'open', melds: ids(pairs) });
    expect(s.players[0].pairs).toBe(true);
  });
  it('rejects mixing pairs and sets, and non-identical pairs', () => {
    const pairs = fivePairs();
    const run = [t('yellow', 9), t('yellow', 10), t('yellow', 11)];
    const g = rigged([...pairs.flat(), ...run, t('blue', 9)]);
    expect(err(g, 0, { type: 'open', melds: [...ids(pairs), run.map((x) => x.id)] })).toBe('Çift ve per birlikte açılamaz');
    const bad = [t('blue', 8), t('black', 8)];
    const g2 = rigged([...pairs.flat(), ...bad, t('blue', 9)]);
    expect(err(g2, 0, { type: 'open', melds: [...ids(pairs.slice(0, 4)), bad.map((x) => x.id)] })).toMatch(/^Geçersiz çift: /);
  });
  it('after a pairs opening: more pairs and adding to melds, never a new set or run', () => {
    const pairs = fivePairs();
    const more = pair('yellow', 12);
    const run = [t('yellow', 9), t('yellow', 10), t('yellow', 11)];
    const add = t('black', 10);
    let g = rigged([...pairs.flat(), ...more, ...run, add, t('blue', 9)]);
    // Someone else's run on the table.
    g.table.push({
      id: 50,
      owner: 1,
      type: 'run',
      points: 33,
      tiles: [t('black', 11), t('black', 12), t('black', 13)],
      ordered: [],
      represents: {},
    });
    g.nextMeldId = 51;
    g = ok(g, 0, { type: 'open', melds: ids(pairs) });
    expect(err(g, 0, { type: 'meld', tileIds: run.map((x) => x.id) })).toBe(
      'Çiftten açan yeni per açamaz; yalnızca çift indirip perlere işleyebilir',
    );
    g = ok(g, 0, { type: 'meld', tileIds: more.map((x) => x.id) });
    expect(g.table.at(-1)!.type).toBe('pair');
    g = ok(g, 0, { type: 'addToMeld', meldId: 50, tileIds: [add.id] });
    expect(g.table.find((m) => m.id === 50)!.tiles).toHaveLength(4);
    // A pair on the table never grows.
    const pairMeld = g.table.find((m) => m.type === 'pair')!;
    expect(err(g, 0, { type: 'addToMeld', meldId: pairMeld.id, tileIds: [run[0].id] })).toMatch(/işlenemez/);
    expect(addableTiles(g.players[0].hand, g.table, g.okey).get(run[0].id) ?? []).not.toContain(pairMeld.id);
  });
  it('sets openers may not lay pairs', () => {
    const groups = [
      [t('blue', 13), t('black', 13), t('yellow', 13)],
      [t('black', 10), t('black', 11), t('black', 12)],
      [t('yellow', 9), t('yellow', 10), t('yellow', 11)],
    ];
    const p = pair('blue', 2);
    let g = rigged([...groups.flat(), ...p, t('red', 1)]);
    g = ok(g, 0, { type: 'open', melds: ids(groups) });
    expect(err(g, 0, { type: 'meld', tileIds: p.map((x) => x.id) })).toBe('Perden açan çift indiremez');
  });
  it('the hand is cancelled with no score when all four open with pairs', () => {
    const pairs = fivePairs();
    const g = rigged([...pairs.flat(), t('blue', 9)]);
    for (const s of [1, 2, 3]) Object.assign(g.players[s], { opened: true, pairs: true, penalties: 101 });
    const s = ok(g, 0, { type: 'open', melds: ids(pairs) });
    expect(s.phase).toBe('finished');
    expect(s.result).toMatchObject({ winner: null, cancelled: true, scores: [0, 0, 0, 0] });
  });
});

describe('çift puanlama', () => {
  /**
   * Seat 0 finishes by throwing its last tile. Seat 1 opened with sets (hand 4+6=10),
   * seat 2 opened with pairs (hand 1+2=3, plus an okey: a flat 101, its number not added),
   * seat 3 never opened.
   */
  function setup(winnerPairs: boolean, last: Tile) {
    const g = rigged([last]);
    Object.assign(g.players[0], { opened: true, pairs: winnerPairs, openedOnTurn: -4 });
    Object.assign(g.players[1], { opened: true, hand: [t('blue', 4), t('black', 6)] });
    Object.assign(g.players[2], { opened: true, pairs: true, hand: [t('blue', 1), t('yellow', 2), t('red', 5)] });
    return g;
  }
  const finish = (g: GameState) => ok(g, 0, { type: 'discard', tileId: g.players[0].hand[0].id });

  it('a pairs opener pays its leftover twice; the flat okey 101 is not doubled', () => {
    const s = finish(setup(false, t('blue', 2)));
    expect(s.result).toMatchObject({ multiplier: 1, pairs: false });
    // seat 2: (1 + 2) × 2 + 101
    expect(s.result!.scores).toEqual([-101, 10, 107, 202]);
  });
  it('finishing from pairs doubles the round: −202, sets ×2, pairs ×4, not opened 404', () => {
    const s = finish(setup(true, t('blue', 2)));
    expect(s.result).toMatchObject({ winner: 0, pairs: true, multiplier: 2, okeyFinish: false });
    expect(s.result!.scores).toEqual([-202, 20, 3 * 4 + 101, 404]);
  });
  it('pairs + okey finish: −404, sets ×4, pairs ×8, not opened 808', () => {
    const s = finish(setup(true, t('red', 5)));
    expect(s.result).toMatchObject({ pairs: true, okeyFinish: true, multiplier: 4 });
    expect(s.result!.scores).toEqual([-404, 40, 3 * 8 + 101, 808]);
  });
  it('a drawn round still doubles a pairs opener’s leftover', () => {
    let g = setup(false, t('blue', 2));
    g.players[0].hand.push(t('black', 9));
    g.deck = [];
    g.reshufflesLeft = 0;
    g = ok(g, 0, { type: 'discard', tileId: g.players[0].hand[0].id });
    expect(g.result).toMatchObject({ winner: null, multiplier: 1 });
    expect(g.result!.scores[2]).toBe(3 * 2 + 101);
  });
});

describe('bot ve çift', () => {
  it('opens with pairs when it holds five and no 101 in melds', () => {
    const pairs = fivePairs();
    const g = rigged([...pairs.flat(), t('black', 12), t('yellow', 8)]);
    const a = botStep(viewFor(g, 0), { level: 'hard', rng: seededRng(2) });
    expect(a.type).toBe('open');
    const s = ok(g, 0, a);
    expect(s.players[0].pairs).toBe(true);
  });
  it('after a pairs opening lays pairs, never sets', () => {
    const run = [t('yellow', 9), t('yellow', 10), t('yellow', 11)];
    const more = pair('blue', 12);
    const g = rigged([...run, ...more, t('black', 1)]);
    Object.assign(g.players[0], { opened: true, pairs: true, openedOnTurn: -4 });
    const a = botStep(viewFor(g, 0), { level: 'hard', rng: seededRng(2) });
    expect(a).toEqual({ type: 'meld', tileIds: more.map((x) => x.id) });
    const s = ok(g, 0, a);
    const b = botStep(viewFor(s, 0), { level: 'hard', rng: seededRng(2) });
    expect(b.type).toBe('discard');
  });
});
