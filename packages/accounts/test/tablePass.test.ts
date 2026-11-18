import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAccountsApp, type AccountsApp } from '../src/app';
import type { AccountStore } from '../src/store';
import { signTablePass, TABLE_PASS_CONTEXT, TABLE_PASS_TTL_MS } from '../src/tablePass';
import { listen, storeFactories } from './helpers';

/* E2b: GET /v1/me/table-pass (signing side of the table pass; the game server verifies it). Fake secrets only. */

const SECRET = 'accounts-test-table-pass-secret-not-real-01';
const DAY0 = Date.UTC(2026, 10, 19, 10, 0, 0);
const H = 3600_000;

/** Golden vector shared with server/test/e2b-table-pass.test.ts (the game server must accept exactly this string). */
const GOLDEN = {
  secret: 'golden-vector-secret-not-real-0123456789',
  claims: { sub: '11111111-2222-4333-8444-555555555555', vb: 1795000000000, iat: 1795000000000, exp: 1795021600000 },
  pass:
    'eyJ2IjoxLCJzdWIiOiIxMTExMTExMS0yMjIyLTQzMzMtODQ0NC01NTU1NTU1NTU1NTUiLCJ2YiI6MTc5NTAwMDAwMDAwMCwiaWF0IjoxNzk1MDAwMDAwMDAwLCJleHAiOjE3OTUwMjE2MDAwMDB9' +
    '.y17pPt6t2G27Q3hHCytQtMmG-Eh4ErnIsrevv4h-2dY',
};

function decode(pass: string, secret: string): Record<string, unknown> {
  const [b64, sig, extra] = pass.split('.');
  expect(extra).toBeUndefined();
  expect(sig).toBe(createHmac('sha256', secret).update(TABLE_PASS_CONTEXT + b64).digest('base64url'));
  return JSON.parse(Buffer.from(b64!, 'base64url').toString('utf8'));
}

describe('signTablePass', () => {
  it('golden vector', () => {
    expect(signTablePass(GOLDEN.secret, GOLDEN.claims)).toBe(GOLDEN.pass);
    expect(decode(GOLDEN.pass, GOLDEN.secret)).toEqual({ v: 1, ...GOLDEN.claims });
  });
});

describe.each(storeFactories)('E2b GET /v1/me/table-pass on $name', (factory) => {
  let store: AccountStore;
  let cleanup: () => void;
  let app: AccountsApp;
  let url: string;
  let close: () => Promise<void>;
  let clock: number;

  async function start(tablePassSecret?: string) {
    app = createAccountsApp({ store, moderation: [], now: () => clock, log: () => {}, tablePassSecret });
    ({ url, close } = await listen(app));
  }
  beforeEach(() => {
    ({ store, cleanup } = factory.make());
    clock = DAY0;
  });
  afterEach(async () => {
    await app.whenIdle();
    await close();
    cleanup();
  });

  const req = (path: string, init: RequestInit = {}) => fetch(url + path, init);
  async function guest(): Promise<{ accountId: string; token: string }> {
    const r = await req('/v1/accounts/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(r.status).toBe(201);
    return r.json();
  }
  const tablePass = (token: string) => req('/v1/me/table-pass', { headers: { authorization: `Bearer ${token}` } });

  it('200 { pass, expiresAt }: signed payload v1, sub, vb 0, iat now, exp now + 1 h, no-store', async () => {
    await start(SECRET);
    const g = await guest();
    const r = await tablePass(g.token);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const body = (await r.json()) as { pass: string; expiresAt: number };
    expect(Object.keys(body).sort()).toEqual(['expiresAt', 'pass']);
    expect(body.expiresAt).toBe(DAY0 + TABLE_PASS_TTL_MS);
    expect(decode(body.pass, SECRET)).toEqual({ v: 1, sub: g.accountId, vb: 0, iat: DAY0, exp: DAY0 + TABLE_PASS_TTL_MS });
  });

  it('vb = the running voice ban; 0 again once it ended', async () => {
    await start(SECRET);
    const g = await guest();
    await store.setVoiceBan(g.accountId, DAY0 + 24 * H);
    const p1 = (await (await tablePass(g.token)).json()) as { pass: string };
    expect(decode(p1.pass, SECRET).vb).toBe(DAY0 + 24 * H);
    clock = DAY0 + 25 * H;
    const p2 = (await (await tablePass(g.token)).json()) as { pass: string };
    expect(decode(p2.pass, SECRET)).toMatchObject({ vb: 0, iat: clock });
  });

  it('401 without a valid token', async () => {
    await start(SECRET);
    expect((await req('/v1/me/table-pass')).status).toBe(401);
    expect((await tablePass('x'.repeat(43))).status).toBe(401);
  });

  it('503 not_configured without a secret, or with one shorter than 32 chars', async () => {
    for (const secret of [undefined, 'x'.repeat(31)]) {
      await start(secret);
      const g = await guest();
      const r = await tablePass(g.token);
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ error: 'not_configured' });
      await close();
    }
    await start('x'.repeat(32));
    expect((await tablePass((await guest()).token)).status).toBe(200);
  });
});
