// B5: real pişti and batak tables end to end over sockets (create -> join -> start -> play -> totals -> next round),
// partner totals, and old (v1) apps kept away from it.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import {
  ERR_UPDATE_APP,
  type ClientToServerEvents,
  type GameViewEnvelope,
  type KahveClientToServerEvents,
  type KahveServerToClientEvents,
  type RoomInfo,
  type ServerToClientEvents,
  type TableSummary,
} from '@okey/shared';
import type { BatakView, PistiView } from '@kahve/catalog';
import { createOkeyServer, type OkeyServer } from '../src/server';

type V1Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type V2Client = Socket<KahveServerToClientEvents, KahveClientToServerEvents>;
type PistiEnvelope = GameViewEnvelope<PistiView & { turnMsLeft?: number | null }>;

const WAIT_MS = 8000;
let server: OkeyServer;
let url: string;
const sockets: (V1Client | V2Client)[] = [];

beforeAll(async () => {
  server = createOkeyServer({ botDelayMs: 5, turnTimeoutMs: 0, seed: 7 });
  url = `http://localhost:${await server.listen(0)}`;
});
afterEach(() => {
  while (sockets.length) sockets.pop()!.close();
});
afterAll(() => server.close());

function v2(): V2Client {
  const s = connect(url, { transports: ['websocket'], forceNew: true, auth: { v: 2 } });
  sockets.push(s);
  return s;
}
function v1(): V1Client {
  const s = connect(url, { transports: ['websocket'], forceNew: true });
  sockets.push(s);
  return s;
}

