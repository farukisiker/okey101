import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import {
  ERR_UPDATE_APP,
  type ClientToServerEvents,
  type GameViewEnvelope,
  type KahveClientToServerEvents,
  type KahveServerToClientEvents,
  type PlayerView,
  type RoomInfo,
  type ServerToClientEvents,
  type TableSummary,
} from '@okey/shared';
import { createOkeyServer, type OkeyServer } from '../src/server';

/*
 * Contract tests for the v2 (Demli Kahve) client. Written in A3 as `it.fails` against the
 * v1-only server; A4 made the server answer v2 sockets with the envelope, `game` in
 * RoomInfo/TableSummary, the salon filter and ERR_UPDATE_APP for a v1 client asking for a
 * non-okey table, so they are plain `it` now (bodies unchanged).
 * Every wait is capped well under the 2 s per-test budget so a missing answer fails the
 * body instead of hanging the file.
 */

type V1Client = Socket<ServerToClientEvents, ClientToServerEvents>;
type V2Client = Socket<KahveServerToClientEvents, KahveClientToServerEvents>;

const WAIT_MS = 1500;
let server: OkeyServer;
let url: string;
const sockets: (V1Client | V2Client)[] = [];

beforeAll(async () => {
  server = createOkeyServer({ botDelayMs: 1, turnTimeoutMs: 0 });
  url = `http://localhost:${await server.listen(0)}`;
});
afterEach(() => {
  while (sockets.length) sockets.pop()!.close();
});
afterAll(() => server.close());

/** v2 client: sends `auth: { v: 2 }`, exactly what app/src/net will do after A4. */
function v2(): V2Client {
  const s = connect(url, { transports: ['websocket'], forceNew: true, auth: { v: 2 } });
  sockets.push(s);
  return s;
}
/** v1 client: 1.0.1, no handshake.auth. */
function v1(): V1Client {
  const s = connect(url, { transports: ['websocket'], forceNew: true });
  sockets.push(s);
  return s;
}

type EventName = 'game:view' | 'room:state' | 'salon:list';

function waitFor<T>(sock: V1Client | V2Client, event: EventName, pred: (v: T) => boolean): Promise<T> {
  return new Promise((resolve) => {
    const h = (v: T) => {
      if (pred(v)) {
        (sock as V1Client).off(event, h as never); // the event maps differ since E2 (table:said); these names exist in both
        resolve(v);
      }
    };
    (sock as V1Client).on(event, h as never);
  });
}

/** Rejects after `ms`, so a missing server answer is a clean failure rather than a hung test. */
async function within<T>(p: Promise<T>, ms = WAIT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`no answer in ${ms} ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

describe('compat v2 (Demli Kahve client)', () => {
  it(
    'v2 quickPlay gets the { game, view } envelope on game:view',
    async () => {
      const c = v2();
      const first = waitFor<PlayerView | GameViewEnvelope>(c, 'game:view', () => true);
      const ack = await within(c.emitWithAck('room:quickPlay', { name: 'Ali', game: 'okey101' }));
      expect(ack).toMatchObject({ ok: true });

      const payload = await within(first);
      expect(payload).toMatchObject({ game: 'okey101' });
      const env = payload as GameViewEnvelope<PlayerView>;
      expect(env.view.mode).toBe('101');
      expect(env.view.hand).toHaveLength(22);
    },
    2000,
  );

  it(
    'v1 socket asking for a pisti table is told to update the app',
    async () => {
      const c = v1();
      const ack = await within(c.emitWithAck('room:create', { name: 'Ali', game: 'pisti' }));
      expect(ack).toEqual({ ok: false, error: ERR_UPDATE_APP });
    },
    2000,
  );

  it(
    'v2 salon:watch filter lists tables with game filled in',
    async () => {
      const host = v1();
      const created = await within(host.emitWithAck('room:create', { name: 'Host', isPublic: true }));
      if (!created.ok) throw new Error(created.error);

      const c = v2();
      const listed = waitFor<TableSummary[]>(c, 'salon:list', (l) => l.some((t) => t.id === created.roomId));
      c.emit('salon:watch', true, { games: ['okey101', 'pisti'] });
      const list = await within(listed);

      expect(list.length).toBeGreaterThan(0);
      for (const t of list) expect(t.game).toBeDefined();
      expect(list.find((t) => t.id === created.roomId)?.game).toBe('okey101');
    },
    2000,
  );

  it(
    'v2 RoomInfo.game is okey101 for a 101 table',
    async () => {
      const c = v2();
      const state = waitFor<RoomInfo>(c, 'room:state', (r) => r.started);
      const ack = await within(c.emitWithAck('room:quickPlay', { name: 'Ali', game: 'okey101' }));
      expect(ack).toMatchObject({ ok: true });

      const room = await within(state);
      expect(room.game).toBe('okey101');
      expect(room.mode).toBe('101');
    },
    2000,
  );

  it(
    'v2 RoomInfo.game is okeyDuz for a düz table',
    async () => {
      const c = v2();
      const state = waitFor<RoomInfo>(c, 'room:state', (r) => r.started);
      const ack = await within(c.emitWithAck('room:quickPlay', { name: 'Ali', game: 'okeyDuz' }));
      expect(ack).toMatchObject({ ok: true });

      const room = await within(state);
      expect(room.game).toBe('okeyDuz');
      expect(room.mode).toBe('duz');
      c.emit('room:leave');
    },
    2000,
  );

  it(
    'E2: v2 RoomInfo carries voice and the seat accountId',
    async () => {
      const c = v2();
      const state = waitFor<RoomInfo>(c, 'room:state', () => true);
      const ack = await within(c.emitWithAck('room:create', { name: 'Ali', game: 'okey101', accountId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' }));
      expect(ack).toMatchObject({ ok: true });
      const room = await within(state);
      expect(room.voice).toBe(true);
      expect(room.seats[0]?.accountId).toBe('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
    },
    2000,
  );
});
