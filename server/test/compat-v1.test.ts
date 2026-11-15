import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import type {
  Action,
  ClientToServerEvents,
  GameMode,
  PlayerView,
  RoomInfo,
  ServerToClientEvents,
  TableSummary,
} from '@okey/shared';
import { createOkeyServer, type OkeyServer } from '../src/server';

/*
 * Compatibility tests for the client that is already in the stores (Demli Okey 1.0.1,
 * c19eea2:app/src/net/useOkey.ts). They must stay green on today's server and on the
 * v2 server A4 builds: a v1 socket sends no handshake.auth, no `game`, and gets the
 * bare okey PlayerView plus `mode` in RoomInfo/TableSummary.
 */

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let server: OkeyServer;
let url: string;

beforeAll(async () => {
  server = createOkeyServer({ botDelayMs: 1, turnTimeoutMs: 0 });
  url = `http://localhost:${await server.listen(0)}`;
});
afterAll(() => server.close());

/** A v1.0.1 socket: websocket only and no `auth` payload, exactly like useOkey. */
function client(): Client {
  return connect(url, { transports: ['websocket'], forceNew: true });
}

const EVENTS = ['game:view', 'room:state', 'salon:list'] as const;
type EventName = (typeof EVENTS)[number];

function waitFor<T>(sock: Client, event: EventName, pred: (v: T) => boolean): Promise<T> {
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

/** Rejects instead of hanging forever; used to keep a broken hand from hitting the vitest timeout. */
async function within<T>(p: Promise<T>, ms: number): Promise<T> {
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

/**
 * Buffers 'game:view' payloads and hands them out one by one, so a view that arrived
 * before we started waiting for it is not lost (the server emits the view before the ack).
 */
class ViewFeed {
  private readonly buffer: PlayerView[] = [];
  private readonly waiters: { pred: (v: PlayerView) => boolean; resolve: (v: PlayerView) => void }[] = [];
  private readonly handler = (v: PlayerView) => {
    const i = this.waiters.findIndex((w) => w.pred(v));
    if (i < 0) return void this.buffer.push(v);
    const [w] = this.waiters.splice(i, 1);
    w.resolve(v);
  };

  constructor(private readonly sock: Client) {
    sock.on('game:view', this.handler);
  }

  next(pred: (v: PlayerView) => boolean = () => true): Promise<PlayerView> {
    const i = this.buffer.findIndex(pred);
    if (i >= 0) return Promise.resolve(this.buffer.splice(i, 1)[0]);
    return new Promise((resolve) => this.waiters.push({ pred, resolve }));
  }

  dispose() {
    this.sock.off('game:view', this.handler);
    this.waiters.length = 0;
  }
}

/** The simplest possible v1 client: draw from the middle on 'draw', throw any legal tile on 'play'. */
function actionFor(view: PlayerView): Action {
  if (view.turnPhase === 'draw') return { type: 'draw', source: 'deck' };
  const tile = view.hand.find((t) => t.id !== view.mustUseTileId);
  if (!tile) throw new Error('no tile left to discard');
  return { type: 'discard', tileId: tile.id };
}

/** Plays every human turn until the hand is over (bots move on their own, botDelayMs = 1). */
async function playHand(sock: Client, feed: ViewFeed, seat: number): Promise<PlayerView> {
  for (;;) {
    const view = await feed.next((v) => v.phase === 'finished' || (v.phase === 'playing' && v.turn === seat));
    if (view.phase === 'finished') return view;
    const ack = await sock.emitWithAck('game:action', actionFor(view));
    if (!ack.ok) throw new Error(ack.error);
  }
}

interface FixtureStep {
  event: keyof ClientToServerEvents;
  payload?: unknown;
  expectAck?: { ok: boolean; error?: string };
}
interface Fixture {
  source: string;
  steps: FixtureStep[];
}

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/v1/messages.json', import.meta.url), 'utf8'),
) as Fixture;

interface LooseAck {
  ok?: boolean;
  error?: string;
  roomId?: string;
}

/** Loosely typed ack sender for an event name that only the fixture knows. */
function emitWithAck(sock: Client, event: string, payload: unknown): Promise<LooseAck> {
  const loose = sock as unknown as { emitWithAck: (e: string, ...args: unknown[]) => Promise<LooseAck> };
  return payload === undefined ? loose.emitWithAck(event) : loose.emitWithAck(event, payload);
}

/** The fixture's runtime values: only `$roomId` is filled in from the create ack. */
function resolvePayload(payload: unknown, roomId: string): unknown {
  if (payload === undefined) return undefined;
  return JSON.parse(JSON.stringify(payload).replace('"$roomId"', JSON.stringify(roomId)));
}

describe('compat v1 (store client 1.0.1)', () => {
  it('quick play without auth and without mode deals 101 as a bare PlayerView', async () => {
    const c = client();
    expect(c.auth ?? {}).toEqual({}); // v1.0.1 sends no handshake.auth: the server must treat it as protocol 1
    const first = waitFor<PlayerView>(c, 'game:view', () => true);
    const room = waitFor<RoomInfo>(c, 'room:state', (r) => r.started);
    expect(await c.emitWithAck('room:quickPlay', { name: 'Ali' })).toMatchObject({ ok: true, seat: 0 });

    const view = await first;
    expect(view.hand).toHaveLength(22);
    expect(view.players.map((p) => p.handCount)).toEqual([22, 21, 21, 21]);
    expect(view.turn).toBe(0);
    expect(view.turnPhase).toBe('play'); // the starting seat only discards first
    expect(view.mode).toBe('101');
    // The payload is the bare PlayerView: no { game, view } envelope, no wrapper fields.
    expect(view).not.toHaveProperty('view');
    expect(view).not.toHaveProperty('game');
    expect(view).toEqual(expect.objectContaining({ seat: 0, indicator: expect.any(Object), okey: expect.any(Object) }));

    const started = await room;
    expect(started.mode).toBe('101');
    c.close();
  });

  it('quick play with mode "duz" deals the düz hand', async () => {
    const c = client();
    const first = waitFor<PlayerView>(c, 'game:view', () => true);
    expect(await c.emitWithAck('room:quickPlay', { name: 'Ali', mode: 'duz' })).toMatchObject({ ok: true, seat: 0 });
    const view = await first;
    expect(view.mode).toBe('duz');
    expect(view.hand).toHaveLength(15);
    expect(view.players.map((p) => p.handCount)).toEqual([15, 14, 14, 14]);
    c.close();
  });

  it('create + join + start: RoomInfo keeps mode and the seats', async () => {
    const [a, b] = [client(), client()];
    const created = await a.emitWithAck('room:create', { name: 'A', mode: 'duz', isPublic: true });
    if (!created.ok) throw new Error(created.error);
    expect(await b.emitWithAck('room:join', { roomId: created.roomId.toLowerCase(), name: 'B' })).toMatchObject({
      ok: true,
      seat: 1,
    });

    const started = waitFor<RoomInfo>(b, 'room:state', (r) => r.started);
    const view = waitFor<PlayerView>(b, 'game:view', () => true);
    expect(await a.emitWithAck('room:start')).toEqual({ ok: true });

    const room = await started;
    expect(room).toMatchObject({ id: created.roomId, mode: 'duz', hostSeat: 0, started: true, round: 1 });
    expect(room.seats.map((s) => s?.isBot)).toEqual([false, false, true, true]);
    expect(room.seats.map((s) => s?.name).slice(0, 2)).toEqual(['A', 'B']);
    expect(room.totals).toEqual([0, 0, 0, 0]);
    expect((await view).mode).toBe('duz');
    a.close();
    b.close();
  });

  it(
    '101: a whole hand is played to the end and nextRound is accepted',
    async () => {
      const c = client();
      const feed = new ViewFeed(c);
      const started = waitFor<RoomInfo>(c, 'room:state', (r) => r.started);
      const ack = await c.emitWithAck('room:quickPlay', { name: 'Ali' });
      if (!ack.ok) throw new Error(ack.error);
      expect((await started).mode).toBe('101');

      const final = await within(playHand(c, feed, ack.seat), 25_000);
      expect(final.phase).toBe('finished');
      expect(final.result).not.toBeNull();
      expect(final.hand.length).toBeLessThan(22); // the hand ran out, it did not merely stop

      expect(await c.emitWithAck('room:nextRound')).toEqual({ ok: true });
      feed.dispose();
      c.close();
    },
    30_000,
  );

  it(
    'duz: a whole hand is played to the end and nextRound is accepted',
    async () => {
      const c = client();
      const feed = new ViewFeed(c);
      const ack = await c.emitWithAck('room:quickPlay', { name: 'Ali', mode: 'duz' });
      if (!ack.ok) throw new Error(ack.error);

      const final = await within(playHand(c, feed, ack.seat), 25_000);
      expect(final.phase).toBe('finished');
      expect(final.mode).toBe('duz');
      expect(final.result).not.toBeNull();

      expect(await c.emitWithAck('room:nextRound')).toEqual({ ok: true });
      feed.dispose();
      c.close();
    },
    30_000,
  );

  it('salon:watch(true) lists only okey tables, each with a mode', async () => {
    const [host, watcher] = [client(), client()];
    const created = await host.emitWithAck('room:create', { name: 'Salon', isPublic: true });
    if (!created.ok) throw new Error(created.error);

    const listed = waitFor<TableSummary[]>(watcher, 'salon:list', (l) => l.some((t) => t.id === created.roomId));
    watcher.emit('salon:watch', true); // v1.0.1 sends the boolean alone
    const list = await listed;

    expect(list.length).toBeGreaterThan(0);
    for (const t of list) {
      // Every row is an okey table and still carries the legacy `mode`.
      expect<GameMode[]>(['101', 'duz']).toContain(t.mode);
      expect(t).toEqual(
        expect.objectContaining({ id: expect.any(String), seats: expect.any(Array), free: expect.any(Number), started: expect.any(Boolean) }),
      );
    }
    expect(list.find((t) => t.id === created.roomId)).toMatchObject({
      mode: '101',
      seats: ['Salon', null, null, null],
      free: 3,
      started: false,
    });
    host.close();
    watcher.close();
  });

  it('v1.0.1 client message sequence', async () => {
    const c = client();
    expect(fixture.source).toBe('c19eea2:app/src/net/useOkey.ts');
    let lastRoomId = '';
    for (const step of fixture.steps) {
      const payload = resolvePayload(step.payload, lastRoomId);
      if (step.expectAck) {
        const ack = await emitWithAck(c, step.event, payload);
        if (step.expectAck.ok) {
          expect(ack, `${String(step.event)} should be accepted`).toMatchObject({ ok: true });
          if (step.event === 'room:create') lastRoomId = ack.roomId ?? lastRoomId;
        } else {
          expect(ack, `${String(step.event)} should be refused`).toEqual({ ok: false, error: step.expectAck.error });
        }
      } else {
        // room:leave / salon:watch have no ack: give the server a moment to apply them.
        const loose = c as unknown as { emit: (e: string, ...args: unknown[]) => void };
        if (payload === undefined) loose.emit(step.event);
        else loose.emit(step.event, payload);
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    }
    c.close();
  });
});
