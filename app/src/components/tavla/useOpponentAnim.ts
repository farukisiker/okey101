import { useEffect, useRef, useState } from 'react';
import type { Board, TavlaView } from '@kahve/tavla';
import { boardBefore, countAt, landChecker, liftChecker } from './boardMath';
import type { FlyingSpec } from './Board';
import { type Loc, type TavlaGeom, slotCenter } from './tavlaGeometry';
import { checkerFeedback } from './sfx';

export const STEP_MS = 250;
const GAP_MS = 70;

export interface OpponentAnim {
  /** Board to draw while the opponent's turn is replayed; null: draw the view's own board. */
  board: Board | null;
  flying: FlyingSpec | null;
}

const NONE: OpponentAnim = { board: null, flying: null };

/** Where the next checker of `seat` goes on a point/bar/off, or where the top one of a stack sits. */
function slotIndexFor(board: Board, seat: number, loc: Loc, landing: boolean, hit: boolean): number {
  if (loc.k === 'point') {
    const own = countAt(board, seat, loc.n);
    return landing ? (hit ? 0 : own) : Math.max(0, own - 1);
  }
  if (loc.k === 'bar') return landing ? board.bar[loc.seat] : Math.max(0, board.bar[loc.seat] - 1);
  return board.off[loc.seat];
}

/**
 * When `view.lastTurn` changes and it was the other player's turn, replays its steps one by one
 * (~250 ms each): the checker lifts off its stack, slides to its place, a hit checker goes to the bar.
 * Nothing plays on mount, for the viewer's own turns, or when the board already moved on (own steps showing).
 */
export function useOpponentAnim(view: TavlaView, geom: TavlaGeom, viewer: number, mySeat: number): OpponentAnim {
  const key = view.lastTurn ? `${view.round}:${view.lastTurn.turnNumber}` : null;
  const seen = useRef(key);
  const [anim, setAnim] = useState<OpponentAnim>(NONE);
  const geomRef = useRef(geom);
  geomRef.current = geom;

  useEffect(() => {
    if (key === seen.current) return;
    seen.current = key;
    const turn = view.lastTurn;
    if (!turn || turn.steps.length === 0) return;
    if (mySeat >= 0 && turn.seat === mySeat) return;
    if (view.steps.length > 0) return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let board = boardBefore(view.board, turn);
    let i = 0;
    const after = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

    const run = () => {
      if (cancelled) return;
      if (i >= turn.steps.length) {
        setAnim(NONE);
        return;
      }
      const step = turn.steps[i];
      const g = geomRef.current;
      const fromLoc: Loc = step.from === 'bar' ? { k: 'bar', seat: turn.seat } : { k: 'point', n: step.from };
      const toLoc: Loc = step.to === 'off' ? { k: 'off', seat: turn.seat } : { k: 'point', n: step.to };
      const from = slotCenter(g, viewer, fromLoc, slotIndexFor(board, turn.seat, fromLoc, false, false));
      const to = slotCenter(g, viewer, toLoc, slotIndexFor(board, turn.seat, toLoc, true, step.hit));
      const lifted = liftChecker(board, turn.seat, step.from);
      setAnim({ board: lifted, flying: { key: `${key}:${i}`, seat: turn.seat, from, to, ms: STEP_MS } });
      after(STEP_MS, () => {
        board = landChecker(lifted, turn.seat, step.to, step.hit);
        checkerFeedback(step.hit);
        i++;
        setAnim({ board, flying: null });
        after(GAP_MS, run);
      });
    };
    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      setAnim(NONE);
    };
    // Starts once per finished opponent turn; the view fields it reads belong to `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return anim;
}

