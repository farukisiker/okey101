import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Action, type GameMode, type GameState, type RoomInfo, pickBotNames } from '@okey/shared';
import { nextTurnClock, type TurnClock } from '@kahve/core';
import { okey101Def, okeyDuzDef } from '@kahve/catalog';
import type { Session } from './useOkey';
import { t } from '../i18n';

const BOT_DELAY_MS = 1300;
const ME = 0;

type Result = { ok: true } | { ok: false; error: string };

/** The okey game definition for a legacy mode (same adapter the server's Room runs). */
const defOf = (mode: GameMode) => (mode === 'duz' ? okeyDuzDef : okey101Def);

/**
 * Offline game against three bots, run on the device through the same GameDefinition,
 * rules, bot and turn clock the server uses. No network needed.
 */
export function useLocalGame() {
  const [name, setName] = useState<string | null>(null);
  const [mode, setMode] = useState<GameMode>('101');
  const [names, setNames] = useState<string[]>([]);
  const [game, setGame] = useState<GameState | null>(null);
  const [round, setRound] = useState(0);
  const [totals, setTotals] = useState([0, 0, 0, 0]);
  const gameRef = useRef<GameState | null>(null);
  /** The player's turn clock (bots move on their own short delay). */
  const [clock, setClock] = useState<TurnClock | null>(null);
  const clockRef = useRef<TurnClock | null>(null);
  const defRef = useRef(okey101Def);
  const tick = useCallback((g: GameState, action: Action | null) => {
    const def = defRef.current;
    clockRef.current = nextTurnClock(
      action ? clockRef.current : null,
      def.turn(g),
      action !== null && def.refillsClock(action),
      Date.now(),
      def.clock,
    );
    setClock(clockRef.current);
  }, []);

  const apply = useCallback((seat: number, action: Action): Result => {
    const g = gameRef.current;
    if (!g) return { ok: false, error: t('noGame') };
    const def = defRef.current;
    const res = def.apply(g, seat, action);
    if (!res.ok) return res;
    gameRef.current = res.state;
    tick(res.state, action);
    setGame(res.state);
    if (def.roundOver(res.state)) {
      const scores = def.scoreRound(res.state);
      setTotals((t) => t.map((v, i) => v + scores[i]));
    }
    return { ok: true };
  }, [tick]);

  const deal = useCallback((seatNames: string[], roundNo: number, gameMode: GameMode) => {
    const def = defOf(gameMode);
    defRef.current = def;
    const g = def.create(def.defaultOptions, seatNames, Math.random, roundNo);
    gameRef.current = g;
    tick(g, null);
    setGame(g);
    setRound(roundNo + 1);
  }, [tick]);

  // Out of time: draw from the deck, then throw a tile that is not part of a meld.
  // The draw leaves the clock run out, so the throw follows right after.
  useEffect(() => {
    if (!game || defRef.current.turn(game)?.seat !== ME || !clock) return;
    const timer = setTimeout(() => {
      const g = gameRef.current;
      if (!g || defRef.current.turn(g)?.seat !== ME) return;
      apply(ME, defRef.current.quickMove(g, ME));
    }, Math.max(0, clock.deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [game, clock, apply]);

  // Bots move one action at a time with a short delay so the player can follow.
  useEffect(() => {
    const turn = game ? defRef.current.turn(game) : null;
    if (!turn || turn.seat === ME) return;
    const timer = setTimeout(() => {
      const g = gameRef.current;
      const def = defRef.current;
      const seat = g ? def.turn(g)?.seat : undefined;
      if (!g || seat === undefined || seat === ME) return;
      if (!apply(seat, def.botMove(g, seat, 'medium', Math.random)).ok) {
        // Should not happen; fall back to the game's minimal legal move.
        apply(seat, def.quickMove(g, seat));
      }
    }, BOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [game, apply]);

  const view = useMemo(
    () => (game ? defRef.current.viewFor(game, ME, { clock, now: Date.now() }) : null),
    [game, clock],
  );

  const room = useMemo<RoomInfo | null>(
    () =>
      name === null
        ? null
        : {
            id: 'YEREL',
            mode,
            seats: names.map((n, seat) => ({
              seat,
              name: n,
              isBot: seat !== ME,
              connected: true,
            })),
            hostSeat: ME,
            started: true,
            round,
            totals,
          },
    [name, mode, names, round, totals],
  );

  const session = useMemo<Session | null>(
    () => (name === null ? null : { roomId: 'YEREL', seat: ME, name }),
    [name],
  );

  return {
    active: name !== null,
    session,
    room,
    view,
    begin: async (playerName: string, gameMode: GameMode = '101'): Promise<Result> => {
      const seatNames = [playerName, ...pickBotNames(3, [playerName])];
      setName(playerName);
      setMode(gameMode);
      setNames(seatNames);
      setTotals([0, 0, 0, 0]);
      deal(seatNames, 0, gameMode);
      return { ok: true };
    },
    act: async (action: Action): Promise<Result> => apply(ME, action),
    nextRound: async (): Promise<Result> => {
      const g = gameRef.current;
      const def = defRef.current;
      if (!g || !def.roundOver(g) || name === null) return { ok: false, error: t('roundNotOver') };
      // Match over (düz okey: someone is out of points): a new game starts from scratch.
      if (def.matchOver(totals, round, def.defaultOptions)) setTotals([0, 0, 0, 0]);
      deal(names, round, mode);
      return { ok: true };
    },
    leave: () => {
      gameRef.current = null;
      setGame(null);
      setName(null);
      setRound(0);
    },
  };
}
