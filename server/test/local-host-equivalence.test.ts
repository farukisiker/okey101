// B5: the app's offline LocalHost must move exactly like the server Room (Fable's condition for the copy):
// same seed, same names, same human moves -> same states, clocks, notice freezes, bot timing, totals and log.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnyGameDefinition, GameDefinition } from '@kahve/core';
import { okey101Def, okeyDuzDef } from '@kahve/catalog';
import { Room, replay } from '../src/room';
import { LocalHost } from '../../app/src/net/localHost';
import { type StubAction, type StubOptions, type StubState, type StubView, stubDef } from './stub-game';

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => vi.useRealTimers());

/** The stub with a live notice every second move, so the freeze path runs too. */
const noticeStub: GameDefinition<StubState, StubAction, StubView, StubOptions> = {
  ...stubDef,
  noticeOf: (s) => (s.moves >= 2 ? { id: Math.floor(s.moves / 2), seat: 0, reason: 'stub', amount: 1 } : null),
};

interface Pair {
  room: Room<unknown, unknown, unknown>;
  host: LocalHost<unknown, unknown, unknown>;
  stop(): void;
}

/** One human at seat 0 (connected), bots elsewhere; the host is driven by a real (fake) timer like the hook. */
function pair(def: AnyGameDefinition, opts: { seed: number; options?: unknown; botDelayMs: number; turnTimeoutMs: number; noticeMs?: number }): Pair {
  const room = new Room<unknown, unknown, unknown>('EQ', () => {}, { ...opts, definition: def });
  room.join('Ali', 's1');
  expect(room.start()).toBeNull();
  const host = new LocalHost<unknown, unknown, unknown>(def, opts);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    const due = host.due;
    if (!due) return;
    timer = setTimeout(() => {
      host.runDue(Date.now());
      arm();
    }, due.at - Date.now());
  };
  expect(host.start(room.seats.map((s) => s!.name), Date.now())).toEqual({ ok: true });
  arm();
  const origAct = host.act.bind(host);
  host.act = (seat, action, now) => {
    const r = origAct(seat, action, now);
    arm();
    return r;
  };
  const origNext = host.nextRound.bind(host);
  host.nextRound = (now) => {
    const r = origNext(now);
    arm();
    return r;
  };
  return {
    room,
    host,
    stop: () => {
      room.dispose();
      if (timer) clearTimeout(timer);
    },
  };
}

function same({ room, host }: Pair) {
  const now = Date.now();
  expect(host.state).toEqual(room.game);
  expect(host.round).toBe(room.round);
  expect(host.totals).toEqual(room.totals);
  expect(host.matchOver()).toBe(room.matchOver());
  expect(host.view(0, now)).toEqual(room.viewFor(0));
  expect(host.view(1, now)).toEqual(room.viewFor(1));
  expect(host.log).toEqual(room.actionLog().filter((e) => e.t !== 'rename'));
}

/** Advances in small steps and compares after each; returns the steps taken. */
function run(p: Pair, ms: number, step: number) {
  for (let t = 0; t < ms; t += step) {
    vi.advanceTimersByTime(step);
    same(p);
  }
}

describe('LocalHost = Room', () => {
  it('stub game: bots, the human timing out, refill, several rounds and a match end', () => {
    for (const seats of [2, 4]) {
      const p = pair(stubDef, { seed: 7 + seats, options: { seats, target: 6 }, botDelayMs: 300, turnTimeoutMs: 2000 });
      same(p);
      for (let r = 0; r < 6; r++) {
        // The human thinks once (refills the clock) when it is their turn, then lets the clock run out.
        const turn = stubDef.turn(p.host.state as StubState);
        if (turn?.seat === 0) {
          expect(p.room.act(0, { type: 'think' })).toBeNull();
          expect(p.host.act(0, { type: 'think' }, Date.now())).toEqual({ ok: true });
          same(p);
        }
        run(p, 40_000, 100);
        expect(p.host.roundOver()).toBe(true);
        expect(p.room.nextRound()).toBeNull();
        expect(p.host.nextRound(Date.now())).toEqual({ ok: true });
        same(p);
      }
      expect(p.host.round).toBe(7);
      p.stop();
    }
  });

  it('notices freeze the clock and the bots the same way', () => {
    const p = pair(noticeStub, { seed: 3, options: { seats: 4, target: 12 }, botDelayMs: 200, turnTimeoutMs: 3000, noticeMs: 1500 });
    let sawFreeze = false;
    for (let t = 0; t < 60_000 && !p.host.roundOver(); t += 50) {
      vi.advanceTimersByTime(50);
      same(p);
      if (p.host.frozenUntil > Date.now()) sawFreeze = true;
    }
    expect(sawFreeze).toBe(true);
    expect(p.host.roundOver()).toBe(true);
    p.stop();
  });

  it('a wrong move is refused by both and changes nothing', () => {
    const p = pair(stubDef, { seed: 1, options: { seats: 2 }, botDelayMs: 300, turnTimeoutMs: 2000 });
    const notMine = (stubDef.turn(p.host.state as StubState)!.seat + 1) % 2;
    const a: StubAction = { type: 'add', n: 1 };
    expect(p.room.act(notMine, a)).not.toBeNull();
    expect(p.host.act(notMine, a, Date.now()).ok).toBe(false);
    same(p);
    p.stop();
  });

  it('okey 101 and düz okey through the real definitions (bots, timeouts, live penalties)', () => {
    for (const [def, seed] of [
      [okey101Def, 21],
      [okeyDuzDef, 22],
    ] as const) {
      const p = pair(def, { seed, botDelayMs: 20, turnTimeoutMs: 200 });
      for (let r = 0; r < 2; r++) {
        run(p, 120_000, 500);
        expect(p.host.roundOver()).toBe(true);
        expect(p.room.nextRound()).toBeNull();
        expect(p.host.nextRound(Date.now())).toEqual({ ok: true });
        same(p);
      }
      p.stop();
    }
  });

  it('the host log replays to the same state (bug reports work offline too)', () => {
    const p = pair(stubDef, { seed: 99, options: { seats: 4, target: 8 }, botDelayMs: 100, turnTimeoutMs: 500 });
    run(p, 20_000, 200);
    expect(replay(stubDef, p.host.options, p.host.seed, p.host.log)).toEqual(p.host.state);
    p.stop();
  });
});
