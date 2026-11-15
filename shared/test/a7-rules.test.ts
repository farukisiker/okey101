// A7: okey rule changes approved by the user on 15.11.2026 (decisions 1, 5, 6, 7) and live penalty notices.
import { describe, expect, it } from 'vitest';
import {
  type Action,
  type Color,
  type GameState,
  type IslekMode,
  type Tile,
  ISLEK_PENALTY,
  OKEY_TAKEN_PENALTY,
  analyzeMeld,
  applyAction,
  botStep,
  canShowIndicator,
  createGame,
  freezeClock,
  handPenalty,
  isIslek,
  okeyFromIndicator,
  okeySwap,
  quickMove,
  seededRng,
  viewFor,
} from '../src';

let nextId = 20000;
const t = (color: Color, value: number): Tile => ({ id: nextId++, kind: 'normal', color, value });
const fake = (): Tile => ({ id: nextId++, kind: 'fake' });
// Okey for every test here: red 5 (indicator red 4).
const okey = { color: 'red' as const, value: 5 };
const O = () => t('red', 5);

function ok(state: GameState, seat: number, action: Action): GameState {
  const r = applyAction(state, seat, action);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** 101 game (or düz), indicator red 4, seat 0 to play holding `hand0`. */
function rigged(hand0: Tile[], opts: { mode?: '101' | 'duz'; islek?: IslekMode } = {}): GameState {
  const g = createGame({ mode: opts.mode ?? '101', rng: seededRng(1), islek: opts.islek });
  g.indicator = { id: 9999, kind: 'normal', color: 'red', value: 4 };
  g.okey = okeyFromIndicator(g.indicator);
  g.gosterge = null;
  g.players[0].hand = hand0;
  g.turnPhase = 'play';
  return g;
}

/** A table meld as analyzeMeld lays it. */
function meld(id: number, owner: number, tiles: Tile[]) {
  const a = analyzeMeld(tiles, okey)!;
  return { id, owner, type: a.type, points: a.points, tiles, ordered: a.ordered, represents: a.represents };
}
const asMeld = (tiles: Tile[]) => meld(1, 1, tiles);

describe('karar 1: elde kalan okey', () => {
  it('handPenalty: the real okey adds only to `okeys`, a fake okey counts the okey number', () => {
    expect(handPenalty([t('blue', 3), t('blue', 5), O()], okey)).toEqual({ sum: 8, okeys: 1 });
    expect(handPenalty([t('blue', 3), t('blue', 5), O(), O()], okey)).toEqual({ sum: 8, okeys: 2 });
    expect(handPenalty([t('blue', 3), fake()], okey)).toEqual({ sum: 8, okeys: 0 });
  });

  /** Seat 0 finishes with `last`; seat 1 opened holding `hand1`. */
  function finish(hand1: Tile[], last: Tile) {
    const g = rigged([last]);
    Object.assign(g.players[0], { opened: true, openedOnTurn: -4 });
    Object.assign(g.players[1], { opened: true, hand: hand1 });
    return ok(g, 0, { type: 'discard', tileId: last.id }).result!;
  }

  it('3 + 5 + okey: (3 + 5) × multiplier + 101', () => {
    expect(finish([t('blue', 3), t('blue', 5), O()], t('blue', 1)).scores[1]).toBe(8 + 101);
    // Finishing with the okey doubles the sum only; the flat 101 is never multiplied.
    const r = finish([t('blue', 3), t('blue', 5), O()], O());
    expect(r.multiplier).toBe(2);
    expect(r.scores[1]).toBe(8 * 2 + 101);
  });

  it('two okeys: sum + 202', () => {
    expect(finish([t('blue', 3), t('blue', 5), O(), O()], t('blue', 1)).scores[1]).toBe(8 + 202);
  });

  it('a fake okey still counts the okey number', () => {
    expect(finish([t('blue', 3), fake()], t('blue', 1)).scores[1]).toBe(8);
  });
});

describe('karar 5: düz gösterge ilk turda taş atana kadar', () => {
  const twin = () => t('red', 4);

  it('the starter (no draw) may show before throwing', () => {
    const g = rigged([twin(), t('blue', 1)], { mode: 'duz' });
    expect(canShowIndicator(viewFor(g, 0))).toBe(true);
  });

  it('a later seat may show before and after drawing, not after throwing', () => {
    let g = rigged([t('blue', 1)], { mode: 'duz' });
    Object.assign(g, { turn: 1, turnNumber: 1, turnPhase: 'draw' });
    g.players[1].hand = [twin(), t('blue', 2), t('blue', 9)];
    expect(canShowIndicator(viewFor(g, 1))).toBe(true);
    g = ok(g, 1, { type: 'draw', source: 'deck' });
    expect(canShowIndicator(viewFor(g, 1))).toBe(true);
    expect(applyAction(g, 1, { type: 'showIndicator' }).ok).toBe(true);
    // Throwing ends the first turn: on the next lap it is too late.
    g = ok(g, 1, { type: 'discard', tileId: g.players[1].hand.find((x) => x.kind === 'normal' && x.value !== 4)!.id });
    for (const seat of [2, 3, 0]) {
      g = ok(g, seat, { type: 'draw', source: 'deck' });
      g = ok(g, seat, { type: 'discard', tileId: g.players[seat].hand[0].id });
    }
    expect(g.turn).toBe(1);
    g = ok(g, 1, { type: 'draw', source: 'deck' });
    expect(canShowIndicator(viewFor(g, 1))).toBe(false);
    expect(applyAction(g, 1, { type: 'showIndicator' }).ok).toBe(false);
  });

  it('the düz bot shows after drawing too', () => {
    let g = rigged([t('blue', 1)], { mode: 'duz' });
    Object.assign(g, { turn: 1, turnNumber: 1, turnPhase: 'draw' });
    g.players[1].hand = [twin(), ...g.players[1].hand.slice(1)];
    g = ok(g, 1, { type: 'draw', source: 'deck' });
    expect(botStep(viewFor(g, 1), { level: 'hard', rng: seededRng(3) })).toEqual({ type: 'showIndicator' });
  });
});

describe('karar 6: seri ucundaki okey', () => {
  const freed = (tiles: Tile[], add: Tile) => okeySwap(asMeld(tiles), [add], okey)?.freed.map((x) => x.id) ?? null;

  it('alınır: 11-12-O + 13 (the okey is 13)', () => {
    const o = O();
    expect(freed([t('blue', 11), t('blue', 12), o], t('blue', 13))).toEqual([o.id]);
  });

  it('alınır: O-2-3 + 1 (the okey is 1, even though the table reads it as 4)', () => {
    const o = O();
    expect(asMeld([o, t('blue', 2), t('blue', 3)]).represents[o.id]).toEqual({ color: 'blue', value: 4 });
    expect(freed([o, t('blue', 2), t('blue', 3)], t('blue', 1))).toEqual([o.id]);
  });

  it('alınır: 10-O-12-O + 13 frees the spare end okey, never the gap okey', () => {
    const [o1, o2] = [O(), O()];
    const tiles = [t('blue', 10), t('blue', 12), o1, o2];
    const end = [o1, o2].find((o) => asMeld(tiles).represents[o.id].value === 13)!;
    const swap = okeySwap(asMeld(tiles), [t('blue', 13)], okey)!;
    expect(swap.freed.map((x) => x.id)).toEqual([end.id]);
    expect(analyzeMeld(swap.tiles, okey)).toMatchObject({ type: 'run', points: 10 + 11 + 12 + 13 });
  });

  it('12-O-O is read as a set of 12s (equal points, set first), so the set rule applies, not the end rule', () => {
    expect(asMeld([t('blue', 12), O(), O()]).type).toBe('set');
    expect(freed([t('blue', 12), O(), O()], t('blue', 13))).toBeNull();
  });

  it('alınmaz: two-way ends stay (7-8-O + 9 or 6, O-5-6 + 4 or 7)', () => {
    expect(freed([t('blue', 7), t('blue', 8), O()], t('blue', 9))).toBeNull();
    expect(freed([t('blue', 7), t('blue', 8), O()], t('blue', 6))).toBeNull();
    expect(freed([O(), t('blue', 5), t('blue', 6)], t('blue', 4))).toBeNull();
    expect(freed([O(), t('blue', 5), t('blue', 6)], t('blue', 7))).toBeNull();
  });

  it('alınmaz: 10-11-O + 13 (13 is not next to the highest real tile)', () => {
    expect(freed([t('blue', 10), t('blue', 11), O()], t('blue', 13))).toBeNull();
  });

  it('end rule never frees a gap okey; the gap okey still comes off with its own tile', () => {
    const o = O();
    expect(freed([t('blue', 10), o, t('blue', 12)], t('blue', 13))).toBeNull();
    expect(freed([t('blue', 10), o, t('blue', 12)], t('blue', 11))).toEqual([o.id]);
  });

  it('middle swap unchanged: 5-O-7-8 + 6 frees the okey', () => {
    const o = O();
    expect(freed([t('blue', 5), o, t('blue', 7), t('blue', 8)], t('blue', 6))).toEqual([o.id]);
  });

  it('middle swap unchanged: with two okeys only the middle one comes off with its tile', () => {
    const [o1, o2] = [O(), O()];
    const tiles = [t('blue', 3), o1, t('blue', 5), t('blue', 6), o2];
    const m = asMeld(tiles);
    const mid = [o1, o2].find((o) => m.represents[o.id].value === 4)!;
    expect(freed(tiles, t('blue', 4))).toEqual([mid.id]);
    expect(freed(tiles, t('blue', 7))).toBeNull(); // end okey, 7 is not a number limit
  });

  /** Seat 1 owns `tiles` on the table; seat 0 has opened and holds `hand`. */
  function withMeld(tiles: Tile[], hand: Tile[], owner = 1) {
    const g = rigged(hand);
    g.players[0].opened = true;
    g.table = [meld(1, owner, tiles)];
    return g;
  }

  it('middle swap via the reducer: 10-O-12 + 11, the owner pays OKEY_TAKEN_PENALTY with a notice', () => {
    const o = O();
    const b11 = t('blue', 11);
    const s = ok(withMeld([t('blue', 10), o, t('blue', 12)], [b11, t('black', 2), t('black', 3)]), 0, {
      type: 'addToMeld',
      meldId: 1,
      tileIds: [b11.id],
    });
    expect(s.players[0].hand.map((x) => x.id)).toContain(o.id);
    expect(s.players[1].penalties).toBe(OKEY_TAKEN_PENALTY);
    expect(s.notice).toEqual({ id: 1, seat: 1, reason: 'okeyTaken', amount: OKEY_TAKEN_PENALTY });
  });

  it('end okey via the reducer: 11-12-O + 13 takes it; own meld costs nothing and writes no notice', () => {
    const o = O();
    const b13 = t('blue', 13);
    const hand = () => [b13, t('black', 2), t('black', 3)];
    const s = ok(withMeld([t('blue', 11), t('blue', 12), o], hand()), 0, { type: 'addToMeld', meldId: 1, tileIds: [b13.id] });
    expect(s.players[0].hand.map((x) => x.id)).toContain(o.id);
    expect(s.table[0].tiles.map((x) => x.id)).not.toContain(o.id);
    expect(s.players[1].penalties).toBe(OKEY_TAKEN_PENALTY);
    expect(s.lastAction).toMatchObject({ type: 'addToMeld', tookOkeys: 1, from: 1 });
    const own = ok(withMeld([t('blue', 11), t('blue', 12), o], hand(), 0), 0, { type: 'addToMeld', meldId: 1, tileIds: [b13.id] });
    expect(own.players[0].penalties).toBe(0);
    expect(own.notice).toBeNull();
  });

  it('a pair still never gives up its okey', () => {
    const p = { id: 1, owner: 1, type: 'pair' as const, tiles: [t('blue', 13), O()] };
    expect(okeySwap(p, [t('blue', 13)], okey)).toBeNull();
  });

  it('the bot takes a decided end okey', () => {
    const o = O();
    const b13 = t('blue', 13);
    const g = withMeld([t('blue', 11), t('blue', 12), o], [b13, t('black', 1), t('yellow', 7)]);
    const a = botStep(viewFor(g, 0), { level: 'hard', rng: seededRng(2) });
    expect(a).toEqual({ type: 'addToMeld', meldId: 1, tileIds: [b13.id] });
    expect(ok(g, 0, a).players[0].hand.map((x) => x.id)).toContain(o.id);
  });
});

describe('karar 7: işlek', () => {
  /** Seat 1's run yellow 9-10-11 is on the table; seat 0 holds `hand`. */
  function table(hand: Tile[], islek?: IslekMode, opened = true) {
    const g = rigged(hand, { islek });
    g.players[0].opened = opened;
    g.players[1].opened = true;
    g.table = [meld(1, 1, [t('yellow', 9), t('yellow', 10), t('yellow', 11)])];
    return g;
  }
  const throwFirst = (g: GameState) => ok(g, 0, { type: 'discard', tileId: g.players[0].hand[0].id });

  it('default is "opened": an opened player pays 101 with a notice', () => {
    expect(createGame({ rng: seededRng(1) }).islek).toBe('opened');
    const s = throwFirst(table([t('yellow', 12), t('blue', 1), t('blue', 2)]));
    expect(s.players[0].penalties).toBe(ISLEK_PENALTY);
    expect(s.notice).toEqual({ id: 1, seat: 0, reason: 'islek', amount: ISLEK_PENALTY });
    expect(viewFor(s, 2).notice).toEqual(s.notice);
    expect(viewFor(s, 2).islek).toBe('opened');
  });

  it('"opened": a player who has not opened pays nothing; "all": they pay too; "off": nobody', () => {
    const hand = () => [t('yellow', 12), t('blue', 1), t('blue', 2)];
    expect(throwFirst(table(hand(), 'opened', false)).players[0].penalties).toBe(0);
    expect(throwFirst(table(hand(), 'all', false)).players[0].penalties).toBe(ISLEK_PENALTY);
    const off = throwFirst(table(hand(), 'off'));
    expect(off.players[0].penalties).toBe(0);
    expect(off.notice).toBeNull();
  });

  it('a non-fitting tile is not işlek; a set fits by its missing colour', () => {
    expect(throwFirst(table([t('yellow', 7), t('blue', 1), t('blue', 2)])).players[0].penalties).toBe(0);
    const g = table([t('red', 8), t('blue', 1), t('blue', 2)]);
    g.table.push(meld(2, 1, [t('blue', 8), t('black', 8), t('yellow', 8)]));
    expect(throwFirst(g).players[0].penalties).toBe(ISLEK_PENALTY);
  });

  it('a tile that takes an okey off a run counts as işlek', () => {
    const g = rigged([t('blue', 13), t('blue', 1), t('black', 2)]);
    g.players[0].opened = true;
    g.table = [meld(1, 1, [t('blue', 11), t('blue', 12), O()])];
    expect(isIslek(g, true, g.players[0].hand[0])).toBe(true);
    expect(throwFirst(g).players[0].penalties).toBe(ISLEK_PENALTY);
  });

  it('pairs on the table are never işlek', () => {
    const g = rigged([t('blue', 4), t('blue', 1), t('black', 2)]);
    g.players[0].opened = true;
    g.table = [{ id: 1, owner: 1, type: 'pair', points: 0, tiles: [t('blue', 4), t('blue', 4)], ordered: [], represents: {} }];
    expect(throwFirst(g).players[0].penalties).toBe(0);
  });

  it('the finishing tile is never işlek', () => {
    const g = table([t('yellow', 12)]);
    g.players[0].openedOnTurn = -4;
    const s = throwFirst(g);
    expect(s.phase).toBe('finished');
    expect(s.players[0].penalties).toBe(0);
    expect(s.result!.scores[0]).toBe(-101);
  });

  it('throwing the okey pays only the okey penalty (101, not 202)', () => {
    const s = throwFirst(table([O(), t('blue', 1), t('blue', 2)]));
    expect(s.players[0].penalties).toBe(101);
    expect(s.notice).toMatchObject({ reason: 'okeyDiscard', amount: 101 });
  });

  it('unused side tile + işlek in one throw: two notices, ids 1 and 2, the view shows the last', () => {
    const g = table([t('yellow', 12), t('blue', 1)]);
    g.turnPhase = 'draw';
    g.players[3].discards = [t('black', 9)];
    let s = ok(g, 0, { type: 'draw', source: 'discard' });
    s = throwFirst(s);
    expect(s.players[0].penalties).toBe(202);
    expect(s.notice).toEqual({ id: 2, seat: 0, reason: 'islek', amount: ISLEK_PENALTY });
    expect(viewFor(s, 1).notice).toEqual(s.notice);
  });

  it('notice ids keep counting within the round; a new deal starts at null', () => {
    let g = table([t('yellow', 12), t('blue', 1), t('blue', 2)]);
    g = throwFirst(g);
    expect(g.notice!.id).toBe(1);
    // Seat 1 throws its okey (it opened, so its own throw is checked too).
    g = ok(g, 1, { type: 'draw', source: 'deck' });
    g.players[1].hand.push(O());
    g = ok(g, 1, { type: 'discard', tileId: g.players[1].hand.at(-1)!.id });
    expect(g.notice).toMatchObject({ id: 2, seat: 1, reason: 'okeyDiscard' });
    expect(createGame({ rng: seededRng(4) }).notice).toBeNull();
  });

  it('düz okey has no işlek', () => {
    const g = rigged([t('blue', 1)], { mode: 'duz', islek: 'all' });
    expect(isIslek(g, true, t('blue', 2))).toBe(false);
  });

  it('bot: throws a non-işlek tile when it can ("all", not opened)', () => {
    // Without the rule the bot throws yellow 12 (useless, highest); with it, blue 1.
    const hand = () => [t('yellow', 12), t('blue', 1), t('black', 6), t('black', 7), t('black', 8)];
    const pick = (islek: IslekMode) => {
      const g = table(hand(), islek, false);
      const a = botStep(viewFor(g, 0), { level: 'hard', rng: seededRng(5) });
      expect(a.type).toBe('discard');
      return g.players[0].hand.find((x) => x.id === (a as { tileId: number }).tileId)!;
    };
    expect(pick('off')).toMatchObject({ color: 'yellow', value: 12 });
    expect(pick('all')).toMatchObject({ color: 'blue', value: 1 });
  });

  it('quick move (timeout) avoids işlek too', () => {
    const g = table([t('yellow', 12), t('blue', 1), t('black', 6), t('black', 7), t('black', 8)]);
    const a = quickMove(viewFor(g, 0)) as { type: string; tileId: number };
    expect(g.players[0].hand.find((x) => x.id === a.tileId)).toMatchObject({ color: 'blue', value: 1 });
  });

  it('seeded bot games: a bot throws işlek only when every legal tile is işlek', () => {
    let islekThrows = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const rng = seededRng(seed * 7);
      let g = createGame({ rng: seededRng(seed), islek: seed % 2 ? 'opened' : 'all' });
      for (let step = 0; step < 600 && g.phase === 'playing'; step++) {
        const seat = g.turn;
        const view = viewFor(g, seat);
        const a = botStep(view, { level: seed % 3 ? 'hard' : 'medium', rng });
        if (a.type === 'discard') {
          const p = g.players[seat];
          const tile = p.hand.find((x) => x.id === a.tileId)!;
          if (p.hand.length > 1 && isIslek(g, p.opened, tile)) {
            islekThrows++;
            const legal = p.hand.filter((x) => x.id !== g.mustUseTileId);
            expect(legal.every((x) => isIslek(g, p.opened, x))).toBe(true);
          }
        }
        g = ok(g, seat, a);
      }
    }
    // Forced throws are rare; the property above is what matters.
    expect(islekThrows).toBeLessThan(12);
  });
});

describe('freezeClock', () => {
  it('moves the deadline out by the freeze, keeps the rest; null and 0 are no-ops', () => {
    const c = { turnNumber: 3, deadline: 10_000, refilled: false };
    expect(freezeClock(c, 5000)).toEqual({ turnNumber: 3, deadline: 15_000, refilled: false });
    expect(c.deadline).toBe(10_000);
    expect(freezeClock(null, 5000)).toBeNull();
    expect(freezeClock(c, 0)).toBe(c);
  });
});
