// A4 (Claude Opus): one-off new catalog test (approved by Fable). The generic host clock driven by
// the okey adapter's turn/refillsClock gives exactly today's @okey/shared nextClock, step by step.
import { describe, expect, it } from 'vitest';
import { nextTurnClock, type TurnClock } from '@kahve/core';
import { nextClock, seededRng, type Action, type GameMode, type GameState } from '@okey/shared';
import { makeOkeyDef } from '../src/okey';

const NAMES = ['A', 'B', 'C', 'D'];
const BASE = makeOkeyDef('101').clock.baseMs;

function sweep(mode: GameMode, seeds: number, base: number) {
  const def = makeOkeyDef(mode);
  const rules = { ...def.clock, baseMs: base };
  let lays = 0;
  let refillsSeen = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const bot = seededRng(seed ^ 0x9e3779b9);
    let s: GameState = def.create(def.defaultOptions, NAMES, seededRng(seed), seed % 4);
    let now = 1_000_000 + seed;
    let a: TurnClock | null = nextClock(null, s, null, now, base);
    let b: TurnClock | null = nextTurnClock(null, def.turn(s), false, now, rules);
    expect(b).toEqual(a);
    for (let step = 0; s.phase === 'playing'; step++) {
      if (step > 3000) throw new Error(`${mode} seed ${seed}: no finish`);
      const seat = def.turn(s)!.seat;
      const action: Action = def.botMove(s, seat, 'medium', bot);
      const r = def.apply(s, seat, action);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
      now += 137 + (step % 7) * 1000;
      a = nextClock(a, s, action, now, base);
      b = nextTurnClock(b, def.turn(s), def.refillsClock(action), now, rules);
      expect(b).toEqual(a);
      if (def.refillsClock(action)) lays++;
      if (a?.refilled) refillsSeen++;
    }
    expect(b).toBeNull();
  }
  return { lays, refillsSeen };
}

describe('nextTurnClock + okey adapter equals shared nextClock', () => {
  it('okey 101, 40 seeded bot hands, default 30 s base', () => {
    const { lays, refillsSeen } = sweep('101', 40, BASE);
    // Not vacuous: bots opened/melded and refills happened.
    expect(lays).toBeGreaterThan(0);
    expect(refillsSeen).toBeGreaterThan(0);
  });
  it('okey 101 with a custom base (room turnTimeoutMs)', () => {
    sweep('101', 10, 1000);
  });
  it('düz okey, 5 seeded bot hands (no open/meld in düz: fresh clock per turn only)', () => {
    sweep('duz', 5, BASE);
  });
});
