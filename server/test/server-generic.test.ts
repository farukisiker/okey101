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
import { createOkeyServer, type OkeyServer } from '../src/server';
import { Room } from '../src/room';
import { stubDef, type StubView } from './stub-game';

/*
 * A4: the server with a non-okey table. No such game is playable in phase A, so the stub
 * definition (id 'pisti') is put into server.rooms directly; everything else goes over sockets.
 */

type V1Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type V2Client = Socket<KahveServerToClientEvents, KahveClientToServerEvents>;

const WAIT_MS = 1500;
let server: OkeyServer;
let url: string;
const sockets: (V1Client | V2Client)[] = [];

beforeAll(async () => {
  server = createOkeyServer({ botDelayMs: 1000, turnTimeoutMs: 0, seed: 1 });
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
    const timer = setTimeout(() => reject(new Error(`no ${event} in ${WAIT_MS} ms`)), WAIT_MS);
    const h = (v: T) => {
      if (!pred(v)) return;
      clearTimeout(timer);
      sock.off(event, h as never);
      resolve(v);
    };
    sock.on(event, h as never);
  });
}

/** A public, not started stub ('pisti') table with a (fake) person at it, so the salon lists it. */
function stubTable(id: string) {
  const room = new Room(id, () => {}, { definition: stubDef, isPublic: true, options: { seats: 4 }, turnTimeoutMs: 0, seed: 3 });
  room.join('Pişti Ustası', `fake-${id}`);
  server.rooms.set(id, room);
  return room;
}

describe('server with a non-okey table', () => {
  it('a v1 salon watcher never sees a non-okey table, and gets no `game` field', async () => {
    stubTable('PST01');
    const host = v1();
    const created = await host.emitWithAck('room:create', { name: 'Host', isPublic: true });
    if (!created.ok) throw new Error(created.error);

    const w = v1();
    const listed = next<TableSummary[]>(w, 'salon:list', (l) => l.some((t) => t.id === created.roomId));
    w.emit('salon:watch', true);
    const list = await listed;
    expect(list.map((t) => t.id)).not.toContain('PST01');
    for (const t of list) expect(t).not.toHaveProperty('game');

    // A v2 watcher without a filter sees okey only too; with a filter it sees the stub table.
    const plain = v2();
    const plainList = next<TableSummary[]>(plain, 'salon:list');
    plain.emit('salon:watch', true);
    expect((await plainList).map((t) => t.id)).not.toContain('PST01');

    const kagit = v2();
    const kagitList = next<TableSummary[]>(kagit, 'salon:list');
    kagit.emit('salon:watch', true, { games: ['pisti'] });
    const only = await kagitList;
    expect(only.map((t) => [t.id, t.game])).toEqual([['PST01', 'pisti']]);
  });

  it('a v1 app is told to update instead of sitting at a non-okey table', async () => {
    stubTable('PST02');
    const c = v1();
    expect(await c.emitWithAck('room:join', { roomId: 'pst02', name: 'Ali' })).toEqual({ ok: false, error: ERR_UPDATE_APP });
    expect(await c.emitWithAck('room:quickPlay', { name: 'Ali', game: 'batak' })).toEqual({ ok: false, error: ERR_UPDATE_APP });
  });

  it('v2: unknown, "Yakında" and mismatched games get short Turkish errors', async () => {
    stubTable('PST03');
    const c = v2();
    expect(await c.emitWithAck('room:create', { name: 'Ali', game: 'satranc' as never })).toEqual({ ok: false, error: 'Bilinmeyen oyun' });
    expect(await c.emitWithAck('room:quickPlay', { name: 'Ali', game: 'king' })).toEqual({ ok: false, error: 'Bu oyun yakında geliyor' });
    expect(await c.emitWithAck('room:join', { roomId: 'PST03', name: 'Ali', game: 'okey101' })).toEqual({
      ok: false,
      error: 'Bu masa başka bir oyun',
    });
  });

  it('v2 sits at the stub table: RoomInfo.game, { game, view } envelope, isAction before apply', async () => {
    stubTable('PST04');
    const c = v2();
    const state = next<RoomInfo>(c, 'room:state');
    const joined = await c.emitWithAck('room:join', { roomId: 'PST04', name: 'Ali', game: 'pisti' });
    expect(joined).toEqual({ ok: true, roomId: 'PST04', seat: 1 });
    const info = await state;
    expect(info.game).toBe('pisti');
    expect(info.seats).toHaveLength(4);

    const view = next<GameViewEnvelope<StubView>>(c, 'game:view');
    server.rooms.get('PST04')!.start();
    // The room was built with a no-op listener, so ask the server to push by re-joining (reconnect path).
    const again = await c.emitWithAck('room:join', { roomId: 'PST04', name: 'Ali', game: 'pisti' });
    expect(again).toMatchObject({ ok: true, seat: 1 });
    const env = await view;
    expect(env.game).toBe('pisti');
    expect(env.view).toMatchObject({ seat: 1, sum: expect.any(Number) });

    expect(await c.emitWithAck('game:action', { type: 'draw', source: 'deck' })).toEqual({ ok: false, error: 'Geçersiz hamle' });
    expect(await c.emitWithAck('game:action', { type: 'add', n: 1 })).toEqual({ ok: false, error: 'Sıra sizde değil' });
  });

  it('v1 game:action with a malformed okey action is refused, not crashed on', async () => {
    const c = v1();
    const ack = await c.emitWithAck('room:quickPlay', { name: 'Ali' });
    expect(ack).toMatchObject({ ok: true });
    expect(await c.emitWithAck('game:action', { type: 'discard', tileId: 'x' } as never)).toEqual({ ok: false, error: 'Geçersiz hamle' });
  });
});
