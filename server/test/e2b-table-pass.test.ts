import { createHmac } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { io as connect, type Socket } from 'socket.io-client';
import {
  TABLE_PASS_TOLERANCE_MS,
  TABLE_PASS_TTL_MS,
  type KahveClientToServerEvents,
  type KahveServerToClientEvents,
  type RoomInfo,
} from '@okey/shared';
import { createOkeyServer, type OkeyServer } from '../src/server';
import { TABLE_PASS_CONTEXT, signTablePass, tablePassSecret, verifyTablePass } from '../src/tablePass';

/*
 * E2b: table pass (HMAC-signed by the accounts server, checked locally here), seat accountId only from a valid pass,
 * server-side voice ban on 'voice:token', say limit per account across reconnects. Fake secrets only.
 */

type V2Client = Socket<KahveServerToClientEvents, KahveClientToServerEvents>;
const SECRET = 'e2b-test-table-pass-secret-not-real-0123456789';
const OTHER = 'e2b-some-other-secret-also-not-real-9876543210';
const LK = { url: 'wss://livekit.example.test', apiKey: 'APItestkey', apiSecret: 'test-secret-not-a-real-key-0123456789' };
const ACC_A = '11111111-2222-4333-8444-555555555555';
const ACC_B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const WAIT_MS = 1500;
const QUICK = '👍' as const;

/** Golden vector: packages/accounts/test/tablePass.test.ts expects the very same string from the signing side. */
const GOLDEN = {
  secret: 'golden-vector-secret-not-real-0123456789',
  claims: { sub: ACC_A, vb: 1795000000000, iat: 1795000000000, exp: 1795021600000 },
  pass:
    'eyJ2IjoxLCJzdWIiOiIxMTExMTExMS0yMjIyLTQzMzMtODQ0NC01NTU1NTU1NTU1NTUiLCJ2YiI6MTc5NTAwMDAwMDAwMCwiaWF0IjoxNzk1MDAwMDAwMDAwLCJleHAiOjE3OTUwMjE2MDAwMDB9' +
    '.y17pPt6t2G27Q3hHCytQtMmG-Eh4ErnIsrevv4h-2dY',
};

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

