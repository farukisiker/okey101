// A4 test helper: a tiny 2/4-seat game behind the GameDefinition contract, registered only in
// tests (via RoomOptions.definition) because no non-okey game is playable in phase A.
// Rules: seats take turns adding 1 or 2 to a shared sum; whoever reaches `target` wins the round.
// 'think' keeps the turn and refills the clock (like okey's open/meld).
import type { GameDefinition, TurnClock } from '@kahve/core';

export interface StubState {
  names: string[];
  sum: number;
  target: number;
  turn: number;
  moves: number;
  winner: number | null;
}
export type StubAction = { type: 'add'; n: 1 | 2 } | { type: 'think' };
export interface StubView {
  seat: number;
  names: string[];
  sum: number;
  turn: number;
  clock: TurnClock | null;
}
export interface StubOptions {
  seats: number;
  target: number;
}

export const stubDef: GameDefinition<StubState, StubAction, StubView, StubOptions> = {
  id: 'pisti',
  group: 'kagit',
  status: 'active',
  seatChoices: [2, 4],
  titleKey: 'game.pisti',
  defaultOptions: { seats: 2, target: 10 },
  normalizeOptions: (raw) => {
    const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<StubOptions>;
    return { seats: r.seats === 4 ? 4 : 2, target: typeof r.target === 'number' && r.target > 0 ? r.target : 10 };
  },
  seats: (o) => o.seats,
  clock: { baseMs: 5000, firstTurnFactor: 3 },
  // The deal draws one number so the seed matters for replay.
  create: (o, names, rng, round) => ({
    names: [...names],
    sum: Math.floor(rng() * 2),
    target: o.target,
    turn: round % names.length,
    moves: 0,
    winner: null,
  }),
  isAction: (raw): raw is StubAction => {
    if (typeof raw !== 'object' || raw === null) return false;
    const a = raw as { type?: unknown; n?: unknown };
    return a.type === 'think' || (a.type === 'add' && (a.n === 1 || a.n === 2));
  },
  apply: (s, seat, a) => {
    if (s.winner !== null) return { ok: false, error: 'Tur bitti' };
    if (seat !== s.turn) return { ok: false, error: 'Sıra sizde değil' };
    if (a.type === 'think') return { ok: true, state: { ...s } };
    const sum = s.sum + a.n;
    const won = sum >= s.target;
    return {
      ok: true,
      state: { ...s, sum, moves: s.moves + 1, winner: won ? seat : null, turn: won ? s.turn : (s.turn + 1) % s.names.length },
    };
  },
  viewFor: (s, seat, ctx) => ({ seat, names: s.names, sum: s.sum, turn: s.turn, clock: ctx?.clock ?? null }),
  turn: (s) => (s.winner === null ? { seat: s.turn, key: s.moves, first: s.moves === 0 } : null),
  refillsClock: (a) => a.type === 'think',
  botMove: (_s, _seat, _level, rng) => ({ type: 'add', n: rng() < 0.5 ? 1 : 2 }),
  quickMove: () => ({ type: 'add', n: 1 }),
  roundOver: (s) => s.winner !== null,
  scoreRound: (s) => s.names.map((_, i) => (i === s.winner ? 1 : 0)),
  matchOver: (totals) => totals.some((t) => t >= 2),
};
