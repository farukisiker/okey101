import { createServer as createHttpServer } from 'node:http';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import { type ClientToServerEvents, type GameMode, isTablePassword, type ServerToClientEvents, type TableSummary } from '@okey/shared';
import { Room, type RoomOptions } from './room';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export interface OkeyServer {
  io: IO;
  rooms: Map<string, Room>;
  listen(port: number): Promise<number>;
  close(): Promise<void>;
}

export function createOkeyServer(roomOpts: RoomOptions = {}, emptyRoomTtlMs = 120_000): OkeyServer {
  const app = express();
  const http = createHttpServer(app);
  const io: IO = new Server(http, { cors: { origin: '*' } });
  const rooms = new Map<string, Room>();
  /** socket id -> room id */
  const membership = new Map<string, string>();
  /** socket id -> wrong table passwords in a row, and until when it is locked out */
  const wrongPasswords = new Map<string, { count: number; until: number }>();
  const MAX_WRONG_PASSWORDS = 5;
  const WRONG_PASSWORD_LOCK_MS = 60_000;

  app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  // Salon: public tables with someone at them and a seat to take. Fuller
  // waiting tables first (they start soonest), then games with a bot seat.
  const SALON = 'salon';
  const salonList = (): TableSummary[] =>
    [...rooms.values()]
      .filter((r) => r.isPublic && r.hasHumans())
      .map((r) => r.summary())
      .filter((t) => t.free > 0)
      .sort((a, b) => Number(a.started) - Number(b.started) || a.free - b.free)
      .slice(0, 50);
  let salonTimer: ReturnType<typeof setTimeout> | null = null;
  const salonChanged = () => {
    salonTimer ??= setTimeout(() => {
      salonTimer = null;
      io.to(SALON).emit('salon:list', salonList());
    }, 200);
  };

  const broadcast = (room: Room) => {
    if (room.isPublic) salonChanged();
    io.to(room.id).emit('room:state', room.info());
    room.seats.forEach((s, seat) => {
      if (s?.socketId) {
        const view = room.viewFor(seat);
        if (view) io.to(s.socketId).emit('game:view', view);
      }
    });
  };

  const newRoomId = () => {
    let id: string;
    do id = Math.random().toString(36).slice(2, 7).toUpperCase();
    while (rooms.has(id));
    return id;
  };

  /** `onPurpose`: the player left the table (a bot takes over); otherwise the connection dropped. */
  const leave = (socket: ClientSocket, onPurpose = false) => {
    const roomId = membership.get(socket.id);
    if (!roomId) return;
    membership.delete(socket.id);
    socket.leave(roomId);
    const room = rooms.get(roomId);
    if (!room) return;
    if (onPurpose) room.leave(socket.id);
    else room.disconnect(socket.id);
    // Keep an empty room a little while so a dropped player can reconnect.
    if (!room.hasHumans()) {
      setTimeout(() => {
        if (!room.hasHumans() && rooms.get(roomId) === room) {
          room.dispose();
          rooms.delete(roomId);
          if (room.isPublic) salonChanged();
        }
      }, emptyRoomTtlMs).unref();
    }
  };

  const enter = (socket: ClientSocket, room: Room, name: string) => {
    leave(socket);
    const seat = room.join(name.trim().slice(0, 20) || 'Oyuncu', socket.id);
    if (typeof seat === 'string') return seat;
    membership.set(socket.id, room.id);
    socket.join(room.id);
    socket.leave(SALON);
    broadcast(room);
    return seat;
  };

  const roomOf = (socket: ClientSocket) => {
    const room = rooms.get(membership.get(socket.id) ?? '');
    return room ? { room, seat: room.seatOf(socket.id) } : null;
  };

  // Older apps send no mode: they play 101.
  const modeOf = (mode: unknown): GameMode => (mode === 'duz' ? 'duz' : '101');

  io.on('connection', (socket) => {
    socket.on('room:create', ({ name, mode, isPublic, password }, ack) => {
      if (password !== undefined && !isTablePassword(password)) return ack({ ok: false, error: 'Şifre 6 rakam olmalı' });
      // A locked table is listed in the salon too: people see it and ask for the password.
      const room = new Room(newRoomId(), broadcast, {
        ...roomOpts,
        mode: modeOf(mode),
        isPublic: isPublic === true || password !== undefined,
        password: password ?? null,
      });
      rooms.set(room.id, room);
      const seat = enter(socket, room, name);
      if (typeof seat === 'string') return ack({ ok: false, error: seat });
      ack({ ok: true, roomId: room.id, seat });
    });

    socket.on('room:join', ({ roomId, name, password }, ack) => {
      const room = rooms.get(String(roomId).trim().toUpperCase());
      if (!room) return ack({ ok: false, error: 'Masa bulunamadı' });
      if (room.password !== null && room.seatOf(socket.id) < 0) {
        const wrong = wrongPasswords.get(socket.id);
        if (wrong && wrong.until > Date.now()) return ack({ ok: false, error: 'Çok fazla yanlış şifre, biraz bekleyin' });
        if (password !== room.password) {
          const count = (wrong?.count ?? 0) + 1;
          const locked = count >= MAX_WRONG_PASSWORDS;
          wrongPasswords.set(socket.id, { count: locked ? 0 : count, until: locked ? Date.now() + WRONG_PASSWORD_LOCK_MS : 0 });
          return ack({ ok: false, error: password ? 'Şifre yanlış' : 'Bu masa şifreli' });
        }
        wrongPasswords.delete(socket.id);
      }
      const seat = enter(socket, room, name);
      if (typeof seat === 'string') return ack({ ok: false, error: seat });
      ack({ ok: true, roomId: room.id, seat });
      room.startIfFull();
    });

    socket.on('room:quickPlay', ({ name, mode }, ack) => {
      const room = new Room(newRoomId(), broadcast, { ...roomOpts, mode: modeOf(mode) });
      rooms.set(room.id, room);
      const seat = enter(socket, room, name);
      if (typeof seat === 'string') return ack({ ok: false, error: seat });
      ack({ ok: true, roomId: room.id, seat });
      room.start();
    });

    socket.on('room:start', (ack) => {
      const r = roomOf(socket);
      if (!r) return ack({ ok: false, error: 'Odada değilsiniz' });
      if (r.seat !== r.room.hostSeat) return ack({ ok: false, error: 'Sadece oda sahibi başlatabilir' });
      const err = r.room.start();
      ack(err ? { ok: false, error: err } : { ok: true });
    });

    socket.on('room:nextRound', (ack) => {
      const r = roomOf(socket);
      if (!r) return ack({ ok: false, error: 'Odada değilsiniz' });
      const err = r.room.nextRound();
      ack(err ? { ok: false, error: err } : { ok: true });
    });

    socket.on('game:action', (action, ack) => {
      const r = roomOf(socket);
      if (!r || r.seat < 0) return ack({ ok: false, error: 'Odada değilsiniz' });
      const err = r.room.act(r.seat, action);
      ack(err ? { ok: false, error: err } : { ok: true });
    });

    socket.on('room:leave', () => leave(socket, true));
    socket.on('salon:watch', (on) => {
      if (!on) return void socket.leave(SALON);
      socket.join(SALON);
      socket.emit('salon:list', salonList());
    });
    socket.on('disconnect', () => {
      wrongPasswords.delete(socket.id);
      leave(socket);
    });
  });

  return {
    io,
    rooms,
    listen: (port) =>
      new Promise((resolve) => {
        http.listen(port, () => {
          const addr = http.address();
          resolve(typeof addr === 'object' && addr ? addr.port : port);
        });
      }),
    close: async () => {
      rooms.forEach((r) => r.dispose());
      if (salonTimer) clearTimeout(salonTimer);
      await io.close();
    },
  };
}
