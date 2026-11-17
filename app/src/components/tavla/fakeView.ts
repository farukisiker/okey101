// C2: fake TavlaView builders for the preview screen and tests. This is NOT the rules engine: simpleMoves is a small
// stand-in (no "must use both dice" rule) that offers the same CheckerMove shape the real view will.
import type { Board, CheckerMove, From, Step, TavlaAction, TavlaOptions, TavlaView, To, TurnRecord } from '@kahve/tavla';
import { applyStep, copyBoard, countAt, pipCount, stepDestination, unapplyStep, wouldHit } from './boardMath';

export const FAKE_OPTIONS: TavlaOptions = { variant: 'klasik', targetScore: 5, koncinaPoints: 3 };

export function emptyBoard(): Board {
  return { points: new Array(25).fill(0), bar: [0, 0], off: [0, 0] };
}

/** Builds a board from `white` / `black` maps of point -> count. */
export function makeBoard(white: Record<number, number>, black: Record<number, number>, bar: [number, number] = [0, 0], off: [number, number] = [0, 0]): Board {
  const b = emptyBoard();
  for (const [p, n] of Object.entries(white)) b.points[Number(p)] = n;
  for (const [p, n] of Object.entries(black)) b.points[Number(p)] = -n;
  b.bar = [...bar];
  b.off = [...off];
  return b;
}

export const openingBoard = (): Board => makeBoard({ 24: 2, 13: 5, 8: 3, 6: 5 }, { 1: 2, 12: 5, 17: 3, 19: 5 });

const allHome = (board: Board, seat: number): boolean => {
  if (board.bar[seat] > 0) return false;
  for (let p = 1; p <= 24; p++) {
    if (countAt(board, seat, p) > 0 && (seat === 0 ? p > 6 : p < 19)) return false;
  }
  return true;
};

/** Legal single steps for one die from every checker (enter from the bar first, bear off when all are home). */
function singleSteps(board: Board, seat: number, die: number): { from: From; to: To }[] {
  const out: { from: From; to: To }[] = [];
  const open = (to: number) => countAt(board, 1 - seat, to) < 2;
  if (board.bar[seat] > 0) {
    const to = stepDestination('bar', die, seat);
    return open(to) ? [{ from: 'bar', to }] : [];
  }
  const home = allHome(board, seat);
  for (let p = 1; p <= 24; p++) {
    if (countAt(board, seat, p) === 0) continue;
    const to = stepDestination(p, die, seat);
    if (to >= 1 && to <= 24) {
      if (open(to)) out.push({ from: p, to });
    } else if (home) {
      const exact = seat === 0 ? to === 0 : to === 25;
      let behind = false;
      for (let q = 1; q <= 24; q++) {
        if (countAt(board, seat, q) > 0 && (seat === 0 ? q > p : q < p)) behind = true;
      }
      if (exact || !behind) out.push({ from: p, to: 'off' });
    }
  }
  return out;
}

