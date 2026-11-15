import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Action, type GameMode, type GameState, type RoomInfo, freezeClock, pickBotNames } from '@okey/shared';
import { NOTICE_MS, nextTurnClock, type TurnClock } from '@kahve/core';
import { okey101Def, okeyDuzDef, type OkeyOptions } from '@kahve/catalog';
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
 * A live penalty (GameNotice) freezes the clock and the bots for NOTICE_MS, as on the server.
 */
export function useLocalGame() {
  const [name, setName] = useState<string | null>(null);
  const [mode, setMode] = useState<GameMode>('101');
  const [names, setNames] = useState<string[]>([]);
  const [game, setGame] = useState<GameState | null>(null);
  const [round, setRound] = useState(0);
  /** `round` when the current match started (101 matchEnd counts hands from here). */
  const [matchStart, setMatchStart] = useState(0);
  const [totals, setTotals] = useState([0, 0, 0, 0]);
  const gameRef = useRef<GameState | null>(null);
  const optionsRef = useRef<OkeyOptions>(okey101Def.defaultOptions);
  /** The player's turn clock (bots move on their own short delay). */
  const [clock, setClock] = useState<TurnClock | null>(null);
  const clockRef = useRef<TurnClock | null>(null);
  /** Epoch ms until which the clock and bots are frozen for a notice panel (0 = not frozen). */
  const [frozenUntil, setFrozenUntil] = useState(0);
  const frozenRef = useRef(0);
  const lastNoticeRef = useRef(0);
  const defRef = useRef(okey101Def);

  const tick = useCallback((g: GameState, action: Action | null) => {
    const def = defRef.current;
    const now = Date.now();
    // A clock started or refilled during a notice panel starts counting when the panel goes away.
    let next = nextTurnClock(
      action ? clockRef.current : null,
      def.turn(g),
      action !== null && def.refillsClock(action),
      Math.max(now, frozenRef.current),
      def.clock,
    );
    const notice = def.noticeOf?.(g) ?? null;
    if (action && notice && notice.id !== lastNoticeRef.current) {
      lastNoticeRef.current = notice.id;
      const until = now + NOTICE_MS;
      next = freezeClock(next, until - Math.max(now, frozenRef.current));
      frozenRef.current = until;
      setFrozenUntil(until);
    }
    clockRef.current = next;
    setClock(next);
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
    const g = def.create(optionsRef.current, seatNames, Math.random, roundNo);
    gameRef.current = g;
    lastNoticeRef.current = 0;
    frozenRef.current = 0;
    setFrozenUntil(0);
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

  // Bots move one action at a time with a short delay so the player can follow; they wait out a notice panel.
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
    }, Math.max(BOT_DELAY_MS, frozenUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [game, frozenUntil, apply]);

  // Redraw once the panel goes away so the view's clock starts moving again.
  const [, setThawed] = useState(0);
  useEffect(() => {
    const left = frozenUntil - Date.now();
    if (left <= 0) return;
    const timer = setTimeout(() => setThawed((n) => n + 1), left);
    return () => clearTimeout(timer);
  }, [frozenUntil]);

  const frozen = frozenUntil > Date.now();
  const view = useMemo(() => {
    if (!game) return null;
    const v = defRef.current.viewFor(game, ME, { clock, now: Math.max(Date.now(), frozenUntil) });
    const left = frozenUntil - Date.now();
    return left > 0 ? { ...v, noticeMsLeft: left } : v;
    // `frozen` makes the view refresh when the panel ends.
  }, [game, clock, frozenUntil, frozen]);

  const matchOver = useMemo(
    () => !!game && defRef.current.roundOver(game) && defRef.current.matchOver(totals, round - matchStart, optionsRef.current),
    [game, totals, round, matchStart],
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
            matchOver,
          },
    [name, mode, names, round, totals, matchOver],
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
    /** The last finished round ended the match (101 matchEnd, düz: someone out of points). */
    matchOver,
    /** `options`: house rules (OkeyOptions), normalized like the server does. */
    begin: async (playerName: string, gameMode: GameMode = '101', options?: unknown): Promise<Result> => {
      const seatNames = [playerName, ...pickBotNames(3, [playerName])];
      optionsRef.current = defOf(gameMode).normalizeOptions(options);
      setName(playerName);
      setMode(gameMode);
      setNames(seatNames);
      setTotals([0, 0, 0, 0]);
      setMatchStart(0);
      deal(seatNames, 0, gameMode);
      return { ok: true };
    },
    act: async (action: Action): Promise<Result> => apply(ME, action),
    nextRound: async (): Promise<Result> => {
      const g = gameRef.current;
      if (!g || !defRef.current.roundOver(g) || name === null) return { ok: false, error: t('roundNotOver') };
      // Match over (düz okey: someone is out of points; 101: matchEnd): a new match starts from scratch.
      if (matchOver) {
        setTotals([0, 0, 0, 0]);
        setMatchStart(round);
      }
      deal(names, round, mode);
      return { ok: true };
    },
    leave: () => {
      gameRef.current = null;
      setGame(null);
      setName(null);
      setRound(0);
      setMatchStart(0);
    },
  };
}
