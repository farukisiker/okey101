import { describe, expect, it } from 'vitest';
import { seededRng, type BotLevel } from '@kahve/core';
import { tavlaDef } from '../src';
import type { TavlaAction, TavlaState } from '../src/types';
import { counts, names } from './helpers';

const LEVELS: BotLevel[] = ['easy', 'medium', 'hard'];

interface GameStats {
  invalid: number;
  quickInvalid: number;
  conservation: number;
  mutated: number;
  actions: number;
  turns: number;
  log: string[];
  final: TavlaState;
  levels: BotLevel[];
}

/** One game of two bots. `viaJson` passes the state through JSON before every action. */
function playGame(seed: number, viaJson = false): GameStats {
  const rng = seededRng(seed);
  // All nine level pairs, cycling with the seed.
  const levels: BotLevel[] = [LEVELS[seed % 3], LEVELS[Math.floor(seed / 3) % 3]];
  const opts = tavlaDef.normalizeOptions({});
  let s = tavlaDef.create(opts, names, rng, 0);
  const st: GameStats = { invalid: 0, quickInvalid: 0, conservation: 0, mutated: 0, actions: 0, turns: 0, log: [], final: s, levels };
  while (!tavlaDef.roundOver(s) && st.actions < 3000) {
    const turn = tavlaDef.turn(s);
    if (!turn) break;
    if (viaJson) s = JSON.parse(JSON.stringify(s)) as TavlaState;
    const before = st.actions % 7 === 0 ? JSON.stringify(s) : null;
    const quick = tavlaDef.quickMove(s, turn.seat);
    if (!tavlaDef.apply(s, turn.seat, quick).ok) st.quickInvalid++;
    const action: TavlaAction = tavlaDef.botMove(s, turn.seat, levels[turn.seat], rng);
    if (!tavlaDef.isAction(action)) st.invalid++;
    const r = tavlaDef.apply(s, turn.seat, action);
    if (before !== null && JSON.stringify(s) !== before) st.mutated++;
    if (!r.ok) {
      st.invalid++;
      st.log.push(`ILLEGAL ${turn.seat}:${JSON.stringify(action)} ${r.error}`);
      break;
    }
    const [w, b] = counts(r.state.board);
    if (w !== 15 || b !== 15) st.conservation++;
    if (action.type === 'commit') st.turns++;
    st.log.push(`${turn.seat}:${JSON.stringify(action)}`);
    st.actions++;
    s = r.state;
  }
  st.final = s;
  return st;
}

describe('bot-vs-bot simulation', () => {
  it('200 seeded games over all level pairs: every game ends, no illegal move, 30 checkers kept', () => {
    let invalid = 0;
    let quickInvalid = 0;
    let conservation = 0;
    let mutated = 0;
    let unfinished = 0;
    let turns = 0;
    const kinds: Record<string, number> = { tek: 0, mars: 0, koncina: 0 };
    // wins[level][opponentLevel] for the cross-level games
    const wins: Record<string, number> = {};
    const t0 = performance.now();
    for (let seed = 0; seed < 200; seed++) {
      const g = playGame(seed);
      invalid += g.invalid;
      quickInvalid += g.quickInvalid;
      conservation += g.conservation;
      mutated += g.mutated;
      turns += g.turns;
      if (g.invalid > 0) console.log(`seed ${seed}: ${g.log.slice(-3).join(' | ')}`);
      if (g.final.phase !== 'finished' || !g.final.result) {
        unfinished++;
        continue;
      }
      kinds[g.final.result.kind]++;
      const score = tavlaDef.scoreRound(g.final);
      expect(score[g.final.result.winner]).toBe(g.final.result.points);
      expect(score[1 - g.final.result.winner]).toBe(0);
      expect(g.final.board.off[g.final.result.winner]).toBe(15);
      const [a, b] = g.levels;
      if (a !== b) {
        const key = `${g.levels[g.final.result.winner]}>${g.levels[1 - g.final.result.winner]}`;
        wins[key] = (wins[key] ?? 0) + 1;
      }
    }
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    console.log(
      `[tavla sim] 200 games, ${turns} turns, ${secs}s; invalid ${invalid}, quickInvalid ${quickInvalid}, conservation ${conservation}, mutated ${mutated}, unfinished ${unfinished}; kinds ${JSON.stringify(kinds)}; cross-level wins ${JSON.stringify(wins)}`,
    );
    expect(invalid).toBe(0);
    expect(quickInvalid).toBe(0);
    expect(conservation).toBe(0);
    expect(mutated).toBe(0);
    expect(unfinished).toBe(0);
  }, 600_000);

  it('JSON round trip before every action continues the same game', () => {
    for (let seed = 0; seed < 12; seed++) {
      const a = playGame(seed);
      const b = playGame(seed, true);
      expect(b.log).toEqual(a.log);
      expect(b.final).toEqual(a.final);
    }
  }, 300_000);

  it('same seed and same actions give the same dice and states', () => {
    const a = playGame(77);
    const b = playGame(77);
    expect(JSON.stringify(b.final)).toBe(JSON.stringify(a.final));
    expect(a.final.rngState).toBe(b.final.rngState);
  }, 120_000);
});
