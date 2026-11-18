import { createHmac } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import {
  QUICK_EMOJI,
  QUICK_SAYINGS,
  type KahveClientToServerEvents,
  type KahveServerToClientEvents,
  type RoomInfo,
  type TableSaid,
} from '@okey/shared';
import { SayLimiter } from '../src/chat';
import { createOkeyServer, type OkeyServer } from '../src/server';
import { signTablePass } from '../src/tablePass';
import { VOICE_TOKEN_TTL_SEC, liveKitConfigFromEnv, liveKitToken } from '../src/voice';

/*
 * E2: quick sayings ('table:say' / 'table:said'), voice tables and 'voice:token' (LiveKit HS256 JWT),
 * accountId in RoomInfo. Fake LiveKit keys only; the JWT is checked here with node:crypto.
 */

type V2Client = Socket<KahveServerToClientEvents, KahveClientToServerEvents>;
const LK = { url: 'wss://livekit.example.test', apiKey: 'APItestkey', apiSecret: 'test-secret-not-a-real-key-0123456789' };
const ACC_A = '11111111-2222-4333-8444-555555555555';
const ACC_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
/** E2b: accountIds now come from a signed table pass (fake secret, tests only). */
const PASS_SECRET = 'e2-test-table-pass-secret-not-real-0123456789';
const pass = (sub: string) => signTablePass(PASS_SECRET, { sub });
const WAIT_MS = 1500;

/** Verifies an HS256 JWT with `secret` and returns its header and claims (throws on a bad signature). */
function verifyJwt(token: string, secret: string): { header: Record<string, unknown>; claims: Record<string, unknown> } {
  const parts = token.split('.');
  expect(parts).toHaveLength(3);
  const sig = createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  if (sig !== parts[2]) throw new Error('bad signature');
  return {
    header: JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')),
    claims: JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')),
  };
}

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

describe('SayLimiter', () => {
  it('1 per 2 s, 15 per sliding minute, refusals do not count, forget resets', () => {
    let t = 1_000_000;
    const l = new SayLimiter(2000, 15, () => t);
    expect(l.allow('a')).toBe(true);
    t += 1999;
    expect(l.allow('a')).toBe(false);
    expect(l.allow('b')).toBe(true); // per key
    t += 1;
    expect(l.allow('a')).toBe(true);
    // 13 more, 2 s apart: 15 within the minute (t0 .. t0+30 s)
    for (let i = 0; i < 13; i++) {
      t += 2000;
      expect(l.allow('a')).toBe(true);
    }
    t += 2000;
    expect(l.allow('a')).toBe(false); // 16th inside the same minute
    t = 1_000_000 + 60_001; // the first one left the window
    expect(l.allow('a')).toBe(true);
    l.forget('a');
    expect(l.allow('a')).toBe(true);
  });
});

describe('liveKitToken', () => {
  it('signs HS256 with the secret, LiveKit claims, 2 h ttl', () => {
    const nowMs = Date.UTC(2026, 10, 19, 12, 0, 0);
    const token = liveKitToken(LK, { room: 'ABCDE', identity: 's1-0123456789ab', name: 'Ayşe', nowMs });
    const { header, claims } = verifyJwt(token, LK.apiSecret);
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    const now = nowMs / 1000;
    expect(claims).toEqual({
      iss: LK.apiKey,
      sub: 's1-0123456789ab',
      name: 'Ayşe',
      nbf: now,
      iat: now,
      exp: now + 7200,
      video: {
        room: 'ABCDE',
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: false,
        canPublishSources: ['microphone'],
      },
    });
    expect(VOICE_TOKEN_TTL_SEC).toBe(7200);
    expect(() => verifyJwt(token, 'other-secret')).toThrow('bad signature');
  });

  it('config from env needs all three variables', () => {
    expect(liveKitConfigFromEnv({ LIVEKIT_URL: 'wss://x', LIVEKIT_API_KEY: 'k' })).toBeNull();
    expect(liveKitConfigFromEnv({ LIVEKIT_URL: 'wss://x', LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: ' ' })).toBeNull();
    expect(liveKitConfigFromEnv({ LIVEKIT_URL: 'wss://x', LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's' })).toEqual({
      url: 'wss://x',
      apiKey: 'k',
      apiSecret: 's',
    });
  });
});

