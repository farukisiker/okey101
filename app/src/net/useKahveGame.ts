// B5 (Claude Opus): one client hook for every non-okey game (pişti, batak, tavla).
// Offline: a LocalHost on the device (same clock, notice freeze, seeded bots as the server Room).
// Online: protocol v2 over its own socket, open only while a card lobby or game is on screen, so okey's
// useOkey connection stays exactly as it was.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  type GameMode,
  type GameViewEnvelope,
  type KahveClientToServerEvents,
  type KahveServerToClientEvents,
  type PlayerView,
  type RoomInfo,
  type TableSummary,
  PROTOCOL_VERSION,
  pickBotNames,
} from '@okey/shared';
import { type AnyGameDefinition, type GameId, newSeed } from '@kahve/core';
import { getDefinition } from '@kahve/catalog';
import type { RoundSummary } from '../components/roundSummary';
import { t } from '../i18n';
import { batakNoteFromView } from './batakSummary';
import { cardSummary, viewScores, viewTeams } from './cardSummary';
import { tavlaNoteFromView, tavlaPointsFromView } from './tavlaSummary';
import { type HostTimes, LocalHost } from './localHost';

export { type HostTimes, msLeftNow } from './localHost';
import type { Result, TableClient } from './tableClient';
import type { Session } from './useOkey';

type KahveSocket = Socket<KahveServerToClientEvents, KahveClientToServerEvents>;

const ME = 0;
/** Before a bot's move (tavla: the first step of its turn; the steps after it follow at the catalog's 600 ms). */
const BOT_DELAY_MS = 1300;
const OFFLINE_ROOM = 'YEREL';

const isEnvelope = (p: PlayerView | GameViewEnvelope): p is GameViewEnvelope =>
  typeof p === 'object' && p !== null && 'view' in p && 'game' in p;

const roundKeyOf = (view: unknown, room: RoomInfo | null): number =>
  typeof view === 'object' && view !== null && typeof (view as { round?: unknown }).round === 'number'
    ? (view as { round: number }).round
    : (room?.round ?? 0);

