// C4a: does `viewFor` leak hidden information in tavla? Tavla is a full-information game; the only
// hidden value is the dice generator (`rngState`, a counter that would reveal every future roll).
// The generic tile-shaped gates in leak-harness.ts (hands, deckCount) do not apply to it, so this
// file drives seeded bot games itself and re-uses the harness's BIG_SEED and collectKeys.
import { describe, expect, it } from 'vitest';
import { seededRng } from '@kahve/core';
import { tavlaDef, type TavlaState } from '@kahve/tavla';
import type { TavlaView } from '@kahve/catalog';
import { BIG_SEED, collectKeys } from './leak-harness';

const SEEDS = Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.KAHVE_LEAK_SEEDS) || 25;
const SAMPLE_EVERY = 3;
const STEP_CAP = 3000;
const LEVELS = ['easy', 'medium', 'hard'] as const;

const VIEW_KEYS = [
  'options', 'round', 'seat', 'players', 'board', 'turn', 'turnNumber', 'phase', 'dice', 'remaining', 'steps',
  'openingRoll', 'moves', 'canCommit', 'mustPass', 'canUndo', 'lastTurn', 'result', 'clock',
];
const FORBIDDEN_KEYS = ['rngState', 'seed', 'rng', 'random', 'state', 'turnStart'];

const ctx = { clock: null, now: 0 };
const view = (s: TavlaState, seat: number) => tavlaDef.viewFor(s, seat, ctx) as TavlaView;
const text = (s: TavlaState, seat: number) => JSON.stringify(view(s, seat));
const clone = (s: TavlaState): TavlaState => JSON.parse(JSON.stringify(s));

function deal(seed: number): TavlaState {
  const o = tavlaDef.normalizeOptions(undefined);
  return tavlaDef.create(o, ['A', 'B'], seededRng(seed), seed % 3);
}

function stepBot(s: TavlaState, step: number, rng: () => number): TavlaState {
  const t = tavlaDef.turn(s)!;
  const r = tavlaDef.apply(s, t.seat, tavlaDef.botMove(s, t.seat, LEVELS[step % 3]!, rng));
  if (!r.ok) throw new Error(`bot move rejected: ${r.error}`);
  return r.state;
}

