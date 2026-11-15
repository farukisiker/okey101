import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { t } from '../i18n';
import {
  type Action,
  type GameId,
  type GameMode,
  type GameViewEnvelope,
  type KahveClientToServerEvents,
  type KahveServerToClientEvents,
  type PlayerView,
  type RoomInfo,
  type TableSummary,
  PROTOCOL_VERSION,
  gameOfMode,
  isOkeyGame,
} from '@okey/shared';

type OkeySocket = Socket<KahveServerToClientEvents, KahveClientToServerEvents>;

/** v2 servers wrap every view as { game, view }; old (v1) servers send the bare okey PlayerView. */
const isEnvelope = (p: PlayerView | GameViewEnvelope): p is GameViewEnvelope =>
  typeof p === 'object' && p !== null && 'view' in p && 'game' in p;

export interface Session {
  roomId: string;
  seat: number;
  name: string;
  /** A locked table's password, to sit back down after a dropped connection. */
  password?: string;
}

type Result = { ok: true } | { ok: false; error: string };

/**
 * Socket connection to the authoritative server. The app only sends moves;
 * the server answers with the room and this player's own view.
 */
export function useOkey(serverUrl: string) {
  const socketRef = useRef<OkeySocket | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const [connected, setConnected] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const roomRef = useRef<RoomInfo | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [salon, setSalon] = useState<TableSummary[]>([]);
  const watchingSalon = useRef(false);

  useEffect(() => {
    // auth.v tells a v2 server we understand the { game, view } envelope; old servers ignore it.
    const socket: OkeySocket = io(serverUrl, { transports: ['websocket'], reconnection: true, auth: { v: PROTOCOL_VERSION } });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      if (watchingSalon.current) socket.emit('salon:watch', true);
      // Reclaim our seat after a dropped connection.
      const s = sessionRef.current;
      if (s)
        socket.emit('room:join', { roomId: s.roomId, name: s.name, password: s.password }, (res) => {
          if (res.ok && res.seat !== s.seat) {
            sessionRef.current = { ...s, seat: res.seat };
            setSession(sessionRef.current);
          }
        });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('room:state', (r) => {
      roomRef.current = r;
      setRoom(r);
    });
    socket.on('game:view', (p) => {
      if (!isEnvelope(p)) return setView(p);
      // Only okey has a game screen so far; other games' views are ignored until they get one.
      if (isOkeyGame(p.game)) setView(p.view as PlayerView);
    });
    socket.on('salon:list', setSalon);
    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [serverUrl]);

  const enter = useCallback(
    async (
      kind: 'room:create' | 'room:quickPlay' | 'room:join',
      name: string,
      roomId = '',
      mode: GameMode = '101',
      isPublic = false,
      password?: string,
      game: GameId = gameOfMode(mode),
    ): Promise<Result> => {
      const socket = socketRef.current;
      if (!socket?.connected) return { ok: false, error: t('cantReachServer') };
      // `mode` is still sent: an old server only reads that.
      const res =
        kind === 'room:join'
          ? await socket.timeout(5000).emitWithAck('room:join', { roomId, name, password })
          : kind === 'room:create'
            ? await socket.timeout(5000).emitWithAck(kind, { name, mode, game, isPublic, password })
            : await socket.timeout(5000).emitWithAck(kind, { name, mode, game });
      if (!res.ok) return res;
      // An old server ignores `game` and seats us at an okey table (its room:state arrives before the ack).
      if (kind !== 'room:join' && !isOkeyGame(game) && roomRef.current?.game !== game) {
        socket.emit('room:leave');
        roomRef.current = null;
        setRoom(null);
        setView(null);
        return { ok: false, error: t('serverUpdating') };
      }
      watchingSalon.current = false;
      const s = { roomId: res.roomId, seat: res.seat, name, password };
      sessionRef.current = s;
      setSession(s);
      return { ok: true };
    },
    [],
  );

  const call = useCallback(async (fn: (s: OkeySocket) => Promise<Result>): Promise<Result> => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, error: t('noConnection') };
    try {
      return await fn(socket);
    } catch {
      return { ok: false, error: t('serverNoReply') };
    }
  }, []);

  /** Follow the salon's table list while the salon screen is open. */
  const watchSalon = useCallback((on: boolean) => {
    watchingSalon.current = on;
    socketRef.current?.emit('salon:watch', on);
  }, []);

  return {
    connected,
    session,
    room,
    view,
    quickPlay: (name: string, mode: GameMode = '101') => enter('room:quickPlay', name, '', mode),
    /** `isPublic`: the table shows up in the salon. `password` (6 digits): it shows up locked. */
    createRoom: (name: string, mode: GameMode = '101', isPublic = false, password?: string) =>
      enter('room:create', name, '', mode, isPublic, password),
    salon,
    watchSalon,
    joinRoom: (name: string, roomId: string, password?: string) => enter('room:join', name, roomId, '101', false, password),
    start: () => call((s) => s.timeout(5000).emitWithAck('room:start')),
    nextRound: () => call((s) => s.timeout(5000).emitWithAck('room:nextRound')),
    act: (action: Action) => call((s) => s.timeout(5000).emitWithAck('game:action', action)),
    leave: () => {
      socketRef.current?.emit('room:leave');
      sessionRef.current = null;
      setSession(null);
      roomRef.current = null;
      setRoom(null);
      setView(null);
    },
  };
}

export type OkeyClient = ReturnType<typeof useOkey>;
