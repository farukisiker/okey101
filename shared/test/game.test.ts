import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  createTileSet,
  findBestMelds,
  okeyFromIndicator,
  seededRng,
  viewFor,
  type Action,
  type Color,
  type GameState,
  type Tile,
} from '../src';

let nextId = 5000;
const t = (color: Color, value: number): Tile => ({ id: nextId++, kind: 'normal', color, value });

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

/** Game with indicator red 4 (okey = red 5) and a hand set for seat 0. */
function rigged(hand0: Tile[]): GameState {
  const g = createGame({ rng: seededRng(1) });
  g.indicator = { id: 9999, kind: 'normal', color: 'red', value: 4 };
  g.okey = okeyFromIndicator(g.indicator);
  g.players[0].hand = hand0;
  return g;
}

// 39 + 33 + 30 = 102
const opening = () => [
  [t('blue', 13), t('black', 13), t('yellow', 13)],
  [t('black', 10), t('black', 11), t('black', 12)],
  [t('yellow', 9), t('yellow', 10), t('yellow', 11)],
];
const ids = (g: Tile[][]) => g.map((m) => m.map((x) => x.id));

describe('dağıtım', () => {
  it('uses 106 tiles: 104 numbered + 2 fake okeys', () => {
    const tiles = createTileSet();
    expect(tiles).toHaveLength(106);
    expect(tiles.filter((x) => x.kind === 'fake')).toHaveLength(2);
    expect(new Set(tiles.map((x) => x.id)).size).toBe(106);
  });
  it('deals 22 to the starter, 21 to others, 1 indicator, 20 left', () => {
    const g = createGame({ rng: seededRng(42), startingSeat: 2 });
    expect(g.players.map((p) => p.hand.length)).toEqual([21, 21, 22, 21]);
    expect(g.deck).toHaveLength(20);
    expect(g.indicator.kind).toBe('normal');
    expect(g.turn).toBe(2);
    expect(g.turnPhase).toBe('play');
  });
  it('okey is one above the indicator, 13 wraps to 1', () => {
    expect(okeyFromIndicator({ id: 0, kind: 'normal', color: 'blue', value: 7 })).toEqual({ color: 'blue', value: 8 });
    expect(okeyFromIndicator({ id: 0, kind: 'normal', color: 'black', value: 13 })).toEqual({ color: 'black', value: 1 });
  });
});

describe('sıra', () => {
  it('starter discards without drawing, next player must draw first', () => {
    let g = createGame({ rng: seededRng(3) });
    expect(err(g, 0, { type: 'draw', source: 'deck' })).toMatch(/çektiniz/);
    expect(err(g, 1, { type: 'discard', tileId: g.players[1].hand[0].id })).toMatch(/Sıra/);
    const tile = g.players[0].hand[0];
    g = ok(g, 0, { type: 'discard', tileId: tile.id });
    expect(g.turn).toBe(1);
    expect(err(g, 1, { type: 'discard', tileId: g.players[1].hand[0].id })).toMatch(/çekmelisiniz/);
    // can take the left player's (seat 0) discard
    g = ok(g, 1, { type: 'draw', source: 'discard' });
    expect(g.players[1].hand.map((x) => x.id)).toContain(tile.id);
    expect(g.players[0].discards).toHaveLength(0);
  });
  it('deck draw takes from the middle', () => {
    let g = createGame({ rng: seededRng(3) });
    g = ok(g, 0, { type: 'discard', tileId: g.players[0].hand[0].id });
    g = ok(g, 1, { type: 'draw', source: 'deck' });
    expect(g.deck).toHaveLength(19);
    expect(g.players[1].hand).toHaveLength(22);
  });
  it('an unused discard pickup costs 101 and cannot be thrown straight back', () => {
    let g = createGame({ rng: seededRng(3) });
    const tile = g.players[0].hand[0];
    g = ok(g, 0, { type: 'discard', tileId: tile.id });
    g = ok(g, 1, { type: 'draw', source: 'discard' });
    expect(err(g, 1, { type: 'discard', tileId: tile.id })).toMatch(/geri atamazsınız/);
    g = ok(g, 1, { type: 'discard', tileId: g.players[1].hand[0].id });
    expect(g.players[1].penalties).toBe(101);
  });
  it('round ends when the deck runs out', () => {
    let g = createGame({ rng: seededRng(5) });
    g = ok(g, 0, { type: 'discard', tileId: g.players[0].hand[0].id });
    while (g.phase === 'playing') {
      g = ok(g, g.turn, { type: 'draw', source: 'deck' });
      g = ok(g, g.turn, { type: 'discard', tileId: g.players[g.turn].hand[0].id });
    }
    expect(g.deck).toHaveLength(0);
    expect(g.result?.winner).toBeNull();
    expect(g.result?.scores).toEqual([202, 202, 202, 202]);
  });
});

