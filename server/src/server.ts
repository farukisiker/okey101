import { createServer as createHttpServer } from 'node:http';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import {
  type GameId,
  type KahveClientToServerEvents,
  type KahveServerToClientEvents,
  type PlayerView,
  type RoomInfo,
  type SalonFilter,
  type SeatInfo,
  type TableSummary,
  type TableSaid,
  type VoiceTokenResult,
  ERR_UPDATE_APP,
  clientProtocol,
  gameOfMode,
  isOkeyGame,
  isQuickEmoji,
  isQuickSaying,
  isTablePassword,
} from '@okey/shared';
import { isGameId } from '@kahve/core';
import { getDefinition } from '@kahve/catalog';
import { SayLimiter } from './chat';
import { type AnyRoom, Room, type RoomOptions } from './room';
import { type LiveKitConfig, identitySuffix, liveKitConfigFromEnv, liveKitToken } from './voice';

type IO = Server<KahveClientToServerEvents, KahveServerToClientEvents>;
type ClientSocket = Socket<KahveClientToServerEvents, KahveServerToClientEvents>;

export interface OkeyServer {
  io: IO;
  rooms: Map<string, AnyRoom>;
  listen(port: number): Promise<number>;
  close(): Promise<void>;
}

/** Tables a v1 client (Demli Okey ≤ 1.0.1) can see and sit at, and a v2 salon watcher without a filter gets. */
const OKEY_GAMES: readonly GameId[] = ['okey101', 'okeyDuz'];

/** v1 payloads are exactly what 1.0.1 got: no `game` (or A7 `matchOver`, E2 `voice` / seat `accountId`) field anywhere. */
function v1Info({ game: _game, matchOver: _matchOver, voice: _voice, ...info }: RoomInfo): RoomInfo {
  return { ...info, seats: info.seats.map((s) => (s ? v1Seat(s) : null)) };
}
function v1Seat({ accountId: _accountId, ...seat }: SeatInfo): SeatInfo {
  return seat;
}
/** v1 game views without the A7 notice fields (1.0.1 has no notice panel). */
function v1View({ notice: _n, notices: _ns, noticeMsLeft: _l, islek: _i, ...view }: PlayerView): PlayerView {
  return view;
}
function v1Summary({ game: _game, ...table }: TableSummary): TableSummary {
  return table;
}

/** Accounts ids are UUIDs; anything else is dropped (the id is unverified anyway, see SeatInfo.accountId). */
const ACCOUNT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanAccountId = (v: unknown): string | null => (typeof v === 'string' && ACCOUNT_ID_RE.test(v) ? v.toLowerCase() : null);

export interface ServerExtras {
  /** E2 voice: LiveKit address and keys. Missing = read LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET; null = not configured. */
  livekit?: LiveKitConfig | null;
  /** E2 'table:say' limits (tests). Defaults: SAY_MIN_GAP_MS, SAY_PER_MINUTE. */
  sayMinGapMs?: number;
  sayPerMinute?: number;
}

