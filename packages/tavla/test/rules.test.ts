import { describe, expect, it } from 'vitest';
import { tavlaDef } from '../src';
import type { TavlaAction, TavlaState } from '../src/types';
import { board, position } from './helpers';

const step = (from: number | 'bar', die: number): TavlaAction => ({ type: 'step', from, die });
const commit: TavlaAction = { type: 'commit' };
const undo: TavlaAction = { type: 'undo' };

/** Applies actions for the side to move; fails the test on the first rejection. */
function play(s: TavlaState, ...actions: TavlaAction[]): TavlaState {
  for (const a of actions) {
    const r = tavlaDef.apply(s, s.turn, a);
    if (!r.ok) throw new Error(`${JSON.stringify(a)}: ${r.error}`);
    s = r.state;
  }
  return s;
}
const err = (s: TavlaState, a: TavlaAction, seat = s.turn) => {
  const r = tavlaDef.apply(s, seat, a);
  return r.ok ? null : r.error;
};
const view = (s: TavlaState) => tavlaDef.viewFor(s, s.turn);

describe('hitting and blocked points', () => {
  it('T04: cannot land on an opponent point (2+ checkers)', () => {
    const s = position(board({ w: { 24: 2, 6: 13 }, b: { 20: 2, 1: 13 } }), 0, [4, 1]);
    expect(err(s, step(24, 4))).toBe('Rakip kapısına basılamaz');
  });

  it('T05: landing on a lone opponent checker hits it', () => {
    const s = play(position(board({ w: { 24: 2, 6: 13 }, b: { 20: 1, 1: 14 } }), 0, [4, 1]), step(24, 4));
    expect(s.board.bar[1]).toBe(1);
    expect(s.board.points[20]).toBe(1);
    expect(s.steps[0]).toEqual({ from: 24, to: 20, die: 4, hit: true });
  });

  it('T06: with a checker on the bar no other checker may move', () => {
    const s = position(board({ w: { 13: 5, 6: 9 }, barW: 1, b: { 1: 15 } }), 0, [3, 5]);
    expect(err(s, step(13, 3))).toBe('Önce kırık pulunuzu oyuna sokmalısınız');
    expect(view(s).moves.every(m => m.from === 'bar')).toBe(true);
  });

  it('T07: closed home board: no entry, the turn is a pass', () => {
    const s = position(board({ w: { 6: 14 }, barW: 1, b: { 19: 2, 20: 2, 21: 2, 22: 2, 23: 2, 24: 2, 12: 3 } }), 0, [3, 5]);
    const v = view(s);
    expect(v.moves).toEqual([]);
    expect(v.mustPass).toBe(true);
    expect(v.canCommit).toBe(true);
    expect(err(s, step('bar', 3))).toBe('Rakip kapısına basılamaz');
    const after = play(s, commit);
    expect(after.turn).toBe(1);
    expect(after.lastTurn).toEqual({ turnNumber: 10, seat: 0, dice: [3, 5], steps: [] });
  });

  it('T08: two on the bar, only one can enter; the other die is lost', () => {
    const s = position(board({ w: { 6: 13 }, barW: 2, b: { 20: 2, 1: 13 } }), 0, [2, 5]);
    expect(err(s, step('bar', 5))).toBe('Rakip kapısına basılamaz');
    const a = play(s, step('bar', 2));
    expect(a.board.points[23]).toBe(1);
    expect(a.board.bar[0]).toBe(1);
    expect(err(a, step(23, 5))).toBe('Önce kırık pulunuzu oyuna sokmalısınız');
    expect(view(a).canCommit).toBe(true);
    expect(play(a, commit).turn).toBe(1);
  });

  it('black enters on the die number and moves upwards', () => {
    const s = position(board({ b: { 12: 14 }, barB: 1, w: { 3: 2, 6: 13 } }), 1, [3, 4]);
    expect(err(s, step('bar', 3))).toBe('Rakip kapısına basılamaz');
    const a = play(s, step('bar', 4), step(12, 3));
    expect(a.board.points[4]).toBe(-1);
    expect(a.board.points[15]).toBe(-1);
  });
});

