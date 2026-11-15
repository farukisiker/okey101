import { describe, expect, it } from 'vitest';
import {
  addableTiles,
  analyzeMeld,
  analyzePair,
  isJoker,
  visibleDiscard,
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
  it('a taken pile shows empty until its owner throws again, never the older tile under it', () => {
    let g = createGame({ rng: seededRng(3) });
    const first = g.players[0].hand[0];
    g = ok(g, 0, { type: 'discard', tileId: first.id });
    // Lap 2: seat 0 throws again on top of the first tile.
    for (const s of [1, 2, 3]) {
      g = ok(g, s, { type: 'draw', source: 'deck' });
      g = ok(g, s, { type: 'discard', tileId: g.players[s].hand[0].id });
    }
    g = ok(g, 0, { type: 'draw', source: 'deck' });
    const second = g.players[0].hand[0];
    g = ok(g, 0, { type: 'discard', tileId: second.id });
    expect(visibleDiscard(viewFor(g, 2).players[0])).toEqual(second);
    g = ok(g, 1, { type: 'draw', source: 'discard' });
    expect(g.players[0].discards).toEqual([first]);
    expect(visibleDiscard(viewFor(g, 2).players[0])).toBeUndefined();
  });
  it('throwing the okey mid-hand costs 101 in 101', () => {
    let g = createGame({ rng: seededRng(3) });
    const okeyTile = { kind: 'normal', color: g.okey.color, value: g.okey.value, id: 9001 } as Tile;
    g.players[0].hand[0] = okeyTile;
    g = ok(g, 0, { type: 'discard', tileId: okeyTile.id });
    expect(g.players[0].penalties).toBe(101);
  });
  it('round ends when the deck runs out (no reshuffle)', () => {
    let g = createGame({ rng: seededRng(5), reshuffles: 0 });
    g = ok(g, 0, { type: 'discard', tileId: g.players[0].hand[0].id });
    while (g.phase === 'playing') {
      g = ok(g, g.turn, { type: 'draw', source: 'deck' });
      const notOkey = g.players[g.turn].hand.find((x) => !isJoker(x, g.okey))!;
      g = ok(g, g.turn, { type: 'discard', tileId: notOkey.id });
    }
    expect(g.deck).toHaveLength(0);
    expect(g.result?.winner).toBeNull();
    expect(g.result?.scores).toEqual([202, 202, 202, 202]);
  });
});