export function createOkeyServer(roomOpts: RoomOptions = {}, emptyRoomTtlMs = 120_000, extras: ServerExtras = {}): OkeyServer {
  const livekit = extras.livekit === undefined ? liveKitConfigFromEnv() : extras.livekit;
  const sayLimiter = new SayLimiter(extras.sayMinGapMs, extras.sayPerMinute);
  /** socket id -> random part of its LiveKit identity (stable per socket, so a re-requested token replaces the old participant) */
  const voiceIds = new Map<string, string>();
  const app = express();
  const http = createHttpServer(app);
  const io: IO = new Server(http, { cors: { origin: '*' } });
  const rooms = new Map<string, AnyRoom>();
  /** socket id -> room id */
  const membership = new Map<string, string>();
  /** socket id -> protocol version from the handshake (1 = Demli Okey ≤ 1.0.1) */
  const protocols = new Map<string, number>();
  /** socket id -> games the salon watcher wants */
  const salonFilters = new Map<string, readonly GameId[]>();
  /** socket id -> wrong table passwords in a row, and until when it is locked out */
  const wrongPasswords = new Map<string, { count: number; until: number }>();
  const MAX_WRONG_PASSWORDS = 5;
  const WRONG_PASSWORD_LOCK_MS = 60_000;

  const isV1 = (socketId: string) => (protocols.get(socketId) ?? 1) < 2;

  app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  // Salon: public tables with someone at them and a seat to take. Fuller
  // waiting tables first (they start soonest), then games with a bot seat.
  // Each watcher gets only the games it asked for (v1: okey only, without `game`).
  const SALON = 'salon';
  const salonList = (games: readonly GameId[], v1: boolean): TableSummary[] =>
    [...rooms.values()]
      .filter((r) => r.isPublic && r.hasHumans() && games.includes(r.gameId))
      .map((r) => r.summary())
      .filter((t) => t.free > 0)
      .sort((a, b) => Number(a.started) - Number(b.started) || a.free - b.free)
      .slice(0, 50)
      .map((t) => (v1 ? v1Summary(t) : t));
  const sendSalon = (socket: { id: string; emit: ClientSocket['emit'] }) => {
    const v1 = isV1(socket.id);
    socket.emit('salon:list', salonList(v1 ? OKEY_GAMES : (salonFilters.get(socket.id) ?? OKEY_GAMES), v1));
  };
  let salonTimer: ReturnType<typeof setTimeout> | null = null;
  const salonChanged = () => {
    salonTimer ??= setTimeout(() => {
      salonTimer = null;
      for (const id of io.sockets.adapter.rooms.get(SALON) ?? []) {
        const s = io.sockets.sockets.get(id);
        if (s) sendSalon(s);
      }
    }, 200);
  };

  const broadcast = (room: AnyRoom) => {
    if (room.isPublic) salonChanged();
    const info = room.info();
    for (const id of io.sockets.adapter.rooms.get(room.id) ?? []) {
      io.to(id).emit('room:state', isV1(id) ? v1Info(info) : info);
    }
    room.seats.forEach((s, seat) => {
      if (s?.socketId) {
        const view = room.viewFor(seat);
        if (!view) return;
        // v1 sockets only ever sit at okey tables (enforced on create/join), so `view` is a PlayerView.
        io.to(s.socketId).emit('game:view', isV1(s.socketId) ? v1View(view as PlayerView) : { game: room.gameId, view });
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

  /** v2 only: the accounts id from the payload, else from the handshake. v1 apps never send one. */
  const accountIdOf = (socket: ClientSocket, fromPayload: unknown): string | null =>
    isV1(socket.id)
      ? null
      : (cleanAccountId(fromPayload) ?? cleanAccountId((socket.handshake.auth as { accountId?: unknown } | null)?.accountId));

  const enter = (socket: ClientSocket, room: AnyRoom, name: string, accountId: string | null = null) => {
    leave(socket);
    const seat = room.join(name.trim().slice(0, 20) || 'Oyuncu', socket.id, accountId);
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

  /**
   * Which game a create/quickPlay asks for. Older apps send no `game` (only `mode`): okey.
   * A v1 app can't play anything but okey, so it is told to update instead of getting a table it can't draw.
   */
  const gameFor = (socket: ClientSocket, p: { mode?: unknown; game?: unknown }): GameId | { error: string } => {
    if (p.game === undefined) return gameOfMode(p.mode);
    if (!isGameId(p.game)) return { error: 'Bilinmeyen oyun' };
    if (isV1(socket.id) && !isOkeyGame(p.game)) return { error: ERR_UPDATE_APP };
    if (!getDefinition(p.game)) return { error: 'Bu oyun yakında geliyor' };
    return p.game;
  };

  io.on('connection', (socket) => {
    protocols.set(socket.id, clientProtocol(socket.handshake.auth));

    socket.on('room:create', ({ name, mode, game, options, isPublic, password, voice, accountId }, ack) => {
      if (password !== undefined && !isTablePassword(password)) return ack({ ok: false, error: 'Şifre 6 rakam olmalı' });
      const g = gameFor(socket, { mode, game });
      if (typeof g !== 'string') return ack({ ok: false, error: g.error });
      // A locked table is listed in the salon too: people see it and ask for the password.
      const listed = isPublic === true || password !== undefined;
      // E2 voice is the host's choice. v2 default: on at a friends table (password, or code only), off at an
      // open listed one. A v1 host never chose it, so its table stays without voice.
      const withVoice = isV1(socket.id) ? false : typeof voice === 'boolean' ? voice : !listed || password !== undefined;
      const room = new Room(newRoomId(), broadcast, {
        ...roomOpts,
        game: g,
        options,
        isPublic: listed,
        password: password ?? null,
        voice: withVoice,
      });
      rooms.set(room.id, room);
      const seat = enter(socket, room, name, accountIdOf(socket, accountId));
      if (typeof seat === 'string') return ack({ ok: false, error: seat });
      ack({ ok: true, roomId: room.id, seat });
    });

    socket.on('room:join', ({ roomId, name, password, game, accountId }, ack) => {
      const room = rooms.get(String(roomId).trim().toUpperCase());
      if (!room) return ack({ ok: false, error: 'Masa bulunamadı' });
      if (isV1(socket.id) && !isOkeyGame(room.gameId)) return ack({ ok: false, error: ERR_UPDATE_APP });
      if (game !== undefined && game !== room.gameId) return ack({ ok: false, error: 'Bu masa başka bir oyun' });
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
      const seat = enter(socket, room, name, accountIdOf(socket, accountId));
      if (typeof seat === 'string') return ack({ ok: false, error: seat });
      ack({ ok: true, roomId: room.id, seat });
      room.startIfFull();
    });

    socket.on('room:quickPlay', ({ name, mode, game, options, accountId }, ack) => {
      const g = gameFor(socket, { mode, game });
      if (typeof g !== 'string') return ack({ ok: false, error: g.error });
      const room = new Room(newRoomId(), broadcast, { ...roomOpts, game: g, options });
      rooms.set(room.id, room);
      const seat = enter(socket, room, name, accountIdOf(socket, accountId));
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
      // Untrusted input: shape check first, then the rules decide.
      if (!r.room.def.isAction(action)) return ack({ ok: false, error: 'Geçersiz hamle' });
      const err = r.room.act(r.seat, action);
      ack(err ? { ok: false, error: err } : { ok: true });
    });

    // E2: quick sayings / emoji (no free text). Seated humans on v2 apps only, rate limited per socket.
    socket.on('table:say', (msg, ack) => {
      if (typeof ack !== 'function') return;
      const r = roomOf(socket);
      if (!r || r.seat < 0 || isV1(socket.id)) return ack({ ok: false, error: 'not_seated' });
      const m = (typeof msg === 'object' && msg !== null ? msg : {}) as { saying?: unknown; emoji?: unknown };
      const saying = m.saying === undefined ? undefined : isQuickSaying(m.saying) ? m.saying : null;
      const emoji = m.emoji === undefined ? undefined : isQuickEmoji(m.emoji) ? m.emoji : null;
      if (saying === null || emoji === null || (saying === undefined) === (emoji === undefined)) {
        return ack({ ok: false, error: 'invalid' });
      }
      if (!sayLimiter.allow(socket.id)) return ack({ ok: false, error: 'rate_limited' });
      const said: TableSaid = saying ? { seat: r.seat, saying, at: Date.now() } : { seat: r.seat, emoji: emoji!, at: Date.now() };
      // v1 apps (Demli Okey <= 1.0.1) never get this event.
      for (const id of io.sockets.adapter.rooms.get(r.room.id) ?? []) if (!isV1(id)) io.to(id).emit('table:said', said);
      ack({ ok: true });
    });

    // E2: LiveKit token for the table's voice room. The server records nothing and does not police the room
    // (leaving the table = the app leaves the room).
    socket.on('voice:token', (ack) => {
      if (typeof ack !== 'function') return;
      const answer = (res: VoiceTokenResult) => ack(res);
      const r = roomOf(socket);
      const seat = r && r.seat >= 0 ? r.room.seats[r.seat] : null;
      if (!r || !seat || seat.isBot || isV1(socket.id)) return answer({ ok: false, error: 'not_seated' });
      if (!r.room.voice) return answer({ ok: false, error: 'voice_off' });
      if (!livekit) return answer({ ok: false, error: 'not_configured' });
      let suffix = voiceIds.get(socket.id);
      if (!suffix) voiceIds.set(socket.id, (suffix = identitySuffix()));
      const identity = `s${r.seat}-${suffix}`;
      const token = liveKitToken(livekit, { room: r.room.id, identity, name: seat.name });
      answer({ ok: true, url: livekit.url, token, room: r.room.id, identity });
    });

    socket.on('room:leave', () => leave(socket, true));
    socket.on('salon:watch', (on, filter?: SalonFilter) => {
      if (!on) {
        salonFilters.delete(socket.id);
        return void socket.leave(SALON);
      }
      // v2 filter: known games only; missing or empty = okey tables (what v1 sees).
      const games = Array.isArray(filter?.games) ? filter.games.filter(isGameId) : [];
      if (games.length) salonFilters.set(socket.id, games);
      else salonFilters.delete(socket.id);
      socket.join(SALON);
      sendSalon(socket);
    });
    socket.on('disconnect', () => {
      wrongPasswords.delete(socket.id);
      leave(socket);
      protocols.delete(socket.id);
      salonFilters.delete(socket.id);
      sayLimiter.forget(socket.id);
      voiceIds.delete(socket.id);
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