describe('E2 over the socket', () => {
  let server: OkeyServer;
  let url: string;
  let noVoice: OkeyServer;
  let noVoiceUrl: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    server = createOkeyServer({ botDelayMs: 1, turnTimeoutMs: 0 }, 120_000, { livekit: LK, tablePassSecret: PASS_SECRET });
    url = `http://localhost:${await server.listen(0)}`;
    noVoice = createOkeyServer({ botDelayMs: 1, turnTimeoutMs: 0 }, 120_000, { livekit: null, tablePassSecret: PASS_SECRET });
    noVoiceUrl = `http://localhost:${await noVoice.listen(0)}`;
  });
  afterEach(() => {
    while (sockets.length) sockets.pop()!.close();
  });
  afterAll(async () => {
    await server.close();
    await noVoice.close();
  });

  function v2(auth: Record<string, unknown> = {}, at = url): V2Client {
    const s = connect(at, { transports: ['websocket'], forceNew: true, auth: { v: 2, ...auth } }) as V2Client;
    sockets.push(s);
    return s;
  }
  function v1(): Socket {
    const s = connect(url, { transports: ['websocket'], forceNew: true });
    sockets.push(s);
    return s;
  }
  /** Latest room:state per socket. */
  function stateOf(s: Socket): () => RoomInfo | null {
    let last: RoomInfo | null = null;
    s.on('room:state', (r: RoomInfo) => (last = r));
    return () => last;
  }
  function saidOf(s: Socket): TableSaid[] {
    const got: TableSaid[] = [];
    s.on('table:said', (m: TableSaid) => got.push(m));
    return got;
  }
  const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));

  async function create(s: V2Client, p: Parameters<KahveClientToServerEvents['room:create']>[0]) {
    const ack = await within(s.emitWithAck('room:create', p));
    if (!ack.ok) throw new Error(ack.error);
    return ack;
  }

  it('say reaches every v2 socket at the table (sender too), never a v1 socket; RoomInfo v2 has voice + accountId, v1 does not', async () => {
    const a = v2();
    const b = v2({ tablePass: pass(ACC_B) }); // from the handshake
    const old = v1();
    const stA = stateOf(a);
    const stOld = stateOf(old);
    const saidA = saidOf(a);
    const saidB = saidOf(b);
    const saidOld = saidOf(old);
    const { roomId } = await create(a, { name: 'A', password: '123456', tablePass: pass(ACC_A) });
    expect(await within(b.emitWithAck('room:join', { roomId, name: 'B', password: '123456' }))).toMatchObject({ ok: true, seat: 1 });
    const joinOld = (await within((old as V2Client).emitWithAck('room:join', { roomId, name: 'Eski', password: '123456' }))) as {
      ok: boolean;
    };
    expect(joinOld).toMatchObject({ ok: true, seat: 2 });
    await settle();

    const infoA = stA()!;
    expect(infoA.voice).toBe(true); // password table: voice on by default
    expect(infoA.seats.slice(0, 3).map((s) => s?.accountId)).toEqual([ACC_A, ACC_B, undefined]);

    const infoOld = stOld()!;
    expect(Object.keys(infoOld).sort()).toEqual(['hostSeat', 'id', 'isPublic', 'mode', 'password', 'round', 'seats', 'started', 'totals']);
    for (const s of infoOld.seats) if (s) expect(Object.keys(s).sort()).toEqual(['connected', 'isBot', 'name', 'seat']);

    expect(await within(b.emitWithAck('table:say', { saying: 'cayBenden' }))).toEqual({ ok: true });
    await settle();
    expect(saidA).toHaveLength(1);
    expect(saidA[0]).toMatchObject({ seat: 1, saying: 'cayBenden' });
    expect(saidA[0]).not.toHaveProperty('emoji');
    expect(Math.abs(saidA[0].at - Date.now())).toBeLessThan(2000);
    expect(saidB).toEqual(saidA);
    expect(saidOld).toEqual([]);

    expect(await within(a.emitWithAck('table:say', { emoji: '☕' }))).toEqual({ ok: true });
    await settle();
    expect(saidB[1]).toMatchObject({ seat: 0, emoji: '☕' });
    expect(saidOld).toEqual([]);

    // A v1 app that somehow sends it is refused (it can't show the answer anyway).
    expect(await within((old as V2Client).emitWithAck('table:say', { saying: 'eline' }))).toEqual({ ok: false, error: 'not_seated' });
  });

  it('say: not seated / bad payloads / too fast', async () => {
    const stranger = v2();
    expect(await within(stranger.emitWithAck('table:say', { saying: 'tebrikler' }))).toEqual({ ok: false, error: 'not_seated' });

    // There is no room id in the payload: a socket can only ever speak at the table it sits at.
    const a = v2();
    await create(a, { name: 'A' });

    for (const bad of [
      {},
      { saying: 'tebrikler', emoji: '👍' },
      { saying: 'merhaba nasılsın' },
      { emoji: '💩' },
      { saying: 42 },
      null,
      'tebrikler',
    ]) {
      expect(await within(a.emitWithAck('table:say', bad as never))).toEqual({ ok: false, error: 'invalid' });
    }
    expect(await within(a.emitWithAck('table:say', { saying: QUICK_SAYINGS[0] }))).toEqual({ ok: true });
    expect(await within(a.emitWithAck('table:say', { emoji: QUICK_EMOJI[0] }))).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('say: 15 per minute (gap off for the test)', async () => {
    const fast = createOkeyServer({ botDelayMs: 1, turnTimeoutMs: 0 }, 120_000, { livekit: null, sayMinGapMs: 0 });
    const at = `http://localhost:${await fast.listen(0)}`;
    try {
      const a = v2({}, at);
      await create(a, { name: 'A' });
      for (let i = 0; i < 15; i++) {
        expect(await within(a.emitWithAck('table:say', { saying: QUICK_SAYINGS[i % QUICK_SAYINGS.length] }))).toEqual({ ok: true });
      }
      expect(await within(a.emitWithAck('table:say', { emoji: '👏' }))).toEqual({ ok: false, error: 'rate_limited' });
    } finally {
      await fast.close();
    }
  });

  it('voice defaults: friends table on, open listed table off, code-only table on, quickPlay off, host choice wins', async () => {
    const cases: [Parameters<KahveClientToServerEvents['room:create']>[0], boolean][] = [
      [{ name: 'A', password: '654321' }, true],
      [{ name: 'A', isPublic: true }, false],
      [{ name: 'A' }, true],
      [{ name: 'A', isPublic: true, voice: true }, true],
      [{ name: 'A', password: '654321', voice: false }, false],
    ];
    for (const [p, voice] of cases) {
      const s = v2();
      const st = stateOf(s);
      await create(s, p);
      await settle(40);
      expect(st()?.voice, JSON.stringify(p)).toBe(voice);
    }
    const q = v2();
    const st = stateOf(q);
    expect(await within(q.emitWithAck('room:quickPlay', { name: 'Q', game: 'okey101' }))).toMatchObject({ ok: true });
    await settle(40);
    expect(st()?.voice).toBe(false);
  });

  it('a v1 host never gets a voice table (it never chose one)', async () => {
    const host = v1();
    const created = (await within((host as V2Client).emitWithAck('room:create', { name: 'H', password: '111222' }))) as {
      ok: true;
      roomId: string;
    };
    const b = v2();
    const st = stateOf(b);
    expect(await within(b.emitWithAck('room:join', { roomId: created.roomId, name: 'B', password: '111222' }))).toMatchObject({ ok: true });
    await settle();
    expect(st()?.voice).toBe(false);
    expect(await within(b.emitWithAck('voice:token'))).toEqual({ ok: false, error: 'voice_off' });
  });

  it('voice:token: not_seated, voice_off, not_configured', async () => {
    expect(await within(v2().emitWithAck('voice:token'))).toEqual({ ok: false, error: 'not_seated' });

    const open = v2();
    await create(open, { name: 'A', isPublic: true });
    expect(await within(open.emitWithAck('voice:token'))).toEqual({ ok: false, error: 'voice_off' });

    const unconfigured = v2({}, noVoiceUrl);
    await create(unconfigured, { name: 'A', password: '123123' });
    expect(await within(unconfigured.emitWithAck('voice:token'))).toEqual({ ok: false, error: 'not_configured' });
  });

  it('voice:token: a signed LiveKit token for this table and seat; same identity on a re-request', async () => {
    const a = v2();
    const b = v2();
    const { roomId } = await create(a, { name: 'Ayşe', password: '777888' });
    expect(await within(b.emitWithAck('room:join', { roomId, name: 'Bora', password: '777888' }))).toMatchObject({ ok: true, seat: 1 });

    const r = await within(b.emitWithAck('voice:token'));
    if (!r.ok) throw new Error(r.error);
    expect(r.url).toBe(LK.url);
    expect(r.room).toBe(roomId);
    expect(r.identity).toMatch(/^s1-[0-9a-f]{12}$/);
    const { header, claims } = verifyJwt(r.token, LK.apiSecret);
    expect(header.alg).toBe('HS256');
    expect(claims).toMatchObject({
      iss: LK.apiKey,
      sub: r.identity,
      name: 'Bora',
      video: { room: roomId, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false },
    });
    const { exp, nbf } = claims as { exp: number; nbf: number };
    expect(exp - nbf).toBe(7200);
    expect(Math.abs(nbf - Date.now() / 1000)).toBeLessThan(5);

    const again = await within(b.emitWithAck('voice:token'));
    expect(again.ok && again.identity).toBe(r.identity);
    const ra = await within(a.emitWithAck('voice:token'));
    expect(ra.ok && ra.identity).toMatch(/^s0-[0-9a-f]{12}$/);
    expect(ra.ok && ra.identity).not.toBe(r.identity);
  });

  it('accountId: payload pass wins over handshake pass, junk is dropped, bots have none', async () => {
    const a = v2({ tablePass: pass(ACC_B) });
    const st = stateOf(a);
    await create(a, { name: 'A', tablePass: pass(ACC_A) });
    expect(await within(a.emitWithAck('room:start'))).toEqual({ ok: true });
    await settle();
    const seats = st()!.seats;
    expect(seats[0]?.accountId).toBe(ACC_A);
    for (const s of seats.slice(1)) {
      expect(s?.isBot).toBe(true);
      expect(s).not.toHaveProperty('accountId');
    }

    const junk = v2({ tablePass: 'x'.repeat(5000) });
    const stJ = stateOf(junk);
    await create(junk, { name: 'J', tablePass: '<script>' });
    await settle(40);
    expect(stJ()!.seats[0]).not.toHaveProperty('accountId');
  });
});
