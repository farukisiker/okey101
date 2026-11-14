import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Action,
  type GameMode,
  type GameState,
  type RoomInfo,
  type TurnClock,
  SEATS,
  applyAction,
  botStep,
  createGame,
  matchOver,
  nextClock,
  pickBotNames,
  quickMove,
  viewFor,
} from '@okey/shared';
import type { Session } from './useOkey';
import { t } from '../i18n';

const BOT_DELAY_MS = 1300;
const ME = 0;

type Result = { ok: true } | { ok: false; error: string };

/**
 * Offline game against three bots, run on the device with the same rules and
 * bot code the server uses. No network needed.
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
  const tick = useCallback((g: GameState, action: Action | null) => {
    clockRef.current = nextClock(action ? clockRef.current : null, g, action, Date.now());
    setClock(clockRef.current);
  }, []);

  const apply = useCallback((seat: number, action: Action): Result => {
    const g = gameRef.current;
    if (!g) return { ok: false, error: t('noGame') };
    const res = applyAction(g, seat, action);
    if (!res.ok) return res;
    gameRef.current = res.state;
    tick(res.state, action);
    setGame(res.state);
    if (res.state.phase === 'finished') {
      const scores = res.state.result!.scores;
      setTotals((t) => t.map((v, i) => v + scores[i]));
    }
    return { ok: true };
  }, [tick]);

  const deal = useCallback((seatNames: string[], roundNo: number, gameMode: GameMode) => {
    const g = createGame({
      mode: gameMode,
      names: seatNames,
      startingSeat: roundNo % SEATS,
    });
    gameRef.current = g;
    tick(g, null);
    setGame(g);
    setRound(roundNo + 1);
  }, [tick]);

  // Out of time: draw from the deck, then throw a tile that is not part of a meld.
  // The draw leaves the clock run out, so the throw follows right after.
  useEffect(() => {
    if (!game || game.phase !== 'playing' || game.turn !== ME || !clock) return;
    const timer = setTimeout(() => {
      const g = gameRef.current;
      if (!g || g.phase !== 'playing' || g.turn !== ME) return;
      apply(ME, quickMove(viewFor(g, ME)));
    }, Math.max(0, clock.deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [game, clock, apply]);

  // Bots move one action at a time with a short delay so the player can follow.
  useEffect(() => {
    if (!game || game.phase !== 'playing' || game.turn === ME) return;
    const timer = setTimeout(() => {
      const g = gameRef.current;
      if (!g || g.phase !== 'playing' || g.turn === ME) return;
      const view = viewFor(g, g.turn);
      if (!apply(g.turn, botStep(view)).ok) {
        // Should not happen; fall back to the simplest legal move.
        const fallback: Action =
          g.turnPhase === 'draw'
            ? { type: 'draw', source: 'deck' }
            : { type: 'discard', tileId: view.hand.find((t) => t.id !== view.mustUseTileId)!.id };
        apply(g.turn, fallback);
      }
    }, BOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [game, apply]);

  const view = useMemo(() => (game ? viewFor(game, ME, clock) : null), [game, clock]);

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
      if (!g || g.phase !== 'finished' || name === null) return { ok: false, error: t('roundNotOver') };
      // Düz okey: once someone is out of points a new game starts from scratch.
      if (matchOver(mode, totals)) setTotals([0, 0, 0, 0]);
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