export function useKahveGame<V = unknown, A = unknown>(gameId: GameId | null, serverUrl: string) {
  const def = useMemo<AnyGameDefinition | null>(() => (gameId ? getDefinition(gameId) : null), [gameId]);
  const [mode, setMode] = useState<'offline' | 'online' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- offline ----
  const hostRef = useRef<LocalHost<unknown, unknown, unknown> | null>(null);
  const [ver, setVer] = useState(0);
  const bump = useCallback(() => setVer((n) => n + 1), []);

  useEffect(() => {
    const host = hostRef.current;
    if (mode !== 'offline' || !host) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const due = host.due;
    if (due) {
      timers.push(
        setTimeout(() => {
          if (hostRef.current !== host) return;
          host.runDue(Date.now());
          bump();
        }, Math.max(0, due.at - Date.now())),
      );
    }
    // Redraw when a notice panel ends so the countdown moves again.
    const left = host.frozenUntil - Date.now();
    if (left > 0) timers.push(setTimeout(bump, left));
    return () => timers.forEach(clearTimeout);
  }, [mode, ver, bump]);

  // ---- online ----
  const socketRef = useRef<KahveSocket | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const roomRef = useRef<RoomInfo | null>(null);
  const watchingSalon = useRef(false);
  const gameRef = useRef(gameId);
  gameRef.current = gameId;
  const [connected, setConnected] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [onlineRoom, setOnlineRoom] = useState<RoomInfo | null>(null);
  const [onlineView, setOnlineView] = useState<{ view: V; at: number } | null>(null);
  const [salon, setSalon] = useState<TableSummary[]>([]);

  useEffect(() => {
    if (!gameId) return;
    const socket: KahveSocket = io(serverUrl, { transports: ['websocket'], reconnection: true, auth: { v: PROTOCOL_VERSION } });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      if (watchingSalon.current) socket.emit('salon:watch', true, { games: [gameId] });
      const s = sessionRef.current;
      if (s)
        socket.emit('room:join', { roomId: s.roomId, name: s.name, password: s.password, game: gameId }, (res) => {
          if (res.ok && res.seat !== s.seat) {
            sessionRef.current = { ...s, seat: res.seat };
            setSession(sessionRef.current);
          }
        });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('room:state', (r) => {
      roomRef.current = r;
      setOnlineRoom(r);
    });
    socket.on('game:view', (p) => {
      // Bare views come from old (v1) servers, which only run okey.
      if (isEnvelope(p) && p.game === gameRef.current) setOnlineView({ view: p.view as V, at: Date.now() });
    });
    socket.on('salon:list', setSalon);
    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
      setConnected(false);
    };
  }, [serverUrl, gameId]);

  const clearOnline = useCallback(() => {
    sessionRef.current = null;
    roomRef.current = null;
    setSession(null);
    setOnlineRoom(null);
    setOnlineView(null);
  }, []);

  const enter = useCallback(
    async (kind: 'room:create' | 'room:join' | 'room:quickPlay', name: string, p: { roomId?: string; isPublic?: boolean; password?: string; options?: unknown }): Promise<Result> => {
      const socket = socketRef.current;
      const game = gameRef.current;
      if (!socket?.connected || !game) return { ok: false, error: t('cantReachServer') };
      const extra = p.options === undefined ? {} : { options: p.options };
      let res;
      try {
        res =
          kind === 'room:join'
            ? await socket.timeout(5000).emitWithAck('room:join', { roomId: p.roomId ?? '', name, password: p.password, game })
            : kind === 'room:create'
              ? await socket.timeout(5000).emitWithAck('room:create', { name, game, isPublic: p.isPublic ?? false, password: p.password, ...extra })
              : await socket.timeout(5000).emitWithAck('room:quickPlay', { name, game, ...extra });
      } catch {
        return { ok: false, error: t('serverNoReply') };
      }
      if (!res.ok) return res;
      // An old server ignores `game` and seats us at an okey table (its room:state arrives before the ack).
      if (roomRef.current?.game !== game) {
        socket.emit('room:leave');
        clearOnline();
        return { ok: false, error: t('serverUpdating') };
      }
      watchingSalon.current = false;
      const s = { roomId: res.roomId, seat: res.seat, name, password: p.password };
      sessionRef.current = s;
      setSession(s);
      setMode('online');
      return { ok: true };
    },
    [clearOnline],
  );

  const call = useCallback(async (fn: (s: KahveSocket) => Promise<Result>): Promise<Result> => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, error: t('noConnection') };
    try {
      return await fn(socket);
    } catch {
      return { ok: false, error: t('serverNoReply') };
    }
  }, []);

  const watchSalon = useCallback((on: boolean) => {
    watchingSalon.current = on;
    if (gameRef.current) socketRef.current?.emit('salon:watch', on, { games: [gameRef.current] });
  }, []);

  // ---- what the screens see ----
  const host = hostRef.current;
  const offline = mode === 'offline' && host !== null;

  const offlineRoom = useMemo<RoomInfo | null>(() => {
    if (!offline || !host || !gameId) return null;
    return {
      id: OFFLINE_ROOM,
      mode: '101',
      game: gameId,
      seats: host.names.map((name, seat) => ({ seat, name, isBot: seat !== ME, connected: true })),
      hostSeat: ME,
      started: true,
      round: host.round,
      totals: [...host.totals],
      matchOver: host.matchOver(),
    };
    // `ver` changes after every host move.
  }, [offline, host, gameId, ver]);

  const offlineView = useMemo(() => {
    if (!offline || !host) return null;
    const at = Date.now();
    return { view: host.view(ME, at) as V, at };
  }, [offline, host, ver]);

  const room = offline ? offlineRoom : onlineRoom;
  const current = offline ? offlineView : onlineView;
  const view = current?.view ?? null;
  const seat = offline ? ME : (session?.seat ?? -1);
  const matchOver = room?.matchOver ?? false;

  // One summary object per finished hand: GameShell counts a hand for the ad gate whenever the object changes,
  // so a later room:state (a bot taking a seat, a reconnect) must not make a new one. Keyed by the view's own
  // round, so the next deal's room:state arriving just before its view doesn't either.
  const summaryRef = useRef<{ key: string; summary: RoundSummary } | null>(null);
  const summary = useMemo<RoundSummary | null>(() => {
    if (!room || !view) return null;
    const points =
      offline && host?.state && host.roundOver() ? host.def.scoreRound(host.state) : (viewScores(view) ?? tavlaPointsFromView(view));
    if (!points) return null;
    const key = `${room.id}:${roundKeyOf(view, room)}`;
    if (summaryRef.current?.key === key) return summaryRef.current.summary;
    const names = room.seats.map((x, i) => x?.name ?? String(i + 1));
    const note = batakNoteFromView(view, points, names, seat, t('you'), t) ?? tavlaNoteFromView(view, t);
    const s: RoundSummary = {
      ...cardSummary({
        names,
        points,
        totals: room.totals,
        matchOver: room.matchOver ?? false,
        teams: viewTeams(view),
        mySeat: seat,
        you: t('you'),
      }),
      ...(note ? { note } : {}),
    };
    summaryRef.current = { key, summary: s };
    return s;
  }, [room, view, offline, host, seat]);

  const humanCount = room ? room.seats.filter((s) => s && !s.isBot).length : 1;

  const run = useCallback(async (fn: () => Result | Promise<Result>): Promise<Result> => {
    setBusy(true);
    try {
      const res = await fn();
      setError(res.ok ? null : res.error);
      return res;
    } finally {
      setBusy(false);
    }
  }, []);

  /** "Hemen Oyna": against bots on this device. `options`: house rules, normalized by the game. */
  const playOffline = useCallback(
    async (name: string, options?: unknown): Promise<Result> => {
      if (!def) return { ok: false, error: t('noGame') };
      const h = new LocalHost<unknown, unknown, unknown>(def, { options, seed: newSeed(), botDelayMs: BOT_DELAY_MS });
      const res = h.start([name, ...pickBotNames(h.seats - 1, [name])], Date.now());
      if (!res.ok) return res;
      hostRef.current = h;
      summaryRef.current = null;
      setError(null);
      setMode('offline');
      bump();
      return { ok: true };
    },
    [def, bump],
  );

  const act = useCallback(
    (action: A): Promise<Result> =>
      run(async () => {
        if (offline && host) {
          const res = host.act(ME, action, Date.now());
          bump();
          return res;
        }
        return call((s) => s.timeout(5000).emitWithAck('game:action', action as never));
      }),
    [offline, host, run, call, bump],
  );

  const nextRound = useCallback(
    (): Promise<Result> =>
      run(async () => {
        if (offline && host) {
          const res = host.nextRound(Date.now());
          if (!res.ok) return { ok: false, error: t('roundNotOver') };
          bump();
          return res;
        }
        return call((s) => s.timeout(5000).emitWithAck('room:nextRound'));
      }),
    [offline, host, run, call, bump],
  );

  const leave = useCallback(() => {
    if (mode === 'online') socketRef.current?.emit('room:leave');
    hostRef.current = null;
    summaryRef.current = null;
    clearOnline();
    setMode(null);
    setError(null);
  }, [mode, clearOnline]);

  const client: TableClient = {
    connected,
    session: offline ? { roomId: OFFLINE_ROOM, seat: ME, name: host?.names[ME] ?? '' } : session,
    room,
    salon,
    watchSalon,
    createRoom: (name: string, _mode: GameMode, isPublic = false, password?: string, options?: unknown) =>
      enter('room:create', name, { isPublic, password, options }),
    joinRoom: (name: string, roomId: string, password?: string) => enter('room:join', name, { roomId, password }),
    start: () => call((s) => s.timeout(5000).emitWithAck('room:start')),
    leave,
  };

  return {
    ...client,
    gameId,
    /** null: not at a table; 'offline': against bots on the device; 'online': at a server table. */
    mode,
    /** This seat's view plus the host's times (turnMsLeft, noticeMsLeft). */
    view: view as (V & HostTimes) | null,
    /** Epoch ms when `view` arrived; count the clock down from here with msLeftNow. */
    viewAt: current?.at ?? 0,
    seat,
    matchOver,
    summary,
    /** People (not bots) at the table, for the ad break rule. */
    humanCount,
    busy,
    error,
    playOffline,
    /** Online quick play: a server table with bots right away. */
    quickPlay: (name: string, options?: unknown) => enter('room:quickPlay', name, { options }),
    act,
    nextRound,
  };
}

export type KahveClient = ReturnType<typeof useKahveGame>;