function next<T>(sock: V1Client | V2Client, event: 'game:view' | 'room:state' | 'salon:list', pred: (v: T) => boolean = () => true) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no matching ${event} in ${WAIT_MS} ms`)), WAIT_MS);
    const h = (v: T) => {
      if (!pred(v)) return;
      clearTimeout(timer);
      (sock as V1Client).off(event, h as never); // the event maps differ since E2 (table:said); these names exist in both
      resolve(v);
    };
    (sock as V1Client).on(event, h as never);
  });
}

/** Keeps the latest room:state (it arrives just before the views of the same change). */
function track(sock: V2Client) {
  const last: { room: RoomInfo | null } = { room: null };
  sock.on('room:state', (r) => (last.room = r));
  return last;
}

/** Plays the first playable card whenever it is this socket's turn; returns every view it got. */
function autoplay(sock: V2Client) {
  const views: PistiEnvelope[] = [];
  sock.on('game:view', (p) => {
    const env = p as PistiEnvelope;
    views.push(env);
    const v = env.view;
    if (env.game === 'pisti' && v.phase === 'playing' && v.turn === v.seat && v.playableCardIds.length) {
      sock.emit('game:action', { type: 'play', cardId: v.playableCardIds[0] }, () => {});
    }
  });
  return views;
}

const finished = (round: number) => (p: unknown) => {
  const env = p as PistiEnvelope;
  return env.game === 'pisti' && env.view.phase === 'finished' && env.view.round === round;
};

describe('card tables over the server', () => {
  it('two people: create -> join -> start -> a whole hand -> totals -> next hand', async () => {
    const host = v2();
    const guest = v2();
    const hostViews = autoplay(host);
    autoplay(guest);
    const hostRoom = track(host);
    const hostDone = next<PistiEnvelope>(host, 'game:view', finished(0));
    const guestDone = next<PistiEnvelope>(guest, 'game:view', finished(0));
    const created = await host.emitWithAck('room:create', { name: 'Ali', game: 'pisti', options: { seats: 2 } });
    if (!created.ok) throw new Error(created.error);
    // room:state comes before the ack.
    const info = hostRoom.room!;
    expect(info).toMatchObject({ game: 'pisti', started: false });
    expect(info.seats).toHaveLength(2);

    const joined = await guest.emitWithAck('room:join', { roomId: created.roomId, name: 'Veli', game: 'pisti' });
    expect(joined).toEqual({ ok: true, roomId: created.roomId, seat: 1 });

    // Both seats are people: the table starts by itself once full; the host's start is then refused.
    const start = await host.emitWithAck('room:start');
    expect(start.ok === true || (!start.ok && start.error === 'Oyun zaten başladı')).toBe(true);

    const [h, g] = await Promise.all([hostDone, guestDone]);
    const room = hostRoom.room!;
    expect(h.view.result!.scores).toEqual(g.view.result!.scores);
    expect(room.totals).toEqual(h.view.result!.scores);
    expect(room.round).toBe(1);
    // Views never show the other hand, and carry the host's turnMsLeft (null: this table has no clock).
    for (const env of hostViews) {
      expect(env.view.seat).toBe(0);
      expect(env.view).toHaveProperty('turnMsLeft', null);
    }

    const second = next<PistiEnvelope>(host, 'game:view', (p) => (p as PistiEnvelope).view.round === 1);
    expect(await guest.emitWithAck('room:nextRound')).toEqual({ ok: true });
    expect((await second).view.phase).toBe('playing');
    host.emit('room:leave');
    guest.emit('room:leave');
  });

  it('four seats, partners, one person and three bots: totals come as [A, B, A, B]', async () => {
    const me = v2();
    autoplay(me);
    const last = track(me);
    const done = next<PistiEnvelope>(me, 'game:view', finished(0));
    const res = await me.emitWithAck('room:quickPlay', { name: 'Ayşe', game: 'pisti', options: { seats: 4, partnerMode: true } });
    if (!res.ok) throw new Error(res.error);
    const env = await done;
    expect(env.view.options).toMatchObject({ seats: 4, partnerMode: true });
    expect(env.view.players.map((p) => p.team)).toEqual([0, 1, 0, 1]);
    const [a, b, a2, b2] = env.view.result!.scores;
    expect([a2, b2]).toEqual([a, b]);
    const room = last.room!;
    expect(room.round).toBe(1);
    expect(room.totals).toEqual([a, b, a, b]);
    expect(room.seats.filter((s) => s?.isBot)).toHaveLength(3);
    me.emit('room:leave');
  });

  it('an old (v1) app never sees a pişti table in the salon and cannot sit at one', async () => {
    const host = v2();
    const created = await host.emitWithAck('room:create', { name: 'Can', game: 'pisti', isPublic: true });
    if (!created.ok) throw new Error(created.error);

    const kagit = v2();
    const listed = next<TableSummary[]>(kagit, 'salon:list', (l) => l.some((t) => t.id === created.roomId));
    kagit.emit('salon:watch', true, { games: ['pisti'] });
    expect((await listed).find((t) => t.id === created.roomId)).toMatchObject({ game: 'pisti', free: 1 });

    const old = v1();
    const oldList = next<TableSummary[]>(old, 'salon:list');
    old.emit('salon:watch', true);
    expect((await oldList).map((t) => t.id)).not.toContain(created.roomId);
    expect(await old.emitWithAck('room:join', { roomId: created.roomId, name: 'Eski' })).toEqual({ ok: false, error: ERR_UPDATE_APP });
    host.emit('room:leave');
  });

  it('batak: one person and three bots fill a four-seat table; bid, trump, 13 tricks, totals, next hand', async () => {
    type BatakEnvelope = GameViewEnvelope<BatakView & { turnMsLeft?: number | null }>;
    const me = v2();
    const last = track(me);
    const seen: BatakEnvelope[] = [];
    // The person passes in the auction; if the table forces the contract on them they pick spades; then the first legal card.
    me.on('game:view', (p) => {
      const env = p as BatakEnvelope;
      if (env.game !== 'batak') return;
      seen.push(env);
      const v = env.view;
      if (v.turn !== v.seat) return;
      if (v.phase === 'bidding') me.emit('game:action', { type: 'pass' }, () => {});
      else if (v.phase === 'selectingTrump') me.emit('game:action', { type: 'selectTrump', suit: 'S' }, () => {});
      else if (v.phase === 'playing' && v.legalCardIds.length) me.emit('game:action', { type: 'play', cardId: v.legalCardIds[0] }, () => {});
    });
    const done = next<BatakEnvelope>(me, 'game:view', (p) => {
      const env = p as BatakEnvelope;
      return env.game === 'batak' && env.view.phase === 'finished' && env.view.round === 0;
    });
    const res = await me.emitWithAck('room:quickPlay', { name: 'Ayşe', game: 'batak' });
    if (!res.ok) throw new Error(res.error);
    const env = await done;
    const room = last.room!;
    expect(room).toMatchObject({ game: 'batak', started: true, round: 1 });
    expect(room.seats).toHaveLength(4);
    expect(room.seats.filter((s) => s?.isBot)).toHaveLength(3);
    expect(env.view.tricks).toHaveLength(13);
    expect(env.view.players.reduce((n, p) => n + p.tricksWon, 0)).toBe(13);
    expect(room.totals).toEqual(env.view.result!.scores);
    expect(seen.some((e) => e.view.phase === 'bidding')).toBe(true);
    for (const e of seen) {
      expect(e.view.seat).toBe(res.seat);
      expect(e.view).toHaveProperty('turnMsLeft', null);
    }
    const second = next<BatakEnvelope>(me, 'game:view', (p) => (p as BatakEnvelope).view.round === 1);
    expect(await me.emitWithAck('room:nextRound')).toEqual({ ok: true });
    expect((await second).view.phase).toBe('bidding');
    me.emit('room:leave');
  });
});