describe('using the dice', () => {
  // A: 9, B: 5. 9/7 leaves no 3 (7/4 and 5/2 blocked), 9/6 + 5/3 plays both dice.
  const t09 = () => position(board({ w: { 9: 1, 5: 1, 1: 13 }, b: { 4: 2, 2: 2, 24: 11 } }), 0, [2, 3]);

  it('T09: a step that makes the other die unplayable is rejected when both dice can be played', () => {
    const s = t09();
    expect(err(s, step(9, 2))).toBe('Bu hamleyle zarların hepsi oynanamıyor; başka bir hamle seçin');
    expect(view(s).moves.some(m => m.from === 9 && m.to === 7)).toBe(false);
    const done = play(s, step(9, 3), step(5, 2));
    expect(view(done).canCommit).toBe(true);
    expect(play(t09(), step(5, 2), step(9, 3)).board).toEqual(done.board);
  });

  it('either order is fine when both orders play both dice', () => {
    const s = position(board({ w: { 24: 2, 13: 5, 8: 3, 6: 5 }, b: { 1: 2, 12: 5, 17: 3, 19: 5 } }), 0, [5, 2]);
    const a = play(s, step(13, 5), step(13, 2));
    const b = play(s, step(13, 2), step(13, 5));
    expect(a.board).toEqual(b.board);
    expect(err(play(s, step(13, 5)), commit)).toBe('Hamleniz tamamlanmadı');
  });

  // 13/11 then 11/6 blocked; 13/8 then 8/6 blocked: only one die can be played.
  const t10 = (extra: Record<number, number> = {}) => position(board({ w: { 13: 1, 1: 14 }, b: { 6: 2, ...extra, 24: 13 - Object.values(extra).reduce((a, n) => a + n, 0) } }), 0, [2, 5]);

  it('T10: only one die playable and both are: the larger die is forced', () => {
    const s = t10();
    expect(err(s, step(13, 2))).toBe('Büyük zarı oynamalısınız');
    const a = play(s, step(13, 5));
    expect(a.board.points[8]).toBe(1);
    expect(view(a).canCommit).toBe(true);
    expect(view(s).moves).toEqual([{ from: 13, to: 8, dice: [5] }]);
  });

  it('T10 reverse: only the smaller die can be played, so it is played', () => {
    const s = t10({ 8: 2 });
    expect(err(s, step(13, 5))).toBe('Rakip kapısına basılamaz');
    const a = play(s, step(13, 2));
    expect(view(a).canCommit).toBe(true);
  });

  it('T11: doubles give four moves', () => {
    const s = position(board({ w: { 24: 2, 13: 5, 8: 3, 6: 5 }, b: { 1: 2, 12: 5, 17: 3, 19: 5 } }), 0, [4, 4]);
    expect(s.remaining).toEqual([4, 4, 4, 4]);
    const three = play(s, step(24, 4), step(24, 4), step(13, 4));
    expect(err(three, commit)).toBe('Hamleniz tamamlanmadı');
    const four = play(three, step(13, 4));
    expect(four.remaining).toEqual([]);
    expect(play(four, commit).lastTurn?.steps).toHaveLength(4);
  });

  it('T12: doubles cannot jump over a blocked intermediate point', () => {
    const s = position(board({ w: { 24: 1, 1: 14 }, b: { 20: 2, 12: 13 } }), 0, [4, 4]);
    expect(err(s, step(24, 4))).toBe('Rakip kapısına basılamaz');
    expect(view(s).mustPass).toBe(true);
    // 20 open but 16 blocked: one step only, and no 24 -> 16 move is offered.
    const t = position(board({ w: { 24: 1, 1: 14 }, b: { 16: 2, 12: 13 } }), 0, [4, 4]);
    expect(view(t).moves).toEqual([{ from: 24, to: 20, dice: [4] }]);
    expect(play(t, step(24, 4), commit).turn).toBe(1);
  });
});

