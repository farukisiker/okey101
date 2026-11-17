import type { ViewContext } from '@kahve/core';
import { absFrom, absTo, boardPips, copyBoard, type Pos } from './board';
import { checkStep, turnCtx, type TurnCtx } from './rules';
import type { CheckerMove, TavlaState, TavlaView } from './types';

interface Node {
  from: number;
  r: number;
  dice: number[];
  ctx: TurnCtx;
}

const distinct = (xs: readonly number[]): number[] => xs.filter((x, i) => xs.indexOf(x) === i);

/**
 * Moves the UI can offer: every legal next step (one die), then targets one checker reaches with several dice in a
 * row, each intermediate step legal and still a prefix of a maximal sequence. One entry per (from, to), shortest dice.
 */
export function checkerMoves(c: TurnCtx): CheckerMove[] {
  if (c.left === 0) return [];
  const out: CheckerMove[] = [];
  const seen = new Set<string>();
  const add = (from: number, t: number, dice: number[]) => {
    const m: CheckerMove = { from: absFrom(c.seat, from), to: absTo(c.seat, t), dice };
    const k = `${m.from}>${m.to}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(m);
  };
  let level: Node[] = [];
  for (const d of distinct(c.rem)) {
    for (let r = 25; r >= 1; r--) {
      if (c.pos[r] <= 0) continue;
      const ck = checkStep(c, r, d);
      if ('error' in ck) continue;
      const t = r - d;
      add(r, t, [d]);
      if (t >= 1) level.push({ from: r, r: t, dice: [d], ctx: next(c, ck.pos, ck.rest) });
    }
  }
  while (level.length > 0) {
    const nextLevel: Node[] = [];
    for (const n of level) {
      if (n.ctx.left === 0) continue;
      for (const d of distinct(n.ctx.rem)) {
        const ck = checkStep(n.ctx, n.r, d);
        if ('error' in ck) continue;
        const t = n.r - d;
        const dice = [...n.dice, d];
        add(n.from, t, dice);
        if (t >= 1) nextLevel.push({ from: n.from, r: t, dice, ctx: next(n.ctx, ck.pos, ck.rest) });
      }
    }
    level = nextLevel;
  }
  return out;
}

/** Context after one step (the larger-die rule only ever applies to the first step). */
const next = (c: TurnCtx, pos: Pos, rest: number[]): TurnCtx => ({ seat: c.seat, pos, rem: rest, left: c.left - 1, bigOnly: null });

/** What one seat sees: everything except the dice generator. Hints only on the viewer's own turn. */
export function viewFor(s: TavlaState, seat: number, ctx?: ViewContext): TavlaView {
  const valid = seat === 0 || seat === 1;
  const mine = valid && s.phase === 'playing' && s.turn === seat;
  const c = mine ? turnCtx(s) : null;
  return {
    options: { ...s.options },
    round: s.round,
    seat: valid ? seat : -1,
    players: s.players.map(p => ({ seat: p.seat, name: p.name, pips: boardPips(s.board, p.seat) })),
    board: copyBoard(s.board),
    turn: s.phase === 'finished' ? null : s.turn,
    turnNumber: s.turnNumber,
    phase: s.phase,
    dice: [s.dice[0], s.dice[1]],
    remaining: s.remaining.slice(),
    steps: s.steps.map(st => ({ ...st })),
    openingRoll: [s.openingRoll[0], s.openingRoll[1]],
    moves: c ? checkerMoves(c) : [],
    canCommit: c ? c.left === 0 : false,
    mustPass: c ? c.left === 0 && s.steps.length === 0 : false,
    canUndo: mine && s.steps.length > 0,
    lastTurn: s.lastTurn
      ? { turnNumber: s.lastTurn.turnNumber, seat: s.lastTurn.seat, dice: [s.lastTurn.dice[0], s.lastTurn.dice[1]], steps: s.lastTurn.steps.map(st => ({ ...st })) }
      : null,
    result: s.result ? { ...s.result } : null,
    clock: ctx?.clock ? { ...ctx.clock } : null,
  };
}
