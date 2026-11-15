import { describe, expect, it } from 'vitest';
import { applyAction, botStep, createGame, DEFAULT_RESHUFFLES, seededRng, viewFor, type GameMode, type GameState } from '@okey/shared';
import { makeOkeyDef } from '../src/okey';

const STEP_CAP = 3000;
const NAMES = ['A', 'B', 'C', 'D'];
const BOT_SALT = 0x9e3779b9;

/**
 * One hand bot-vs-bot along both paths. Each path has its own pair of identically seeded rngs
 * (one for the deal, one for bot moves), because botStep consumes rng too.
 */
export function playBoth(mode: GameMode, seed: number) {
  const def = makeOkeyDef(mode);
  const round = seed % 4;
  const opts = def.normalizeOptions({ reshuffles: DEFAULT_RESHUFFLES });

  let a: GameState = createGame({ mode, names: NAMES, startingSeat: round % 4, rng: seededRng(seed), reshuffles: DEFAULT_RESHUFFLES });
  let b: GameState = def.create(opts, NAMES, seededRng(seed), round);
  const botA = seededRng(seed ^ BOT_SALT);
  const botB = seededRng(seed ^ BOT_SALT);
  expect(JSON.stringify(b)).toBe(JSON.stringify(a));

  let steps = 0;
  while (a.phase === 'playing') {
    if (++steps > STEP_CAP) throw new Error(`${mode} seed ${seed}: no finish within ${STEP_CAP} steps`);
    const turn = def.turn(b);
    expect(turn).toEqual({ seat: a.turn, key: a.turnNumber, first: a.turnNumber === 0 });
    const actA = botStep(viewFor(a, a.turn), { rng: botA, level: 'medium' });
    const actB = def.botMove(b, turn!.seat, 'medium', botB);
    expect(actB).toEqual(actA);
    expect(def.isAction(actB)).toBe(true);
    const ra = applyAction(a, a.turn, actA);
    const rb = def.apply(b, turn!.seat, actB);
    if (!ra.ok || !rb.ok) throw new Error(`${mode} seed ${seed}: bot made an illegal move`);
    a = ra.state;
    b = rb.state;
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  }
  expect(def.roundOver(b)).toBe(true);
  expect(def.turn(b)).toBeNull();
  expect(def.scoreRound(b)).toEqual(a.result!.scores);
  return { winner: a.result!.winner, steps };
}

/**
 * Registers the equivalence test for one mode. `KAHVE_EQ_SEEDS=200` runs the full sweep for any mode
 * (düz bots are ~10x slower than 101, so its default is smaller to keep the package under ~20 s).
 */
export function equivalenceSuite(mode: GameMode, defaultSeeds: number) {
  // tsconfig has no node types, so reach process through globalThis.
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
  const seeds = Number(env?.KAHVE_EQ_SEEDS) || defaultSeeds;
  describe(`okey ${mode} adapter equals direct shared calls`, () => {
    it(`${seeds} seeded bot hands match step by step`, () => {
      let wins = 0;
      for (let seed = 1; seed <= seeds; seed++) if (playBoth(mode, seed).winner !== null) wins++;
      // Not vacuous: a good share of hands end with a real finish, not only deck-out.
      expect(wins).toBeGreaterThan(seeds / 10);
    }, 600_000);
  });
}