describe('viewFor leaks: tavla', () => {
  it(`${SEEDS} seeded bot games: keys, no rngState, deterministic, public data matches, every seat + spectator`, () => {
    let samples = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const rng = seededRng(seed ^ 0x9e3779b9);
      let s = deal(seed);
      const rngValue = String(s.rngState);
      let step = 0;
      while (tavlaDef.turn(s) !== null) {
        if (step > STEP_CAP) throw new Error(`seed ${seed}: no finish within ${STEP_CAP} steps`);
        if (step % SAMPLE_EVERY === 0) {
          const turn = tavlaDef.turn(s)!;
          for (const seat of [0, 1, -1]) {
            const v = view(s, seat);
            const t = JSON.stringify(v);
            const label = `seed=${seed} step=${step} seat=${seat}`;
            expect(Object.keys(v).sort(), `${label}: view keys`).toEqual([...VIEW_KEYS].sort());
            const keys = collectKeys(v);
            for (const k of FORBIDDEN_KEYS) expect(keys, `${label}: forbidden key ${k}`).not.toContain(k);
            expect(t).not.toContain('rngState');
            expect(t, `${label}: rngState value in the view`).not.toContain(`"rngState":${rngValue}`);
            expect(JSON.stringify(view(s, seat)), `${label}: viewFor is not deterministic`).toBe(t);
            // public data matches the state exactly (not vacuous)
            expect(v.board).toEqual(s.board);
            expect(v.dice).toEqual(s.dice);
            expect(v.remaining).toEqual(s.remaining);
            expect(v.openingRoll).toEqual(s.openingRoll);
            expect(v.turn).toBe(turn.seat);
            expect(v.seat).toBe(seat);
            expect(v.players.map((p) => p.seat)).toEqual([0, 1]);
            // moves and buttons only for the player on turn
            if (seat !== turn.seat) {
              expect(v.moves, label).toEqual([]);
              expect(v.canCommit).toBe(false);
              expect(v.mustPass).toBe(false);
              expect(v.canUndo).toBe(false);
            }
          }
          samples++;
        }
        s = stepBot(s, step, rng);
        step++;
      }
      // finished: still no rngState, result public
      for (const seat of [0, 1, -1]) {
        const v = view(s, seat);
        expect(v.phase).toBe('finished');
        expect(v.turn).toBeNull();
        expect(v.result).toEqual(s.result);
        expect(v.moves).toEqual([]);
        expect(JSON.stringify(v)).not.toContain('rngState');
      }
    }
    expect(samples).toBeGreaterThan(SEEDS * 10);
  }, 600_000);

  it('two states identical except rngState give identical views (every seat, mid-game and finished)', () => {
    let mutations = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const rng = seededRng(seed ^ 0x9e3779b9);
      let s = deal(seed);
      for (let step = 0; step < 12 && tavlaDef.turn(s) !== null; step++) s = stepBot(s, step, rng);
      const states = [s];
      while (tavlaDef.turn(s) !== null) s = stepBot(s, 0, rng);
      states.push(s);
      for (const base of states) {
        const mutated = clone(base);
        mutated.rngState = BIG_SEED;
        expect(mutated.rngState).not.toBe(base.rngState);
        for (const seat of [0, 1, -1, 2]) {
          const a = text(base, seat);
          const b = text(mutated, seat);
          expect(b, `seed=${seed} seat=${seat}: rngState changed the view`).toBe(a);
          expect(b).not.toContain(String(BIG_SEED));
        }
        mutations++;
      }
    }
    expect(mutations).toBe(SEEDS * 2);
  });

  it('control: a different rngState changes what the engine rolls next (it is real hidden state)', () => {
    let differs = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const rng = seededRng(seed);
      let s = deal(seed);
      for (let i = 0; i < 40 && tavlaDef.turn(s) !== null; i++) s = stepBot(s, i, rng);
      const other = clone(s);
      other.rngState = BIG_SEED;
      const play = (st: TavlaState) => {
        const r = seededRng(7);
        let x = st;
        const dice: string[] = [];
        for (let i = 0; i < 30 && tavlaDef.turn(x) !== null; i++) {
          x = stepBot(x, 0, r);
          dice.push(JSON.stringify(x.dice));
        }
        return dice.join('|');
      };
      if (play(s) !== play(other)) differs++;
    }
    expect(differs).toBeGreaterThan(SEEDS / 2);
  });

  it('invalid seats (-1, 2, 5, 99) get seat -1, no moves, no buttons; they see the public board', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const rng = seededRng(seed);
      let s = deal(seed);
      for (let i = 0; i < 9 && tavlaDef.turn(s) !== null; i++) s = stepBot(s, i, rng);
      const real = view(s, 0);
      for (const seat of [-1, 2, 5, 99]) {
        const v = view(s, seat);
        expect(v.seat, `seat ${seat}`).toBe(-1);
        expect(v.moves).toEqual([]);
        expect(v.canCommit).toBe(false);
        expect(v.mustPass).toBe(false);
        expect(v.canUndo).toBe(false);
        expect(v.board).toEqual(real.board);
        expect(v.dice).toEqual(real.dice);
        expect(v.players).toEqual(real.players);
        expect(JSON.stringify(v)).not.toContain('rngState');
      }
    }
  });

  it('only the seat on turn gets legal moves; the opponent and spectators get none', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const s = deal(seed);
      const t = tavlaDef.turn(s)!;
      expect(view(s, t.seat).moves.length).toBeGreaterThan(0);
      expect(view(s, 1 - t.seat).moves).toEqual([]);
      expect(view(s, -1).moves).toEqual([]);
    }
  });
});
