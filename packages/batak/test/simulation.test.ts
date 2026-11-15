import { describe, expect, it } from 'vitest';
import { seededRng, type BotLevel } from '@kahve/core';
import { batakDef } from '../src';
import { clone } from '../src/clone';
import type { BatakAction, BatakState } from '../src/types';

const LEVELS: BotLevel[] = ['easy', 'medium', 'hard', 'medium'];
const names = ['A', 'B', 'C', 'D'];

interface MatchStats {
  invalid: number;
  quickInvalid: number;
  rounds: number;
  actions: number;
  log: string[];
  totals: number[];
  levels: BotLevel[];
  contracts: number;
  made: number;
  forced: number;
}

/** One full match of four bots. `viaJson` passes the state through a JSON clone before every action. */
function playMatch(seed: number, viaJson = false): MatchStats {
  const rng = seededRng(seed);
  const levels = LEVELS.map((_, i) => LEVELS[(i + seed) % 4]);
  const opts = batakDef.normalizeOptions({});
  const stats: MatchStats = { invalid: 0, quickInvalid: 0, rounds: 0, actions: 0, log: [], totals: [0, 0, 0, 0], levels, contracts: 0, made: 0, forced: 0 };
  while (!batakDef.matchOver(stats.totals, stats.rounds, opts) && stats.rounds < 20) {
    let s: BatakState = batakDef.create(opts, names, rng, stats.rounds);
    let guard = 0;
    while (!batakDef.roundOver(s) && guard++ < 200) {
      const turn = batakDef.turn(s);
      if (!turn) break;
      if (viaJson) s = clone(s);
      const quick = batakDef.quickMove(s, turn.seat);
      if (!batakDef.apply(s, turn.seat, quick).ok) stats.quickInvalid++;
      const action: BatakAction = batakDef.botMove(s, turn.seat, levels[turn.seat], rng);
      if (!batakDef.isAction(action)) stats.invalid++;
      const r = batakDef.apply(s, turn.seat, action);
      if (!r.ok) {
        stats.invalid++;
        break;
      }
      stats.log.push(`${turn.seat}:${JSON.stringify(action)}`);
      stats.actions++;
      s = r.state;
    }
    expect(batakDef.roundOver(s)).toBe(true);
    const scores = batakDef.scoreRound(s);
    stats.totals = stats.totals.map((t, i) => t + scores[i]);
    stats.contracts++;
    if (s.forcedBid) stats.forced++;
    if (s.tricksWon[s.declarer as number] >= s.contract) stats.made++;
    stats.rounds++;
  }
  return stats;
}

describe('bot-vs-bot simulation', () => {
  it('200 seeded matches: zero invalid bot moves and zero invalid quick moves', () => {
    let invalid = 0;
    let quickInvalid = 0;
    let rounds = 0;
    let actions = 0;
    let contracts = 0;
    let made = 0;
    let forced = 0;
    const byLevel: Record<BotLevel, { points: number; seats: number }> = { easy: { points: 0, seats: 0 }, medium: { points: 0, seats: 0 }, hard: { points: 0, seats: 0 } };
    for (let seed = 1; seed <= 200; seed++) {
      const m = playMatch(seed);
      invalid += m.invalid;
      quickInvalid += m.quickInvalid;
      rounds += m.rounds;
      actions += m.actions;
      contracts += m.contracts;
      made += m.made;
      forced += m.forced;
      m.levels.forEach((lv, i) => {
        byLevel[lv].points += m.totals[i];
        byLevel[lv].seats++;
      });
      expect(batakDef.matchOver(m.totals, m.rounds, batakDef.defaultOptions)).toBe(true);
      expect(m.rounds === 9 || m.rounds === 10).toBe(true);
    }
    const avg = (lv: BotLevel) => (byLevel[lv].points / byLevel[lv].seats).toFixed(1);
    console.log(
      `[B3 sim] matches=200 rounds=${rounds} actions=${actions} invalid=${invalid} quickInvalid=${quickInvalid} ` +
        `contractsMade=${made}/${contracts} (${((100 * made) / contracts).toFixed(1)}%) forcedDealer=${forced} ` +
        `avgMatchPoints easy=${avg('easy')} medium=${avg('medium')} hard=${avg('hard')}`,
    );
    expect(invalid).toBe(0);
    expect(quickInvalid).toBe(0);
    expect(Number(avg('hard'))).toBeGreaterThan(Number(avg('easy')));
    expect(Number(avg('medium'))).toBeGreaterThan(Number(avg('easy')));
  }, 120_000);

  it('same seed -> same action log; JSON-cloned state every step gives the same match', () => {
    for (const seed of [3, 17, 42, 99, 150]) {
      const a = playMatch(seed);
      expect(playMatch(seed).log).toEqual(a.log);
      const b = playMatch(seed, true);
      expect(b.log).toEqual(a.log);
      expect(b.totals).toEqual(a.totals);
    }
  }, 60_000);
});

describe('batakDef contract', () => {
  it('meta and clock', () => {
    expect(batakDef).toMatchObject({ id: 'batak', group: 'kagit', status: 'active', seatChoices: [4], titleKey: 'game.batak', clock: { baseMs: 30000, firstTurnFactor: 2 } });
    expect(batakDef.seats(batakDef.defaultOptions)).toBe(4);
    expect(batakDef.refillsClock({ type: 'pass' })).toBe(false);
    expect(batakDef.noticeOf).toBeUndefined();
  });
  it('turn info and rename', () => {
    const s = batakDef.create(batakDef.defaultOptions, names, seededRng(1), 2);
    expect(batakDef.turn(s)).toEqual({ seat: 2, key: 0, first: true });
    const t = batakDef.renameSeat!(s, 1, 'Bot');
    expect(t.players[1].name).toBe('Bot');
    expect(s.players[1].name).toBe('B');
    expect({ ...t, players: s.players }).toEqual(s);
  });
  it('apply never throws on garbage and never mutates', () => {
    const s = batakDef.create(batakDef.defaultOptions, names, seededRng(4), 0);
    const before = JSON.stringify(s);
    const junk: unknown[] = [undefined, null, 0, 'x', [], {}, { type: 'bid', amount: NaN }, { type: 'bid', amount: 1e20 }, { type: 'play', cardId: 3.5 }, { type: 'selectTrump', suit: null }, { type: 'pass', extra: { deep: 1 } }];
    for (const a of junk) for (const seat of [-1, 0, 1, 4, 0.5, NaN]) expect(() => batakDef.apply(s, seat, a as BatakAction)).not.toThrow();
    for (const a of junk) expect(batakDef.apply(s, 0, a as BatakAction).ok).toBe(a !== null && typeof a === 'object' && (a as { type?: string }).type === 'pass');
    expect(batakDef.apply({} as BatakState, 0, { type: 'pass' }).ok).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
  });
});
