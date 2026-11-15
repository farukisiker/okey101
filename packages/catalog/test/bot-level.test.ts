import { describe, expect, it } from 'vitest';
import { seededRng } from '@okey/shared';
import { makeOkeyDef } from '../src/okey';

const NAMES = ['A', 'B', 'C', 'D'];

describe('bot levels', () => {
  it('easy plays exactly like medium', () => {
    for (const mode of ['101', 'duz'] as const) {
      const def = makeOkeyDef(mode);
      for (let seed = 1; seed <= 5; seed++) {
        let s = def.create(def.defaultOptions, NAMES, seededRng(seed), seed);
        const r1 = seededRng(seed);
        const r2 = seededRng(seed);
        for (let i = 0; i < 40 && def.turn(s); i++) {
          const seat = def.turn(s)!.seat;
          const easy = def.botMove(s, seat, 'easy', r1);
          expect(def.botMove(s, seat, 'medium', r2)).toEqual(easy);
          const r = def.apply(s, seat, easy);
          if (!r.ok) throw new Error(r.error);
          s = r.state;
        }
      }
    }
  }, 60_000);
});
