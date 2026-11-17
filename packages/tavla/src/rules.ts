import type { ApplyResult, Rng } from '@kahve/core';
import {
  CHECKERS,
  OP,
  absTo,
  allHome,
  canMove,
  copyBoard,
  doMove,
  fromPos,
  initialBoard,
  maxPlayable,
  relOf,
  removeDie,
  toPos,
  type Pos,
} from './board';
import { diceToPlay, rollDie, rollPair, seedDice } from './dice';
import { normalizeOptions } from './options';
import type { Board, From, Step, TavlaAction, TavlaOptions, TavlaResult, TavlaState } from './types';

export const SEATS = 2;

/** A new game: the opening roll (one die each, ties re-rolled) decides who starts, and the starter plays those dice. */
export function create(opts: TavlaOptions, names: string[], rng: Rng, round: number): TavlaState {
  const options = normalizeOptions(opts);
  let rngState = seedDice(rng);
  let white = 0;
  let black = 0;
  do {
    [white, rngState] = rollDie(rngState);
    [black, rngState] = rollDie(rngState);
  } while (white === black);
  const board = initialBoard();
  return {
    options,
    round,
    players: [0, 1].map(seat => ({ seat, name: names[seat] ?? `Oyuncu ${seat + 1}` })),
    board,
    turnStart: copyBoard(board),
    turn: white > black ? 0 : 1,
    turnNumber: 0,
    phase: 'playing',
    dice: [white, black],
    remaining: [white, black],
    steps: [],
    openingRoll: [white, black],
    lastTurn: null,
    result: null,
    rngState,
  };
}

export function isAction(raw: unknown): raw is TavlaAction {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const a = raw as Record<string, unknown>;
  if (a.type === 'undo' || a.type === 'commit') return true;
  if (a.type !== 'step') return false;
  const from = a.from;
  const fromOk = from === 'bar' || (typeof from === 'number' && Number.isInteger(from) && from >= 1 && from <= 24);
  const die = a.die;
  return fromOk && typeof die === 'number' && Number.isInteger(die) && die >= 1 && die <= 6;
}

/** Turn context for the side to move: its position, the dice left and the most dice it can still play. */
export interface TurnCtx {
  seat: number;
  pos: Pos;
  rem: number[];
  /** Most dice still playable (0 = the turn is complete, or a pass). */
  left: number;
  /** Larger-die rule in force for the next step (no step yet, two different dice, only one playable): that die. */
  bigOnly: number | null;
}

export function turnCtx(s: TavlaState): TurnCtx {
  const seat = s.turn;
  const pos = toPos(s.board, seat);
  const rem = s.remaining.slice();
  const left = maxPlayable(pos, rem);
  let bigOnly: number | null = null;
  if (left === 1 && rem.length === 2 && rem[0] !== rem[1]) {
    const hi = Math.max(rem[0], rem[1]);
    for (let r = 25; r >= 1; r--) {
      if (canMove(pos, r, hi)) {
        bigOnly = hi;
        break;
      }
    }
  }
  return { seat, pos, rem, left, bigOnly };
}

export type StepCheck = { error: string } | { pos: Pos; hit: boolean; rest: number[] };

/**
 * Why a step from relative point r by d is illegal right now, or the resulting position.
 * Checks the single move, then that the turn can still use the most dice possible (and the larger-die rule).
 */
export function checkStep(c: TurnCtx, r: number, d: number): StepCheck {
  const p = c.pos;
  if (!c.rem.includes(d)) return { error: 'Bu zar oynanamaz' };
  if (p[r] <= 0) return { error: r === 25 ? 'Kırık pulunuz yok' : 'Orada pulunuz yok' };
  if (p[25] > 0 && r !== 25) return { error: 'Önce kırık pulunuzu oyuna sokmalısınız' };
  const t = r - d;
  if (t >= 1 && p[OP + 25 - t] >= 2) return { error: 'Rakip kapısına basılamaz' };
  if (t <= 0 && !allHome(p)) return { error: 'Bütün pullar evde değilken pul toplanamaz' };
  if (t < 0 && !canMove(p, r, d)) return { error: 'Geride pul varken bu zarla buradan toplanamaz' };
  if (c.bigOnly !== null && d !== c.bigOnly) return { error: 'Büyük zarı oynamalısınız' };
  const n = p.slice();
  const hit = doMove(n, r, d);
  const rest = removeDie(c.rem, d);
  if (1 + maxPlayable(n, rest) !== c.left) return { error: 'Bu hamleyle zarların hepsi oynanamıyor; başka bir hamle seçin' };
  return { pos: n, hit, rest };
}

