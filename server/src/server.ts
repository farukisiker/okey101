import { createServer as createHttpServer } from 'node:http';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@okey/shared';
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

  app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  const broadcast = (room: Room) => {
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

  const leave = (socket: ClientSocket) => {
    const roomId = membership.get(socket.id);
    if (!roomId) return;
    membership.delete(socket.id);
    socket.leave(roomId);
    const room = rooms.get(roomId);
    if (!room) return;
    room.disconnect(socket.id);
    // Keep an empty room a little while so a dropped player can reconnect.
    if (!room.hasHumans()) {
      setTimeout(() => {
        if (!room.hasHumans() && rooms.get(roomId) === room) {
          room.dispose();
          rooms.delete(roomId);
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
    broadcast(room);
    return seat;
  };

  const roomOf = (socket: ClientSocket) => {
    const room = rooms.get(membership.get(socket.id) ?? '');
    return room ? { room, seat: room.seatOf(socket.id) } : null;
  };

  io.on('connection', (socket) => {
    socket.on('room:create', ({ name }, ack) => {
      const room = new Room(newRoomId(), broadcast, roomOpts);
      rooms.set(room.id, room);
      const seat = enter(socket, room, name);
      if (typeof seat === 'string') return ack({ ok: false, error: seat });
      ack({ ok: true, roomId: room.id, seat });
    });

    socket.on('room:join', ({ roomId, name }, ack) => {
      const room = rooms.get(roomId.trim().toUpperCase());
      if (!room) return ack({ ok: false, error: 'Oda bulunamadı' });
      const seat = enter(socket, room, name);
      if (typeof seat === 'string') return ack({ ok: false, error: seat });
      ack({ ok: true, roomId: room.id, seat });
    });

    socket.on('room:quickPlay', ({ name }, ack) => {
      const room = new Room(newRoomId(), broadcast, roomOpts);
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

    socket.on('room:leave', () => leave(socket));
    socket.on('disconnect', () => leave(socket));
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
      await io.close();
    },
  };
}