describe('bearing off', () => {
  it('T13: no bearing off while a checker is outside home', () => {
    const s = position(board({ w: { 7: 1, 6: 4, 5: 10 }, b: { 24: 15 } }), 0, [6, 1]);
    expect(err(s, step(6, 6))).toBe('Bütün pullar evde değilken pul toplanamaz');
  });

  it('T14: a larger die cannot bear off a lower checker while a higher one remains', () => {
    const s = position(board({ w: { 6: 1, 3: 2 }, b: { 24: 15 } }), 0, [4, 2]);
    expect(err(s, step(3, 4))).toBe('Geride pul varken bu zarla buradan toplanamaz');
    const a = play(s, step(6, 4));
    expect(a.board.points[2]).toBe(1);
  });

  it('T15: with nothing higher, a larger die bears off from the highest point', () => {
    const s = position(board({ w: { 4: 1, 3: 1, 2: 1 }, b: { 24: 15 } }), 0, [6, 5]);
    const a = play(s, step(4, 6), step(3, 5));
    expect(a.board.off[0]).toBe(14);
    expect(view(a).canCommit).toBe(true);
  });

  it('T16: a checker on the bar stops bearing off until it is home again', () => {
    const s = position(board({ w: { 3: 1, 2: 1, 1: 2 }, barW: 1, offW: 10, b: { 12: 15 } }), 0, [6, 1]);
    expect(err(s, step(1, 1))).toBe('Önce kırık pulunuzu oyuna sokmalısınız');
    const a = play(s, step('bar', 6));
    expect(a.board.points[19]).toBe(1);
    expect(err(a, step(1, 1))).toBe('Bütün pullar evde değilken pul toplanamaz');
    expect(play(a, step(19, 1)).board.points[18]).toBe(1);
  });

  it('a white blot hit while bearing off: white must enter before bearing off again', () => {
    const s = position(board({ w: { 2: 1, 3: 2, 4: 2 }, offW: 10, b: { 1: 1, 24: 14 } }), 1, [1, 6]);
    const a = play(s, step(1, 1), step(2, 6), commit);
    expect(a.board.bar[0]).toBe(1);
    expect(a.turn).toBe(0);
    const v = view(a);
    expect(v.moves.every(m => m.from === 'bar')).toBe(true);
    expect(err(a, step(3, a.remaining[0]))).toBe('Önce kırık pulunuzu oyuna sokmalısınız');
  });

  it('bearing off the last checker wins at once, even with a die left', () => {
    const s = position(board({ w: { 3: 1 }, b: { 24: 15 } }), 0, [2, 5]);
    const a = play(s, step(3, 5));
    expect(a.phase).toBe('finished');
    expect(tavlaDef.turn(a)).toBeNull();
    expect(a.lastTurn).toEqual({ turnNumber: 10, seat: 0, dice: [2, 5], steps: [{ from: 3, to: 'off', die: 5, hit: false }] });
    expect(err(a, commit)).toBe('Oyun bitti');
  });
});

describe('game end and scoring', () => {
  const finish = (b: ReturnType<typeof board>, opts = {}) => play(position(b, 0, [3, 2], opts), step(1, 3));

  it('T17: opponent bore off at least one: tek, 1 point', () => {
    const s = finish(board({ w: { 1: 1 }, b: { 24: 14 } }));
    expect(s.result).toEqual({ winner: 0, kind: 'tek', points: 1 });
    expect(tavlaDef.roundOver(s)).toBe(true);
    expect(tavlaDef.scoreRound(s)).toEqual([1, 0]);
  });

  it('T18: opponent bore off none and is out of the winner home: mars, 2 points', () => {
    const s = finish(board({ w: { 1: 1 }, b: { 24: 5, 18: 5, 7: 5 } }));
    expect(s.result).toEqual({ winner: 0, kind: 'mars', points: 2 });
    expect(tavlaDef.scoreRound(s)).toEqual([2, 0]);
  });

  it('T19: none off and a checker in the winner home or on the bar: konçina (3, or 2 by option)', () => {
    expect(tavlaDef.scoreRound(finish(board({ w: { 1: 1 }, b: { 24: 14, 5: 1 } })))).toEqual([3, 0]);
    const bar = finish(board({ w: { 1: 1 }, b: { 24: 14 }, barB: 1 }));
    expect(bar.result).toEqual({ winner: 0, kind: 'koncina', points: 3 });
    const two = finish(board({ w: { 1: 1 }, b: { 24: 14, 5: 1 } }), { koncinaPoints: 2 });
    expect(two.result).toEqual({ winner: 0, kind: 'koncina', points: 2 });
    expect(tavlaDef.scoreRound(two)).toEqual([2, 0]);
  });

  it('black wins: scores [0, p], konçina when white is still in black home', () => {
    const s = play(position(board({ b: { 24: 1 }, w: { 20: 1, 6: 14 } }), 1, [1, 2]), step(24, 1));
    expect(s.result).toEqual({ winner: 1, kind: 'koncina', points: 3 });
    expect(tavlaDef.scoreRound(s)).toEqual([0, 3]);
    expect(tavlaDef.scoreRound(position(board({ b: { 24: 1 }, w: { 6: 15 } }), 1, [1, 2]))).toEqual([0, 0]);
  });

  it('matchOver at the target score', () => {
    const opts = tavlaDef.normalizeOptions({ targetScore: 3 });
    expect(tavlaDef.matchOver([2, 2], 4, opts)).toBe(false);
    expect(tavlaDef.matchOver([1, 3], 4, opts)).toBe(true);
  });
});