const fail = (error: string): ApplyResult<TavlaState> => ({ ok: false, error });

function gameResult(board: Board, winner: number, opts: TavlaOptions): TavlaResult {
  const loser = 1 - winner;
  if (board.off[loser] > 0) return { winner, kind: 'tek', points: 1 };
  let inHome = board.bar[loser] > 0;
  for (let a = 1; a <= 24 && !inHome; a++) {
    const v = board.points[a];
    const winnersHome = winner === 0 ? a <= 6 : a >= 19;
    if (winnersHome && (loser === 0 ? v > 0 : v < 0)) inHome = true;
  }
  return inHome ? { winner, kind: 'koncina', points: opts.koncinaPoints } : { winner, kind: 'mars', points: 2 };
}

/** Records the finished turn; either ends the game or passes the turn and rolls the next player's dice. */
function endTurn(s: TavlaState, board: Board, steps: Step[]): TavlaState {
  const seat = s.turn;
  const lastTurn = { turnNumber: s.turnNumber, seat, dice: [s.dice[0], s.dice[1]] as [number, number], steps: steps.map(st => ({ ...st })) };
  if (board.off[seat] === CHECKERS) {
    return {
      ...s,
      board,
      turnStart: copyBoard(s.turnStart),
      steps,
      remaining: [],
      turnNumber: s.turnNumber + 1,
      phase: 'finished',
      lastTurn,
      result: gameResult(board, seat, s.options),
    };
  }
  const [dice, rngState] = rollPair(s.rngState);
  return {
    ...s,
    board,
    turnStart: copyBoard(board),
    turn: 1 - seat,
    turnNumber: s.turnNumber + 1,
    dice,
    remaining: diceToPlay(dice),
    steps: [],
    lastTurn,
    rngState,
  };
}

function replay(start: Board, seat: number, steps: readonly Step[]): Board {
  const p = toPos(start, seat);
  for (const st of steps) doMove(p, st.from === 'bar' ? 25 : relOf(seat, st.from), st.die);
  return fromPos(p, seat);
}

function applyInner(s: TavlaState, seat: number, action: TavlaAction): ApplyResult<TavlaState> {
  if (!isAction(action)) return fail('Geçersiz hamle');
  if (s.phase !== 'playing') return fail('Oyun bitti');
  if (seat !== s.turn) return fail('Sıra sizde değil');

  if (action.type === 'undo') {
    if (s.steps.length === 0) return fail('Geri alınacak hamle yok');
    const steps = s.steps.slice(0, -1).map(st => ({ ...st }));
    let remaining = diceToPlay(s.dice);
    for (const st of steps) remaining = removeDie(remaining, st.die);
    return { ok: true, state: { ...s, board: replay(s.turnStart, seat, steps), turnStart: copyBoard(s.turnStart), steps, remaining } };
  }

  const c = turnCtx(s);
  if (action.type === 'commit') {
    if (c.left > 0) return fail(s.steps.length === 0 ? 'Oynanabilir hamleniz var' : 'Hamleniz tamamlanmadı');
    return { ok: true, state: endTurn(s, copyBoard(s.board), s.steps.map(st => ({ ...st }))) };
  }

  const r = action.from === 'bar' ? 25 : relOf(seat, action.from);
  const checked = checkStep(c, r, action.die);
  if ('error' in checked) return fail(checked.error);
  const board = fromPos(checked.pos, seat);
  const step: Step = { from: action.from as From, to: absTo(seat, r - action.die), die: action.die, hit: checked.hit };
  const steps = [...s.steps.map(st => ({ ...st })), step];
  // Bearing off the last checker wins at once; no die is left to play after that.
  if (board.off[seat] === CHECKERS) return { ok: true, state: endTurn(s, board, steps) };
  return { ok: true, state: { ...s, board, turnStart: copyBoard(s.turnStart), steps, remaining: checked.rest } };
}

/** Never throws, never mutates `s`. */
export function apply(s: TavlaState, seat: number, action: TavlaAction): ApplyResult<TavlaState> {
  try {
    return applyInner(s, seat, action);
  } catch {
    return fail('Geçersiz hamle');
  }
}
