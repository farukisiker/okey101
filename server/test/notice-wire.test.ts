// A7: the new fields reach v2 sockets only; v1 (Demli Okey 1.0.1) payloads keep their old shape.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  GameViewEnvelope,
  KahveClientToServerEvents,
  KahveServerToClientEvents,
  PlayerView,
  RoomInfo,
  ServerToClientEvents,
} from '@okey/shared';
import { createOkeyServer, type OkeyServer } from '../src/server';

type V1Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type V2Client = Socket<KahveServerToClientEvents, KahveClientToServerEvents>;

const WAIT_MS = 1500;
let server: OkeyServer;
let url: string;
const sockets: (V1Client | V2Client)[] = [];

beforeAll(async () => {
  server = createOkeyServer({ botDelayMs: 60_000, turnTimeoutMs: 0 });
  url = `http://localhost:${await server.listen(0)}`;
});
afterEach(() => {
  while (sockets.length) sockets.pop()!.close();
});
afterAll(() => server.close());

function open<T extends V1Client | V2Client>(v2: boolean): T {
  const s = connect(url, { transports: ['websocket'], forceNew: true, ...(v2 && { auth: { v: 2 } }) }) as T;
  sockets.push(s);
  return s;
}

function first<T>(sock: V1Client | V2Client, event: 'game:view' | 'room:state', pred: (v: T) => boolean = () => true): Promise<T> {
  return new Promise((resolve, reject) => {
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

describe('A7 fields on the wire', () => {
  it(
    'v2: room:state has matchOver, the view has notice and islek',
    async () => {
      const c = open<V2Client>(true);
      const state = first<RoomInfo>(c, 'room:state', (r) => r.started);
      const view = first<GameViewEnvelope<PlayerView>>(c, 'game:view');
      const ack = await c.emitWithAck('room:quickPlay', { name: 'Ali', game: 'okey101', options: { islek: 'all' } });
      expect(ack).toMatchObject({ ok: true });
      expect((await state).matchOver).toBe(false);
      const v = (await view).view;
      expect(v.notice).toBeNull();
      expect(v.islek).toBe('all');
    },
    2000,
  );

  it(
    'v1: no matchOver in room:state, no notice/islek in the view',
    async () => {
      const c = open<V1Client>(false);
      const state = first<RoomInfo>(c, 'room:state', (r) => r.started);
      const view = first<PlayerView>(c, 'game:view');
      const ack = await c.emitWithAck('room:quickPlay', { name: 'Veli' });
      expect(ack).toMatchObject({ ok: true });
      const info = await state;
      expect('matchOver' in info).toBe(false);
      expect('game' in info).toBe(false);
      const v = await view;
      expect(v.hand.length).toBeGreaterThan(0);
      for (const k of ['notice', 'islek', 'noticeMsLeft']) expect(k in v).toBe(false);
    },
    2000,
  );
});