/** Re-signs a hand-made payload (to test fields the signer would never write). */
function signRaw(secret: string, payload: unknown): string {
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${b64}.${createHmac('sha256', secret).update(TABLE_PASS_CONTEXT + b64).digest('base64url')}`;
}

describe('verifyTablePass', () => {
  const now = 1_800_000_000_000;

  it('golden vector: exact format, independent HMAC check', () => {
    const pass = signTablePass(GOLDEN.secret, GOLDEN.claims);
    expect(pass).toBe(GOLDEN.pass);
    const [b64, sig] = pass.split('.');
    expect(JSON.parse(Buffer.from(b64!, 'base64url').toString('utf8'))).toEqual({ v: 1, ...GOLDEN.claims });
    expect(sig).toBe(createHmac('sha256', GOLDEN.secret).update(`kahve-table-pass.v1.${b64}`).digest('base64url'));
    expect(verifyTablePass(pass, GOLDEN.secret, GOLDEN.claims.iat + 1000)).toEqual(GOLDEN.claims);
  });

  it('valid pass -> claims; default exp is iat + 1 h', () => {
    const pass = signTablePass(SECRET, { sub: ACC_A, vb: now + 5000, iat: now });
    expect(verifyTablePass(pass, SECRET, now)).toEqual({ sub: ACC_A, vb: now + 5000, iat: now, exp: now + TABLE_PASS_TTL_MS });
    expect(TABLE_PASS_TTL_MS).toBe(3600 * 1000);
  });

  it('forged signature, other secret, tampered payload -> null', () => {
    const pass = signTablePass(SECRET, { sub: ACC_A, iat: now });
    const [b64, sig] = pass.split('.') as [string, string];
    expect(verifyTablePass(pass, OTHER, now)).toBeNull();
    expect(verifyTablePass(signTablePass(OTHER, { sub: ACC_A, iat: now }), SECRET, now)).toBeNull();
    const evil = Buffer.from(JSON.stringify({ v: 1, sub: ACC_B, vb: 0, iat: now, exp: now + 1000 })).toString('base64url');
    expect(verifyTablePass(`${evil}.${sig}`, SECRET, now)).toBeNull();
    const flipped = sig.slice(0, -2) + (sig.endsWith('AA') ? 'BB' : 'AA');
    expect(verifyTablePass(`${b64}.${flipped}`, SECRET, now)).toBeNull();
    expect(verifyTablePass(`${b64}.${sig.slice(0, 20)}`, SECRET, now)).toBeNull(); // short MAC, no throw
  });

  it('expiry with 60 s tolerance; iat in the future', () => {
    const pass = signTablePass(SECRET, { sub: ACC_A, iat: now - 1000, exp: now });
    expect(verifyTablePass(pass, SECRET, now + TABLE_PASS_TOLERANCE_MS - 1)).not.toBeNull();
    expect(verifyTablePass(pass, SECRET, now + TABLE_PASS_TOLERANCE_MS)).toBeNull();
    const future = signTablePass(SECRET, { sub: ACC_A, iat: now + 2 * TABLE_PASS_TOLERANCE_MS });
    expect(verifyTablePass(future, SECRET, now)).toBeNull();
  });

  it('wrong version, bad fields, junk -> null', () => {
    const base = { v: 1, sub: ACC_A, vb: 0, iat: now, exp: now + 1000 };
    expect(verifyTablePass(signRaw(SECRET, base), SECRET, now)).not.toBeNull();
    for (const bad of [
      { ...base, v: 2 },
      { ...base, v: '1' },
      { ...base, sub: ACC_B.toUpperCase() },
      { ...base, sub: 'admin' },
      { ...base, vb: -1 },
      { ...base, vb: 1.5 },
      { ...base, exp: 'later' },
      { sub: ACC_A, vb: 0, iat: now, exp: now + 1000 },
      [base],
      null,
    ]) {
      expect(verifyTablePass(signRaw(SECRET, bad), SECRET, now)).toBeNull();
    }
    for (const junk of [undefined, null, 42, {}, '', '.', 'a.b.c', 'x'.repeat(5000), '<script>.x', ACC_A]) {
      expect(verifyTablePass(junk, SECRET, now)).toBeNull();
    }
    const notJson = Buffer.from('not json').toString('base64url');
    expect(verifyTablePass(`${notJson}.${createHmac('sha256', SECRET).update(TABLE_PASS_CONTEXT + notJson).digest('base64url')}`, SECRET, now)).toBeNull();
  });

  it('no secret / short secret = not configured', () => {
    expect(tablePassSecret(undefined)).toBeNull();
    expect(tablePassSecret('x'.repeat(31))).toBeNull();
    expect(tablePassSecret('x'.repeat(32))).toBe('x'.repeat(32));
    expect(verifyTablePass(signTablePass(SECRET, { sub: ACC_A, iat: now }), null, now)).toBeNull();
  });
});

describe('E2b on the wire', () => {
  let server: OkeyServer;
  let url: string;
  let plain: OkeyServer;
  let plainUrl: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    server = createOkeyServer({ botDelayMs: 1, turnTimeoutMs: 0 }, 120_000, { livekit: LK, tablePassSecret: SECRET });
    url = `http://localhost:${await server.listen(0)}`;
    // No secret: every pass (and the old bare accountId) is ignored.
    plain = createOkeyServer({ botDelayMs: 1, turnTimeoutMs: 0 }, 120_000, { livekit: LK, tablePassSecret: null });
    plainUrl = `http://localhost:${await plain.listen(0)}`;
  });
  afterEach(() => {
    while (sockets.length) sockets.pop()!.close();
  });
  afterAll(async () => {
    await server.close();
    await plain.close();
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
  function stateOf(s: Socket): () => RoomInfo | null {
    let last: RoomInfo | null = null;
    s.on('room:state', (r: RoomInfo) => (last = r));
    return () => last;
  }
  const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));
  const pass = (sub: string, extra: { vb?: number; iat?: number; exp?: number; v?: number } = {}, secret = SECRET) =>
    signTablePass(secret, { sub, ...extra });

  async function create(s: V2Client, p: Parameters<KahveClientToServerEvents['room:create']>[0]) {
    const ack = await within(s.emitWithAck('room:create', p));
    if (!ack.ok) throw new Error(ack.error);
    return ack;
  }

  it('valid pass (payload or handshake) -> seat accountId; quickPlay too', async () => {
    const a = v2();
    const b = v2({ tablePass: pass(ACC_B) });
    const st = stateOf(a);
    const { roomId } = await create(a, { name: 'A', tablePass: pass(ACC_A) });
    expect(await within(b.emitWithAck('room:join', { roomId, name: 'B' }))).toMatchObject({ ok: true, seat: 1 });
    await settle();
    expect(st()!.seats.slice(0, 2).map((s) => s?.accountId)).toEqual([ACC_A, ACC_B]);
    expect(server.rooms.get(roomId)!.seats[0]?.voiceBannedUntil).toBe(0);

    const q = v2();
    const stQ = stateOf(q);
    expect(await within(q.emitWithAck('room:quickPlay', { name: 'Q', game: 'pisti', tablePass: pass(ACC_A) }))).toMatchObject({ ok: true });
    await settle();
    expect(stQ()!.seats[0]?.accountId).toBe(ACC_A);
  });

  it('forged / other-secret / expired / wrong-version pass: still seated, no accountId', async () => {
    const t = Date.now();
    const bad = [
      pass(ACC_A, {}, OTHER),
      pass(ACC_A, { iat: t - TABLE_PASS_TTL_MS - 120_000, exp: t - 120_000 }),
      pass(ACC_A, { v: 2 }),
      pass(ACC_A).replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')),
    ];
    for (const tablePass of bad) {
      const s = v2({ tablePass });
      const st = stateOf(s);
      const { roomId } = await create(s, { name: 'X', tablePass });
      await settle(40);
      expect(st()!.seats[0]).toMatchObject({ name: 'X', isBot: false });
      expect(st()!.seats[0]).not.toHaveProperty('accountId');
      expect(server.rooms.get(roomId)!.seats[0]?.accountId).toBeNull();
    }
  });

  it('the bare E2 accountId field is ignored (payload and handshake)', async () => {
    const s = v2({ accountId: ACC_A });
    const st = stateOf(s);
    // Old app build: sends accountId, no tablePass.
    const { roomId } = await within(s.emitWithAck('room:create', { name: 'Eski', accountId: ACC_B } as never)).then((a) => {
      if (!a.ok) throw new Error(a.error);
      return a;
    });
    await settle(40);
    expect(st()!.seats[0]).not.toHaveProperty('accountId');
    const j = v2({ accountId: ACC_B });
    expect(await within(j.emitWithAck('room:join', { roomId, name: 'J', accountId: ACC_A } as never))).toMatchObject({ ok: true });
    await settle(40);
    for (const seat of st()!.seats) if (seat) expect(seat).not.toHaveProperty('accountId');
  });

  it('server without TABLE_PASS_SECRET ignores even a valid pass', async () => {
    const s = v2({ tablePass: pass(ACC_A) }, plainUrl);
    const st = stateOf(s);
    await create(s, { name: 'A', tablePass: pass(ACC_A) });
    await settle(40);
    expect(st()!.seats[0]).not.toHaveProperty('accountId');
  });

  it('voice:token: banned while the pass ban runs; ok after it ended; voice_off still comes first', async () => {
    const t = Date.now();
    const banned = v2();
    const { roomId } = await create(banned, { name: 'Yasakli', voice: true, tablePass: pass(ACC_A, { vb: t + 3_600_000 }) });
    expect(await within(banned.emitWithAck('voice:token'))).toEqual({ ok: false, error: 'banned' });

    const old = v2();
    expect(await within(old.emitWithAck('room:join', { roomId, name: 'Eski', tablePass: pass(ACC_B, { vb: t - 1000 }) }))).toMatchObject({ ok: true });
    expect(await within(old.emitWithAck('voice:token'))).toMatchObject({ ok: true });

    const quiet = v2();
    await create(quiet, { name: 'Q', voice: false, tablePass: pass(ACC_A, { vb: t + 3_600_000 }) });
    expect(await within(quiet.emitWithAck('voice:token'))).toEqual({ ok: false, error: 'voice_off' });
  });

  it('say limit is per account: a reconnect does not reset it (a guest socket does reset)', async () => {
    const t1 = v2();
    const { roomId } = await create(t1, { name: 'Ali', tablePass: pass(ACC_A) });
    expect(await within(t1.emitWithAck('room:start'))).toEqual({ ok: true });
    expect(await within(t1.emitWithAck('table:say', { emoji: QUICK }))).toEqual({ ok: true });
    t1.close();
    await settle();
    const t2 = v2({ tablePass: pass(ACC_A) });
    const st = stateOf(t2);
    expect(await within(t2.emitWithAck('room:join', { roomId, name: 'Ali' }))).toMatchObject({ ok: true, seat: 0 });
    await settle(40);
    expect(st()!.seats[0]?.accountId).toBe(ACC_A);
    expect(await within(t2.emitWithAck('table:say', { emoji: QUICK }))).toEqual({ ok: false, error: 'rate_limited' });

    // Guest (no pass): limited per socket, so the same move gets through.
    const g1 = v2();
    const { roomId: gRoom } = await create(g1, { name: 'Misafir' });
    expect(await within(g1.emitWithAck('room:start'))).toEqual({ ok: true });
    expect(await within(g1.emitWithAck('table:say', { emoji: QUICK }))).toEqual({ ok: true });
    g1.close();
    await settle();
    const g2 = v2();
    expect(await within(g2.emitWithAck('room:join', { roomId: gRoom, name: 'Misafir' }))).toMatchObject({ ok: true, seat: 0 });
    expect(await within(g2.emitWithAck('table:say', { emoji: QUICK }))).toEqual({ ok: true });
  });

  it('one account, two seats at a table: the second seat gets no accountId but keeps the ban', async () => {
    const t = Date.now();
    const a = v2();
    const st = stateOf(a);
    const { roomId } = await create(a, { name: 'A', voice: true, tablePass: pass(ACC_A) });
    const twin = v2();
    expect(
      await within(twin.emitWithAck('room:join', { roomId, name: 'A2', tablePass: pass(ACC_A, { vb: t + 60_000 }) })),
    ).toMatchObject({ ok: true, seat: 1 });
    await settle();
    expect(st()!.seats[0]?.accountId).toBe(ACC_A);
    expect(st()!.seats[1]).not.toHaveProperty('accountId');
    expect(await within(twin.emitWithAck('voice:token'))).toEqual({ ok: false, error: 'banned' });
  });

  it('a v1 socket at the table never sees accountId', async () => {
    const a = v2();
    const { roomId } = await create(a, { name: 'A', tablePass: pass(ACC_A) });
    const old = v1();
    const stOld = stateOf(old);
    expect(await within((old as V2Client).emitWithAck('room:join', { roomId, name: 'Eski' }))).toMatchObject({ ok: true, seat: 1 });
    await settle();
    expect(server.rooms.get(roomId)!.seats[0]?.accountId).toBe(ACC_A);
    for (const s of stOld()!.seats) if (s) expect(Object.keys(s).sort()).toEqual(['connected', 'isBot', 'name', 'seat']);
  });
});

