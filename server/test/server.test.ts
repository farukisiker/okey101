import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, PlayerView, RoomInfo, ServerToClientEvents } from '@okey/shared';
import { createOkeyServer, type OkeyServer } from '../src/server';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
let server: OkeyServer;
let url: string;

beforeAll(async () => {
  server = createOkeyServer({ botDelayMs: 5, turnTimeoutMs: 0 });
  url = `http://localhost:${await server.listen(0)}`;
});
afterAll(() => server.close());

function client(): Client {
  return connect(url, { transports: ['websocket'], forceNew: true });
}
function waitFor<T>(sock: Client, event: 'game:view' | 'room:state', pred: (v: T) => boolean): Promise<T> {
  return new Promise((resolve) => {
    const h = (v: T) => {
      if (pred(v)) {
        sock.off(event, h as never);
        resolve(v);
      }
    };
    sock.on(event, h as never);
  });
}

describe('socket server', () => {
  it('quick play: seats bots, deals and plays bot turns until the human moves', async () => {
    const c = client();
    const first = waitFor<PlayerView>(c, 'game:view', () => true);
    const ack = await c.emitWithAck('room:quickPlay', { name: 'Ali' });
    expect(ack.ok).toBe(true);
    const view = await first;
    expect(view.hand).toHaveLength(22); // round 1: seat 0 starts
    expect(view.players.map((p) => p.handCount)).toEqual([22, 21, 21, 21]);

    const bad = await c.emitWithAck('game:action', { type: 'draw', source: 'deck' });
    expect(bad).toEqual({ ok: false, error: expect.stringMatching(/çektiniz/) });

    const back = waitFor<PlayerView>(c, 'game:view', (v) => v.turn === 0 && v.turnPhase === 'draw');
    expect(await c.emitWithAck('game:action', { type: 'discard', tileId: view.hand[0].id })).toEqual({ ok: true });
    const v2 = await back;
    expect(v2.lastAction).toMatchObject({ seat: 3, type: 'discard' });
    expect(v2.hand).toHaveLength(21);
    c.close();
  });

  it('two humans join the same room, host starts, each sees only own hand', async () => {
    const a = client();
    const b = client();
    const created = await a.emitWithAck('room:create', { name: 'A' });
    if (!created.ok) throw new Error(created.error);
    const joined = await b.emitWithAck('room:join', { roomId: created.roomId.toLowerCase(), name: 'B' });
    expect(joined).toMatchObject({ ok: true, seat: 1 });
    expect(await b.emitWithAck('room:start')).toMatchObject({ ok: false });
    const rs = waitFor<RoomInfo>(b, 'room:state', (r) => r.started);
    const va = waitFor<PlayerView>(a, 'game:view', () => true);
    const vb = waitFor<PlayerView>(b, 'game:view', () => true);
    expect(await a.emitWithAck('room:start')).toEqual({ ok: true });
    expect((await rs).seats.map((s) => s?.isBot)).toEqual([false, false, true, true]);
    const [viewA, viewB] = await Promise.all([va, vb]);
    const idsA = new Set(viewA.hand.map((t) => t.id));
    expect(viewB.hand.some((t) => idsA.has(t.id))).toBe(false);
    a.close();
    b.close();
  });

  it('rejects unknown rooms', async () => {
    const c = client();
    expect(await c.emitWithAck('room:join', { roomId: 'NOPE1', name: 'X' })).toMatchObject({ ok: false });
    c.close();
  });
});
