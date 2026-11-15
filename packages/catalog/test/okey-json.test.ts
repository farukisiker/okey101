import { describe, expect, it } from 'vitest';
import { seededRng, type GameMode, type GameState } from '@okey/shared';
import { makeOkeyDef } from '../src/okey';

const NAMES = ['A', 'B', 'C', 'D'];

function playOut(mode: GameMode, start: GameState, rng: () => number): GameState {
  const def = makeOkeyDef(mode);
  let s = start;
  for (let i = 0; i < 3000 && def.turn(s); i++) {
    const seat = def.turn(s)!.seat;
    const r = def.apply(s, seat, def.botMove(s, seat, 'medium', rng));
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  expect(def.roundOver(s)).toBe(true);
  return s;
}

describe.each<GameMode>(['101', 'duz'])('okey %s state survives JSON mid-hand', (mode) => {
  it('a JSON round-tripped state plays on to the same result', () => {
    const def = makeOkeyDef(mode);
    for (let seed = 1; seed <= (mode === '101' ? 20 : 5); seed++) {
      let s = def.create(def.defaultOptions, NAMES, seededRng(seed), 0);
      const rng = seededRng(seed + 1000);
      for (let i = 0; i < 30 && def.turn(s); i++) {
        const seat = def.turn(s)!.seat;
        const r = def.apply(s, seat, def.botMove(s, seat, 'medium', rng));
        if (!r.ok) throw new Error(r.error);
        s = r.state;
      }
      const clone: GameState = JSON.parse(JSON.stringify(s));
      expect(clone).toEqual(s);
      const endA = playOut(mode, s, seededRng(seed + 2000));
      const endB = playOut(mode, clone, seededRng(seed + 2000));
      expect(JSON.stringify(endB)).toBe(JSON.stringify(endA));
      expect(def.scoreRound(endB)).toEqual(def.scoreRound(endA));
      // the view is plain JSON too
      const v = def.viewFor(clone, 0, { clock: null, now: 0 });
      expect(JSON.parse(JSON.stringify(v))).toEqual(v);
    }
  }, 60_000);
});
