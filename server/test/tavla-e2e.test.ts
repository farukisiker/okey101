// C3: real tavla tables end to end over sockets: create -> join -> (starts when full) -> whole games -> totals ->
// next game -> match end at targetScore -> a new match. The dice live only in the server's state: no view or
// room:state a client receives ever carries `rngState`. Old (v1) apps never see or sit at a tavla table.
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
import type { TavlaAction, TavlaView } from '@kahve/catalog';
import { createOkeyServer, type OkeyServer } from '../src/server';

type V1Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type V2Client = Socket<KahveServerToClientEvents, KahveClientToServerEvents>;
type TavlaEnvelope = GameViewEnvelope<TavlaView & { turnMsLeft?: number | null }>;

const WAIT_MS = 20_000;
let server: OkeyServer;
let url: string;
const sockets: (V1Client | V2Client)[] = [];

beforeAll(async () => {
  server = createOkeyServer({ botDelayMs: 2, turnTimeoutMs: 0, seed: 11 });
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

/** Every payload a socket got, raw, for the rngState check; plus the latest room:state. */
function record(sock: V2Client) {
  const rec = { room: null as RoomInfo | null, raw: [] as string[], views: [] as TavlaEnvelope[] };
  sock.on('room:state', (r) => {
    rec.room = r;
    rec.raw.push(JSON.stringify(r));
  });
  sock.on('game:view', (p) => {
    rec.raw.push(JSON.stringify(p));
    rec.views.push(p as TavlaEnvelope);
  });
  return rec;
}

/** On this socket's turn: the first offered single step, else commit (Tamam, or Pas when nothing can move). */
function autoplay(sock: V2Client) {
  sock.on('game:view', (p) => {
    const env = p as TavlaEnvelope;
    const v = env.view;
    if (env.game !== 'tavla' || v.phase !== 'playing' || v.turn !== v.seat) return;
    let action: TavlaAction | null = null;
    if (v.canCommit || v.mustPass) action = { type: 'commit' };
    else {
      const m = v.moves.find((x) => x.dice.length === 1) ?? v.moves[0];
      if (m) action = { type: 'step', from: m.from, die: m.dice[0] };
    }
    if (action) sock.emit('game:action', action, () => {});
  });
}

const finished = (round: number) => (p: unknown) => {
  const env = p as TavlaEnvelope;
  return env.game === 'tavla' && env.view.phase === 'finished' && env.view.round === round;
};

describe('tavla tables over the server', () => {
  it('two people: create -> join -> starts when full -> games -> nextRound -> match end at targetScore -> new match', async () => {
    const host = v2();
    const guest = v2();
    const hostRec = record(host);
    const guestRec = record(guest);
    autoplay(host);
    autoplay(guest);

    const created = await host.emitWithAck('room:create', { name: 'Ali', game: 'tavla', options: { targetScore: 3, seats: 4 } });
    if (!created.ok) throw new Error(created.error);
    expect(hostRec.room).toMatchObject({ game: 'tavla', started: false });
    expect(hostRec.room!.seats).toHaveLength(2);

    let done = next<TavlaEnvelope>(host, 'game:view', finished(0));
    const joined = await guest.emitWithAck('room:join', { roomId: created.roomId, name: 'Veli', game: 'tavla' });
    expect(joined).toEqual({ ok: true, roomId: created.roomId, seat: 1 });

    let games = 0;
    let totals = [0, 0];
    let before = totals;
    for (;;) {
      const env = await done;
      games++;
      const room = hostRec.room!;
      const r = env.view.result!;
      expect(env.view.options).toEqual({ variant: 'klasik', targetScore: 3, koncinaPoints: 3 });
      expect([1, 2, 3]).toContain(r.points);
      expect(env.view.board.off[r.winner]).toBe(15);
      before = totals;
      totals = totals.map((t, seat) => t + (seat === r.winner ? r.points : 0));
      expect(room.totals).toEqual(totals);
      expect(room.round).toBe(games);
      if (room.matchOver) break;
      expect(games).toBeLessThan(10);
      done = next<TavlaEnvelope>(host, 'game:view', finished(games));
      expect(await guest.emitWithAck('room:nextRound')).toEqual({ ok: true });
    }
    expect(Math.max(...totals)).toBeGreaterThanOrEqual(3);
    // The match ended with the game that crossed the target, not before.
    expect(Math.max(...before)).toBeLessThan(3);

    // A finished match: the next game starts a new match from 0 - 0.
    const fresh = next<RoomInfo>(host, 'room:state', (r) => r.round === games + 1);
    expect(await host.emitWithAck('room:nextRound')).toEqual({ ok: true });
    const r2 = await fresh;
    expect(r2.totals).toEqual([0, 0]);
    expect(r2.matchOver).toBe(false);

    // Both players saw both seats' turns; nobody ever got the dice generator.
    expect(hostRec.views.length).toBeGreaterThan(50);
    for (const rec of [hostRec, guestRec]) {
      for (const raw of rec.raw) expect(raw).not.toContain('rngState');
      for (const env of rec.views) {
        expect(env.game).toBe('tavla');
        expect(env.view).not.toHaveProperty('rngState');
        expect(env.view).toHaveProperty('turnMsLeft');
      }
    }
    expect(hostRec.views.every((e) => e.view.seat === 0)).toBe(true);
    expect(guestRec.views.every((e) => e.view.seat === 1)).toBe(true);
    // The server's state does hold it.
    const live = server.rooms.get(created.roomId)!;
    expect(typeof (live.game as { rngState?: unknown }).rngState).toBe('number');
    host.emit('room:leave');
    guest.emit('room:leave');
  });

  it('one person against a bot: the bot plays its steps and commits; a whole game and totals', async () => {
    const me = v2();
    const rec = record(me);
    autoplay(me);
    const done = next<TavlaEnvelope>(me, 'game:view', finished(0));
    const res = await me.emitWithAck('room:quickPlay', { name: 'Ayşe', game: 'tavla', options: { targetScore: 1 } });
    if (!res.ok) throw new Error(res.error);
    const env = await done;
    const room = rec.room!;
    expect(room).toMatchObject({ game: 'tavla', started: true, round: 1, matchOver: true });
    expect(room.seats.filter((s) => s?.isBot)).toHaveLength(1);
    expect(room.totals[env.view.result!.winner]).toBe(env.view.result!.points);
    // The bot's turns arrive as finished turn records with real steps.
    const botSeat = 1 - res.seat;
    expect(rec.views.some((e) => e.view.lastTurn?.seat === botSeat && e.view.lastTurn.steps.length > 0)).toBe(true);
    for (const raw of rec.raw) expect(raw).not.toContain('rngState');
    me.emit('room:leave');
  });

  it('an old (v1) app never sees a tavla table, cannot create or sit at one; card-game watchers do not see it either', async () => {
    const host = v2();
    const created = await host.emitWithAck('room:create', { name: 'Can', game: 'tavla', isPublic: true });
    if (!created.ok) throw new Error(created.error);

    const tavla = v2();
    const listed = next<TableSummary[]>(tavla, 'salon:list', (l) => l.some((t) => t.id === created.roomId));
    tavla.emit('salon:watch', true, { games: ['tavla'] });
    expect((await listed).find((t) => t.id === created.roomId)).toMatchObject({ game: 'tavla', free: 1 });

    const kagit = v2();
    const kagitList = next<TableSummary[]>(kagit, 'salon:list');
    kagit.emit('salon:watch', true, { games: ['pisti', 'batak'] });
    expect((await kagitList).map((t) => t.id)).not.toContain(created.roomId);

    const old = v1();
    const oldList = next<TableSummary[]>(old, 'salon:list');
    old.emit('salon:watch', true);
    expect((await oldList).map((t) => t.id)).not.toContain(created.roomId);
    expect(await old.emitWithAck('room:join', { roomId: created.roomId, name: 'Eski' })).toEqual({ ok: false, error: ERR_UPDATE_APP });
    expect(await (old as unknown as V2Client).emitWithAck('room:create', { name: 'Eski', game: 'tavla' })).toEqual({ ok: false, error: ERR_UPDATE_APP });
    host.emit('room:leave');
  });
});
