import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { Action, ClientToServerEvents, PlayerView, RoomInfo, ServerToClientEvents } from '@okey/shared';

type OkeySocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface Session {
  roomId: string;
  seat: number;
  name: string;
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

  useEffect(() => {
    const socket: OkeySocket = io(serverUrl, { transports: ['websocket'], reconnection: true });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      // Reclaim our seat after a dropped connection.
      const s = sessionRef.current;
      if (s)
        socket.emit('room:join', { roomId: s.roomId, name: s.name }, (res) => {
          if (res.ok && res.seat !== s.seat) {
            sessionRef.current = { ...s, seat: res.seat };
            setSession(sessionRef.current);
          }
        });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('room:state', setRoom);
    socket.on('game:view', setView);
    return () => {
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [serverUrl]);

  const enter = useCallback(
    async (kind: 'room:create' | 'room:quickPlay' | 'room:join', name: string, roomId = ''): Promise<Result> => {
      const socket = socketRef.current;
      if (!socket?.connected) return { ok: false, error: 'Sunucuya bağlanılamadı' };
      const res =
        kind === 'room:join'
          ? await socket.timeout(5000).emitWithAck('room:join', { roomId, name })
          : await socket.timeout(5000).emitWithAck(kind, { name });
      if (!res.ok) return res;
      const s = { roomId: res.roomId, seat: res.seat, name };
      sessionRef.current = s;
      setSession(s);
      return { ok: true };
    },
    [],
  );

  const call = useCallback(async (fn: (s: OkeySocket) => Promise<Result>): Promise<Result> => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, error: 'Bağlantı yok' };
    try {
      return await fn(socket);
    } catch {
      return { ok: false, error: 'Sunucu yanıt vermedi' };
    }
  }, []);

  return {
    connected,
    session,
    room,
    view,
    quickPlay: (name: string) => enter('room:quickPlay', name),
    createRoom: (name: string) => enter('room:create', name),
    joinRoom: (name: string, roomId: string) => enter('room:join', name, roomId),
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