describe('undo, turn order, input checks', () => {
  const opening = () => position(board({ w: { 24: 2, 13: 5, 8: 3, 6: 5 }, b: { 1: 2, 12: 5, 17: 3, 19: 5 } }), 0, [3, 5]);

  it('T25: undo restores the board and lets the other die go first', () => {
    const s = opening();
    const a = play(s, step(8, 3));
    const back = play(a, undo);
    expect(back.board).toEqual(s.turnStart);
    expect(back.remaining).toEqual([3, 5]);
    expect(back.steps).toEqual([]);
    const c = play(back, step(13, 5), step(8, 3), undo, undo);
    expect(c.board).toEqual(s.board);
    expect(err(c, undo)).toBe('Geri alınacak hamle yok');
  });

  it('undo after a hit puts the hit checker back', () => {
    const s = position(board({ w: { 24: 2, 6: 13 }, b: { 20: 1, 1: 14 } }), 0, [4, 1]);
    expect(play(s, step(24, 4), undo).board).toEqual(s.board);
  });

  it('commit passes the turn and rolls the next dice; wrong seat and bad actions are rejected', () => {
    const s = opening();
    expect(err(s, step(13, 5), 1)).toBe('Sıra sizde değil');
    expect(err(s, step(13, 4))).toBe('Bu zar oynanamaz');
    expect(err(s, step(10, 5))).toBe('Orada pulunuz yok');
    expect(err(s, step('bar', 5))).toBe('Kırık pulunuz yok');
    expect(err(s, commit)).toBe('Oynanabilir hamleniz var');
    expect(err(s, { type: 'step', from: 0, die: 3 } as unknown as TavlaAction)).toBe('Geçersiz hamle');
    const a = play(s, step(13, 5), step(8, 3), commit);
    expect(a.turn).toBe(1);
    expect(a.turnNumber).toBe(11);
    expect(a.steps).toEqual([]);
    expect(a.turnStart).toEqual(a.board);
    expect(a.remaining).toEqual(a.dice[0] === a.dice[1] ? [a.dice[0], a.dice[0], a.dice[0], a.dice[0]] : a.dice);
    expect(a.rngState).not.toBe(s.rngState);
    expect(a.lastTurn?.steps.map(x => x.from)).toEqual([13, 8]);
  });

  it('apply never mutates its input and never throws on junk', () => {
    const s = opening();
    const snap = JSON.stringify(s);
    play(s, step(13, 5), step(8, 3), commit);
    tavlaDef.apply(s, 0, step(9, 9));
    for (const junk of [null, 1, 'x', [], {}, { type: 'step' }, { type: 'step', from: 'bar', die: 7 }, { type: 'step', from: 2.5, die: 1 }]) {
      expect(tavlaDef.isAction(junk)).toBe(false);
      expect(tavlaDef.apply(s, 0, junk as TavlaAction).ok).toBe(false);
    }
    expect(tavlaDef.apply(null as unknown as TavlaState, 0, commit).ok).toBe(false);
    expect(JSON.stringify(s)).toBe(snap);
  });
});
