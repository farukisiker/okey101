import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Action,
  type GameState,
  type RoomInfo,
  SEATS,
  applyAction,
  botStep,
  createGame,
  pickBotNames,
  viewFor,
} from '@okey/shared';
import type { Session } from './useOkey';

const BOT_DELAY_MS = 1300;
const ME = 0;

type Result = { ok: true } | { ok: false; error: string };

/**
 * Offline game against three bots, run on the device with the same rules and
 * bot code the server uses. No network needed.
 */
export function useLocalGame() {
  const [name, setName] = useState<string | null>(null);
  const [names, setNames] = useState<string[]>([]);
  const [game, setGame] = useState<GameState | null>(null);
  const [round, setRound] = useState(0);
  const [totals, setTotals] = useState([0, 0, 0, 0]);
  const gameRef = useRef<GameState | null>(null);

  const apply = useCallback((seat: number, action: Action): Result => {
    const g = gameRef.current;
    if (!g) return { ok: false, error: 'Oyun yok' };
    const res = applyAction(g, seat, action);
    if (!res.ok) return res;
    gameRef.current = res.state;
    setGame(res.state);
    if (res.state.phase === 'finished') {
      const scores = res.state.result!.scores;
      setTotals((t) => t.map((v, i) => v + scores[i]));
    }
    return { ok: true };
  }, []);

  const deal = useCallback((seatNames: string[], roundNo: number) => {
    const g = createGame({
      names: seatNames,
      startingSeat: roundNo % SEATS,
    });
    gameRef.current = g;
    setGame(g);
    setRound(roundNo + 1);
  }, []);

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

  const view = useMemo(() => (game ? viewFor(game, ME) : null), [game]);

  const room = useMemo<RoomInfo | null>(
    () =>
      name === null
        ? null
        : {
            id: 'YEREL',
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
    [name, names, round, totals],
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
    begin: async (playerName: string): Promise<Result> => {
      const seatNames = [playerName, ...pickBotNames(3, [playerName])];
      setName(playerName);
      setNames(seatNames);
      setTotals([0, 0, 0, 0]);
      deal(seatNames, 0);
      return { ok: true };
    },
    act: async (action: Action): Promise<Result> => apply(ME, action),
    nextRound: async (): Promise<Result> => {
      const g = gameRef.current;
      if (!g || g.phase !== 'finished' || name === null) return { ok: false, error: 'Tur bitmedi' };
      deal(names, round);
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