/** The moves a view offers: every legal next step, then longer routes of one checker (2..4 dice). */
export function simpleMoves(board: Board, seat: number, remaining: number[]): CheckerMove[] {
  const out: CheckerMove[] = [];
  const seen = new Set<string>();
  const add = (from: From, to: To, dice: number[]) => {
    const k = `${from}>${to}:${dice.join(',')}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ from, to, dice });
    }
  };
  const walk = (b: Board, rem: number[], origin: From, at: From, dice: number[]) => {
    for (const die of new Set(rem)) {
      for (const s of singleSteps(b, seat, die)) {
        if (s.from !== at) continue;
        const nextDice = [...dice, die];
        add(origin, s.to, nextDice);
        if (s.to !== 'off') {
          const nb = applyStep(b, seat, { from: s.from, to: s.to, die, hit: wouldHit(b, seat, s.to) });
          const nr = [...rem];
          nr.splice(nr.indexOf(die), 1);
          walk(nb, nr, origin, s.to, nextDice);
        }
      }
    }
  };
  const froms = new Set<From>();
  for (const die of new Set(remaining)) for (const s of singleSteps(board, seat, die)) froms.add(s.from);
  for (const f of froms) walk(board, remaining, f, f, []);
  // Singles first (the engine lists every legal next step before the multi-die moves).
  return out.sort((a, b) => a.dice.length - b.dice.length);
}

export interface FakeSpec {
  seat: number;
  board: Board;
  turn: number | null;
  turnNumber: number;
  dice: [number, number];
  remaining?: number[];
  steps?: Step[];
  lastTurn?: TurnRecord | null;
  result?: TavlaView['result'];
  round?: number;
  openingRoll?: [number, number];
}

const names = ['Ayşe', 'Mehmet'];
const rollRemaining = (dice: [number, number]): number[] => (dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : [dice[0], dice[1]]);

/** A TavlaView from a few fields; moves are only filled on the viewer's own turn. */
export function buildView(s: FakeSpec): TavlaView {
  const remaining = s.remaining ?? rollRemaining(s.dice);
  const steps = s.steps ?? [];
  const finished = s.result != null;
  const mine = !finished && s.turn === s.seat && s.seat >= 0;
  const moves = mine ? simpleMoves(s.board, s.seat, remaining) : [];
  return {
    options: FAKE_OPTIONS,
    round: s.round ?? 1,
    seat: s.seat,
    players: [0, 1].map((seat) => ({ seat, name: names[seat], pips: pipCount(s.board, seat) })),
    board: s.board,
    turn: finished ? null : s.turn,
    turnNumber: s.turnNumber,
    phase: finished ? 'finished' : 'playing',
    dice: s.dice,
    remaining,
    steps,
    openingRoll: s.openingRoll ?? s.dice,
    moves,
    canCommit: mine && steps.length > 0 && (remaining.length === 0 || moves.length === 0),
    mustPass: mine && moves.length === 0 && steps.length === 0,
    canUndo: mine && steps.length > 0,
    lastTurn: s.lastTurn ?? null,
    result: s.result ?? null,
    clock: null,
  };
}

/** Opening position. Seat 0 viewer: white starts with 5-3. Seat 1 viewer: black starts with 3-5 (black's die is larger). */
export function fakeOpening(seat = 0): TavlaView {
  const dice: [number, number] = seat === 0 ? [5, 3] : [3, 5];
  return buildView({ seat, board: openingBoard(), turn: seat, turnNumber: 0, dice, openingRoll: dice });
}

/** Mid-game: a black checker on the bar (just hit), a stack of 6 on point 13, several blots, white to play 4-3. */
export function fakeMidGame(seat = 0): TavlaView {
  const board = makeBoard({ 20: 1, 13: 6, 11: 1, 8: 2, 6: 4, 4: 1 }, { 12: 3, 17: 3, 19: 4, 21: 2, 22: 1, 2: 1 }, [0, 1]);
  return buildView({ seat, board, turn: 0, turnNumber: 12, dice: [4, 3] });
}

/** My checker on the bar; 6-2: only the 2 enters (point 23). */
export function fakeOnBar(): TavlaView {
  const board = makeBoard({ 13: 5, 8: 3, 6: 5, 4: 1 }, { 19: 4, 20: 3, 22: 2, 17: 3, 12: 3 }, [1, 0]);
  return buildView({ seat: 0, board, turn: 0, turnNumber: 20, dice: [6, 2] });
}

/** My checker on the bar and both entry points blocked: the Pas button. */
export function fakeMustPass(): TavlaView {
  const board = makeBoard({ 13: 5, 8: 3, 6: 5, 4: 1 }, { 19: 4, 20: 3, 22: 2, 17: 3, 12: 3 }, [1, 0]);
  return buildView({ seat: 0, board, turn: 0, turnNumber: 22, dice: [3, 5] });
}

/** Bear-off: all of mine home, 3 already off; 6-4 (and a double variant via `dice`). */
export function fakeBearOff(dice: [number, number] = [6, 4]): TavlaView {
  const board = makeBoard({ 6: 3, 5: 3, 4: 3, 3: 2, 2: 1 }, { 12: 5, 17: 4, 19: 3, 21: 3 }, [0, 0], [3, 2]);
  return buildView({ seat: 0, board, turn: 0, turnNumber: 40, dice });
}

/** Doubles: 3-3 on the opening board, four moves left. */
export function fakeDouble(): TavlaView {
  return buildView({ seat: 0, board: openingBoard(), turn: 0, turnNumber: 2, dice: [3, 3] });
}

/** Game over: white won a mars (2 points). */
export function fakeFinished(): TavlaView {
  const board = makeBoard({}, { 12: 5, 17: 4, 19: 3, 21: 3 }, [0, 0], [15, 0]);
  return buildView({ seat: 0, board, turn: 0, turnNumber: 61, dice: [4, 2], result: { winner: 0, kind: 'mars', points: 2 } });
}

/** Applies a viewer action to a fake view (the preview's stand-in for the engine). `commit` is handled by fakeCommit. */
export function fakeReduce(view: TavlaView, action: TavlaAction): TavlaView {
  const spec: FakeSpec = { ...view, openingRoll: view.openingRoll };
  if (action.type === 'step') {
    const m = view.moves.find((x) => x.from === action.from && x.dice[0] === action.die);
    if (!m) return view;
    const to: To = m.dice.length === 1 ? m.to : (stepDestination(action.from, action.die, view.seat) as To);
    const step: Step = { from: action.from, to, die: action.die, hit: wouldHit(view.board, view.seat, to) };
    const remaining = [...view.remaining];
    remaining.splice(remaining.indexOf(action.die), 1);
    return buildView({ ...spec, board: applyStep(view.board, view.seat, step), remaining, steps: [...view.steps, step] });
  }
  if (action.type === 'undo') {
    const last = view.steps[view.steps.length - 1];
    if (!last) return view;
    return buildView({ ...spec, board: unapplyStep(view.board, view.seat, last), remaining: [...view.remaining, last.die], steps: view.steps.slice(0, -1) });
  }
  return fakeCommit(view);
}

const roll = (): [number, number] => [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];

/** The viewer ends the turn: the opponent is to move (no moves offered), with a fresh roll. */
export function fakeCommit(view: TavlaView): TavlaView {
  const record: TurnRecord = { turnNumber: view.turnNumber, seat: view.seat, dice: view.dice, steps: view.steps };
  return buildView({ seat: view.seat, board: view.board, turn: 1 - view.seat, turnNumber: view.turnNumber + 1, dice: roll(), lastTurn: record });
}

/** The opponent plays a greedy turn (first offered move until the dice run out) and hands the turn back with `lastTurn`. */
export function fakeOpponentPlay(view: TavlaView): TavlaView {
  const opp = 1 - view.seat;
  let board = copyBoard(view.board);
  const remaining = [...view.remaining];
  const steps: Step[] = [];
  for (let guard = 0; guard < 4; guard++) {
    const moves = simpleMoves(board, opp, remaining).filter((m) => m.dice.length === 1);
    const m = moves[Math.floor(Math.random() * moves.length)];
    if (!m) break;
    const step: Step = { from: m.from, to: m.to, die: m.dice[0], hit: wouldHit(board, opp, m.to) };
    board = applyStep(board, opp, step);
    remaining.splice(remaining.indexOf(step.die), 1);
    steps.push(step);
  }
  const record: TurnRecord = { turnNumber: view.turnNumber, seat: opp, dice: view.dice, steps };
  return buildView({ seat: view.seat, board, turn: view.seat, turnNumber: view.turnNumber + 1, dice: roll(), lastTurn: record });
}

