import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { t } from '../i18n';
import type {
  Action,
  ClientToServerEvents,
  GameMode,
  PlayerView,
  RoomInfo,
  ServerToClientEvents,
  TableSummary,
} from '@okey/shared';

type OkeySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

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
  const [view, setView] = useState<PlayerView | null>(null);
  const [salon, setSalon] = useState<TableSummary[]>([]);
  const watchingSalon = useRef(false);

  useEffect(() => {
    const socket: OkeySocket = io(serverUrl, { transports: ['websocket'], reconnection: true });
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
    socket.on('room:state', setRoom);
    socket.on('game:view', setView);
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
    ): Promise<Result> => {
      const socket = socketRef.current;
      if (!socket?.connected) return { ok: false, error: t('cantReachServer') };
      const res =
        kind === 'room:join'
          ? await socket.timeout(5000).emitWithAck('room:join', { roomId, name, password })
          : kind === 'room:create'
            ? await socket.timeout(5000).emitWithAck(kind, { name, mode, isPublic, password })
            : await socket.timeout(5000).emitWithAck(kind, { name, mode });
      if (!res.ok) return res;
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
      setRoom(null);
      setView(null);
    },
  };
}

export type OkeyClient = ReturnType<typeof useOkey>;