describe('yerdeki taşları karıştırma', () => {
  it('shuffles the discards into a new middle, keeping the last discard, at most N times', () => {
    let g = createGame({ rng: seededRng(5), reshuffles: 2 });
    g = ok(g, 0, { type: 'discard', tileId: g.players[0].hand[0].id });
    let reshuffled = 0;
    let steps = 0;
    while (g.phase === 'playing') {
      g = ok(g, g.turn, { type: 'draw', source: 'deck' });
      const seat = g.turn;
      const thrown = g.players[seat].hand[0];
      g = ok(g, seat, { type: 'discard', tileId: thrown.id });
      if (g.reshuffles > reshuffled) {
        reshuffled = g.reshuffles;
        // Only the tile just thrown stays on the table; the rest went back to the middle.
        expect(g.players.flatMap((p) => p.discards).map((t) => t.id)).toEqual([thrown.id]);
        expect(g.deck.length).toBeGreaterThan(0);
      }
      const total = 1 + g.deck.length + g.players.reduce((n, p) => n + p.hand.length + p.discards.length, 0);
      expect(total).toBe(106);
      if (++steps > 500) throw new Error('did not end');
    }
    expect(g.reshuffles).toBe(2);
    expect(g.result?.winner).toBeNull();
    expect(steps).toBeGreaterThan(50);
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

describe('yerden alınan taş', () => {
  it('cannot be left alone in hand after laying everything else', () => {
    const groups = opening();
    let g = rigged([...groups.flat(), t('red', 1)]);
    g.players[3].discards = [t('blue', 2)];
    g.turnPhase = 'draw';
    g = ok(g, 0, { type: 'draw', source: 'discard' });
    // Opening with all nine tiles would leave only the picked-up blue 2.
    expect(err(g, 0, { type: 'open', melds: [...ids(groups), [g.players[0].hand[9].id]] })).toBeTruthy();
    const withRed = [...ids(groups)];
    g.players[0].hand = g.players[0].hand.filter((x) => !(x.kind === 'normal' && x.color === 'red' && x.value === 1));
    expect(err(g, 0, { type: 'open', melds: withRed })).toMatch(/tek başına/);
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
    g.players[2].hand = [t('red', 5), t('blue', 1)]; // okey (red 5) left: counts 5, plus a flat 101
    return { g, groups };
  }

  it('opening and finishing in one turn while others have opened is not elden', () => {
    const { g, groups } = finishSetup(t('blue', 2));
    let s = ok(g, 0, { type: 'open', melds: ids(groups) });
    s = ok(s, 0, { type: 'discard', tileId: s.players[0].hand[0].id });
    expect(s.phase).toBe('finished');
    expect(s.result).toMatchObject({ winner: 0, elden: false, okeyFinish: false, multiplier: 1 });
    expect(s.result!.scores).toEqual([-101, 10, 107, 202]);
  });

  it('elden (nobody else opened): everyone else pays 404', () => {
    const { g, groups } = finishSetup(t('blue', 2));
    g.players[1].opened = false;
    g.players[2].opened = false;
    let s = ok(g, 0, { type: 'open', melds: ids(groups) });
    s = ok(s, 0, { type: 'discard', tileId: s.players[0].hand[0].id });
    expect(s.result).toMatchObject({ winner: 0, elden: true, multiplier: 2 });
    expect(s.result!.scores).toEqual([-202, 404, 404, 404]);
  });

  it('finishing on a later turn is not elden; finishing with okey doubles', () => {
    const { g, groups } = finishSetup(t('red', 5));
    g.players[0].opened = true;
    g.players[0].openedOnTurn = -4;
    g.players[0].hand = [t('red', 5)];
    void groups;
    const s = ok(g, 0, { type: 'discard', tileId: g.players[0].hand[0].id });
    expect(s.result).toMatchObject({ winner: 0, elden: false, okeyFinish: true, multiplier: 2 });
    // The okey's flat 101 is not doubled: (5 + 1) × 2 + 101.
    expect(s.result!.scores).toEqual([-202, 20, 113, 404]);
  });

  it('plain finish: multiplier 1', () => {
    const { g } = finishSetup(t('blue', 2));
    g.players[0].opened = true;
    g.players[0].openedOnTurn = -4;
    g.players[0].hand = [t('blue', 2)];
    const s = ok(g, 0, { type: 'discard', tileId: g.players[0].hand[0].id });
    expect(s.result!.scores).toEqual([-101, 10, 107, 202]);
  });
});

describe('yerdeki okeyi almak', () => {
  // Okey = red 5. Seat 1 owns a meld on the table; seat 0 has opened and plays.
  function withMeld(tiles: Tile[], hand: Tile[]) {
    const g = rigged(hand);
    g.turnPhase = 'play';
    g.players[0].opened = true;
    const a = analyzeMeld(tiles, g.okey)!;
    g.table = [{ id: 1, owner: 1, type: a.type, points: a.points, tiles, ordered: a.ordered, represents: a.represents }];
    return g;
  }

  it('run: the tile an okey stands for in the middle takes it; the owner pays 101', () => {
    const okey = t('red', 5);
    const blue7 = t('blue', 7);
    const g = withMeld([t('blue', 6), okey, t('blue', 8)], [blue7, t('black', 2), t('black', 3)]);
    const s = ok(g, 0, { type: 'addToMeld', meldId: 1, tileIds: [blue7.id] });
    expect(s.players[0].hand.map((x) => x.id)).toContain(okey.id);
    expect(s.table[0].tiles.map((x) => x.id)).not.toContain(okey.id);
    expect(s.players[1].penalties).toBe(101);
    expect(s.lastAction).toMatchObject({ type: 'addToMeld', tookOkeys: 1, from: 1 });
  });

  it('run: an okey at the end stays (the tile just extends the run)', () => {
    const okey = t('red', 5);
    const blue9 = t('blue', 9);
    const g = withMeld([t('blue', 7), t('blue', 8), okey], [blue9, t('black', 2), t('black', 3)]);
    // The end okey reads as blue 9, but it could be blue 6 too: not takeable.
    const s = ok(g, 0, { type: 'addToMeld', meldId: 1, tileIds: [blue9.id] });
    expect(s.table[0].tiles.map((x) => x.id)).toContain(okey.id);
    expect(s.players[1].penalties).toBe(0);
  });

  it('set: two colours + okey needs both missing colours; the okey comes off with the last one', () => {
    const okey = t('red', 5);
    const y12 = t('yellow', 12);
    const k12 = t('black', 12);
    let g = withMeld([t('red', 12), t('blue', 12), okey], [y12, k12, t('black', 2), t('black', 3)]);
    g = ok(g, 0, { type: 'addToMeld', meldId: 1, tileIds: [y12.id] });
    expect(g.table[0].tiles).toHaveLength(4);
    expect(g.players[0].hand.map((x) => x.id)).not.toContain(okey.id);
    g = ok(g, 0, { type: 'addToMeld', meldId: 1, tileIds: [k12.id] });
    expect(g.table[0].tiles.map((x) => x.id)).not.toContain(okey.id);
    expect(g.players[0].hand.map((x) => x.id)).toContain(okey.id);
    expect(g.players[1].penalties).toBe(101);
  });

  it('pair: the twin of the real tile frees the okey', () => {
    const okey = t('red', 5);
    const b9 = t('blue', 9);
    const g = rigged([b9, t('black', 2), t('black', 3)]);
    g.turnPhase = 'play';
    g.players[0].opened = true;
    const pairTiles = [t('blue', 9), okey];
    const a = analyzePair(pairTiles, g.okey)!;
    g.table = [{ id: 1, owner: 1, type: 'pair', points: 0, tiles: pairTiles, ordered: a.ordered, represents: a.represents }];
    const s = ok(g, 0, { type: 'addToMeld', meldId: 1, tileIds: [b9.id] });
    expect(s.players[0].hand.map((x) => x.id)).toContain(okey.id);
    expect(s.table[0].tiles.map((x) => x.id)).not.toContain(okey.id);
    expect(s.players[1].penalties).toBe(101);
  });

  it('taking back your own okey costs nothing; işlek marks the swap tile', () => {
    const okey = t('red', 5);
    const blue7 = t('blue', 7);
    const g = withMeld([t('blue', 6), okey, t('blue', 8)], [blue7, t('black', 2)]);
    g.table[0].owner = 0;
    expect(addableTiles(g.players[0].hand, g.table, g.okey).get(blue7.id)).toEqual([1]);
    const s = ok(g, 0, { type: 'addToMeld', meldId: 1, tileIds: [blue7.id] });
    expect(s.players[0].penalties).toBe(0);
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