describe('açma (101)', () => {
  it('rejects under 101 and accepts 101+', () => {
    const groups = opening();
    const low = [[t('blue', 1), t('blue', 2), t('blue', 3)]];
    const g = rigged([...groups.flat(), ...low.flat(), t('red', 1)]);
    expect(err(g, 0, { type: 'open', melds: [...ids(groups).slice(0, 2), ...ids(low)] })).toMatch(/101/);
    const g2 = ok(g, 0, { type: 'open', melds: ids(groups) });
    expect(g2.players[0].opened).toBe(true);
    expect(g2.table).toHaveLength(3);
    expect(g2.players[0].hand).toHaveLength(4);
  });
  it('rejects invalid melds and must keep a tile to discard', () => {
    const groups = opening();
    const g = rigged(groups.flat());
    expect(err(g, 0, { type: 'open', melds: ids(groups) })).toMatch(/bir taş kalmalı/);
    const bad = [t('blue', 1), t('black', 2), t('blue', 3)];
    const g2 = rigged([...groups.flat(), ...bad, t('red', 1)]);
    expect(err(g2, 0, { type: 'open', melds: [...ids(groups), bad.map((x) => x.id)] })).toMatch(/Geçersiz/);
  });
  it('okey counts with its represented value toward 101', () => {
    const j = t('red', 5);
    const groups = [
      [t('blue', 12), t('black', 12), j], // 36
      [t('black', 10), t('black', 11), t('black', 12)], // 33
      [t('yellow', 9), t('yellow', 10), t('yellow', 11)], // 30
      [t('blue', 1), t('blue', 2), t('blue', 3)], // 6
    ];
    const g = ok(rigged([...groups.flat(), t('red', 1)]), 0, { type: 'open', melds: ids(groups) });
    expect(g.table.reduce((s, m) => s + m.points, 0)).toBe(105);
  });
  it('cannot lay or add melds before opening; can after', () => {
    const groups = opening();
    const extra = [t('blue', 1), t('blue', 2), t('blue', 3)];
    const add = t('black', 9);
    let g = rigged([...groups.flat(), ...extra, add, t('red', 1)]);
    expect(err(g, 0, { type: 'meld', tileIds: extra.map((x) => x.id) })).toMatch(/açmalısınız/);
    g = ok(g, 0, { type: 'open', melds: ids(groups) });
    g = ok(g, 0, { type: 'meld', tileIds: extra.map((x) => x.id) });
    const run = g.table.find((m) => m.tiles.some((x) => x.kind === 'normal' && x.color === 'black' && x.value === 10))!;
    g = ok(g, 0, { type: 'addToMeld', meldId: run.id, tileIds: [add.id] });
    expect(g.table.find((m) => m.id === run.id)!.points).toBe(42);
    expect(err(g, 0, { type: 'addToMeld', meldId: run.id, tileIds: [g.players[0].hand[0].id] })).toBeTruthy();
  });
});

describe('bitirme ve puan', () => {
  function finishSetup(lastTile: Tile) {
    const groups = opening();
    const g = rigged([...groups.flat(), lastTile]);
    // seat 1 opened with a few tiles left
    g.players[1].opened = true;
    g.players[1].hand = [t('blue', 4), t('black', 6)];
    g.players[2].opened = true;
    g.players[2].hand = [t('red', 5), t('blue', 1)]; // okey left in hand = 101
    return { g, groups };
  }

  it('winner -101, opened players pay hand sum, unopened pay 202; elden doubles', () => {
    const { g, groups } = finishSetup(t('blue', 2));
    let s = ok(g, 0, { type: 'open', melds: ids(groups) });
    s = ok(s, 0, { type: 'discard', tileId: s.players[0].hand[0].id });
    expect(s.phase).toBe('finished');
    expect(s.result).toMatchObject({ winner: 0, elden: true, okeyFinish: false, multiplier: 2 });
    expect(s.result!.scores).toEqual([-202, 20, 204, 404]);
  });

  it('finishing on a later turn is not elden; finishing with okey doubles', () => {
    const { g, groups } = finishSetup(t('red', 5));
    g.players[0].opened = true;
    g.players[0].openedOnTurn = -4;
    g.players[0].hand = [t('red', 5)];
    void groups;
    const s = ok(g, 0, { type: 'discard', tileId: g.players[0].hand[0].id });
    expect(s.result).toMatchObject({ winner: 0, elden: false, okeyFinish: true, multiplier: 2 });
    expect(s.result!.scores).toEqual([-202, 20, 204, 404]);
  });

  it('plain finish: multiplier 1', () => {
    const { g } = finishSetup(t('blue', 2));
    g.players[0].opened = true;
    g.players[0].openedOnTurn = -4;
    g.players[0].hand = [t('blue', 2)];
    const s = ok(g, 0, { type: 'discard', tileId: g.players[0].hand[0].id });
    expect(s.result!.scores).toEqual([-101, 10, 102, 202]);
  });
});

describe('gizli bilgi', () => {
  it('a view shows only your own hand', () => {
    const g = createGame({ rng: seededRng(9) });
    const v = viewFor(g, 1);
    expect(v.hand).toEqual(g.players[1].hand);
    expect(v.players[0]).not.toHaveProperty('hand');
    expect(v.players.map((p) => p.handCount)).toEqual([22, 21, 21, 21]);
    expect(JSON.stringify(v)).not.toContain(JSON.stringify(g.players[0].hand[0]));
    expect(v.revealedHands).toBeNull();
  });
});

describe('solver', () => {
  it('finds a 101+ opening and keeps a tile', () => {
    const hand = [...opening().flat(), t('red', 1), t('blue', 7)];
    const r = findBestMelds(hand, { color: 'red', value: 5 }, { maxTiles: hand.length - 1 });
    expect(r.points).toBe(102);
    expect(r.melds.flat()).toHaveLength(9);
  });
  it('handles duplicates and jokers', () => {
    const hand = [t('blue', 3), t('blue', 4), t('blue', 3), t('blue', 4), t('red', 5), t('red', 5)];
    const r = findBestMelds(hand, { color: 'red', value: 5 });
    expect(r.melds).toHaveLength(2);
    expect(r.points).toBe(24);
  });
});
