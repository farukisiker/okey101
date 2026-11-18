import { generateKeyPairSync, verify as cryptoVerify } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APPLE_REVOKE_URL, APPLE_TOKEN_URL } from '../src/apple';
import { createAccountsApp, type AccountsApp } from '../src/app';
import type { AuthOptions } from '../src/auth';
import { APPLE_JWKS_URL, GOOGLE_JWKS_URL } from '../src/jwt';
import { SqliteStore } from '../src/sqliteStore';
import type { AccountStore } from '../src/store';
import type { AuthResult, Me } from '../src/types';
import { listen, storeFactories } from './helpers';
import { APPLE_AUD, appleClaims, FakeIdp, GOOGLE_AUD, googleClaims, hs256Jwt, noneJwt, rsaKey, signJwt } from './idp';

const T0 = Date.UTC(2026, 10, 18, 12, 0, 0);
const SECRET = 'test-only-secret-0123456789abcdefghijkl';
const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const P8 = ec.privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;
const REVOKE_CFG = { teamId: 'TEAMID1234', keyId: 'KEYID12345', privateKey: P8 };

describe.each(storeFactories)('sign in with Apple / Google on $name', (factory) => {
  let store: AccountStore;
  let cleanup: () => void;
  let app: AccountsApp;
  let url: string;
  let close: (() => Promise<void>) | undefined;
  let clock: number;
  let idp: FakeIdp;
  let logs: string[];

  async function boot(auth: Partial<AuthOptions> = {}) {
    if (close) {
      await app.whenIdle();
      await close();
    }
    app = createAccountsApp({
      store,
      moderation: [],
      now: () => clock,
      log: (m, e) => logs.push(`${m} ${e === undefined ? '' : String((e as Error)?.message ?? e)}`),
      auth: { appleAudiences: [APPLE_AUD], googleAudiences: [GOOGLE_AUD], fetch: idp.fetch, ...auth },
    });
    ({ url, close } = await listen(app));
  }

  beforeEach(async () => {
    ({ store, cleanup } = factory.make());
    clock = T0;
    idp = new FakeIdp();
    logs = [];
    close = undefined;
    await boot();
  });
  afterEach(async () => {
    await app.whenIdle();
    await close!();
    cleanup();
  });

  // ---------------------------------------------------------------- helpers
  const appleToken = (extra: Record<string, unknown> = {}) => signJwt(idp.appleKeys[0], appleClaims(clock, extra));
  const googleToken = (extra: Record<string, unknown> = {}) => signJwt(idp.googleKeys[0], googleClaims(clock, extra));
  function post(path: string, body: unknown, token?: string) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    return fetch(url + path, { method: 'POST', headers, body: JSON.stringify(body) });
  }
  const apple = (body: Record<string, unknown>, token?: string) => post('/v1/auth/apple', body, token);
  const google = (idToken: string, token?: string) => post('/v1/auth/google', { idToken }, token);
  async function guest(): Promise<{ accountId: string; token: string }> {
    const r = await post('/v1/accounts/guest', {});
    expect(r.status).toBe(201);
    return r.json();
  }
  async function me(token: string): Promise<Me> {
    const r = await fetch(url + '/v1/me', { headers: { authorization: `Bearer ${token}` } });
    expect(r.status).toBe(200);
    return r.json();
  }
  async function ok(r: Response): Promise<AuthResult> {
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    return r.json();
  }
  async function expectError(r: Response, status: number, error: string) {
    expect(r.status).toBe(status);
    expect(await r.json()).toEqual({ error });
  }
  const del = (token: string) => fetch(url + '/v1/me', { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
  const rawEnc = async (accountId: string) => (await store.listProviderLinks(accountId)).find((l) => l.provider === 'apple')?.appleRefreshEnc ?? null;

  // ---------------------------------------------------------------- linking
  it('valid Apple token links the guest account (same token, switched false, providers in Me)', async () => {
    const g = await guest();
    const res = await ok(await apple({ identityToken: appleToken() }, g.token));
    expect(res).toEqual({ accountId: g.accountId, token: g.token, switched: false });
    expect((await me(g.token)).providers).toEqual(['apple']);
    expect(await store.accountByProvider('apple', 'apple-sub-1')).toBe(g.accountId);
  });

  it('valid Google token links; both providers show in fixed order', async () => {
    const g = await guest();
    expect(await ok(await google(googleToken(), g.token))).toEqual({ accountId: g.accountId, token: g.token, switched: false });
    await ok(await apple({ identityToken: appleToken() }, g.token));
    expect((await me(g.token)).providers).toEqual(['apple', 'google']);
  });

  it('without Bearer a new account is created and its token works', async () => {
    const res = await ok(await google(googleToken()));
    expect(res.switched).toBe(false);
    expect(res.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const m = await me(res.token);
    expect(m.accountId).toBe(res.accountId);
    expect(m.providers).toEqual(['google']);
  });

  it('linked identity from another device switches to the existing account (guest kept, not merged)', async () => {
    const owner = await guest();
    await ok(await apple({ identityToken: appleToken() }, owner.token));
    const other = await guest(); // e.g. reinstalled app
    const res = await ok(await apple({ identityToken: appleToken() }, other.token));
    expect(res.switched).toBe(true);
    expect(res.accountId).toBe(owner.accountId);
    expect(res.token).not.toBe(owner.token);
    expect(res.token).not.toBe(other.token);
    expect((await me(res.token)).accountId).toBe(owner.accountId);
    expect((await me(owner.token)).accountId).toBe(owner.accountId); // old device keeps its session
    expect((await me(other.token)).providers).toEqual([]); // guest left alone
    // without a Bearer too
    const res2 = await ok(await apple({ identityToken: appleToken() }));
    expect(res2).toMatchObject({ accountId: owner.accountId, switched: true });
    // the owner signing in again keeps its own token
    expect(await ok(await apple({ identityToken: appleToken() }, owner.token))).toEqual({ accountId: owner.accountId, token: owner.token, switched: false });
  });

  it('a second identity of the same provider on one account -> 409 already_linked', async () => {
    const g = await guest();
    await ok(await google(googleToken(), g.token));
    await expectError(await google(googleToken({ sub: '2000002' }), g.token), 409, 'already_linked');
    expect(await store.accountByProvider('google', '2000002')).toBeNull();
  });

  it('switching does not create accounts for the rate limit, new accounts share the guest limit', async () => {
    for (let i = 0; i < 10; i++) await ok(await google(googleToken({ sub: `s${i}` })));
    await expectError(await google(googleToken({ sub: 'one-more' })), 429, 'rate_limited');
    await ok(await google(googleToken({ sub: 's3' }))); // existing identity still signs in
  });

  // ---------------------------------------------------------------- refusals
  it('wrong aud / iss / exp / alg / signature -> 401 invalid_token and nothing linked', async () => {
    const g = await guest();
    const t = Math.floor(clock / 1000);
    const pub = idp.appleKeys[0].publicKey.export({ format: 'pem', type: 'spki' }) as string;
    const bad = [
      appleToken({ aud: 'com.someone.else' }),
      appleToken({ iss: 'https://evil.example' }),
      appleToken({ exp: t - 3600, iat: t - 4000 }),
      noneJwt(appleClaims(clock), 'apple-k1'),
      hs256Jwt(pub, appleClaims(clock), 'apple-k1'),
      signJwt({ ...rsaKey('apple-k1') }, appleClaims(clock)),
      signJwt(idp.googleKeys[0], appleClaims(clock), { kid: 'apple-k1' }),
      googleToken(), // a Google token on the Apple endpoint
    ];
    for (const identityToken of bad) await expectError(await apple({ identityToken }, g.token), 401, 'invalid_token');
    await expectError(await google(appleToken()), 401, 'invalid_token');
    expect((await me(g.token)).providers).toEqual([]);
    expect(await store.accountByProvider('apple', 'apple-sub-1')).toBeNull();
  });

  it('unknown kid refreshes the JWKS (key rotation) and then succeeds', async () => {
    await ok(await apple({ identityToken: appleToken() }));
    expect(idp.count(APPLE_JWKS_URL)).toBe(1);
    const k2 = rsaKey('apple-k2');
    idp.appleKeys.push(k2);
    clock += 61_000;
    const res = await ok(await apple({ identityToken: signJwt(k2, appleClaims(clock, { sub: 'rotated' })) }));
    expect(res.switched).toBe(false);
    expect(idp.count(APPLE_JWKS_URL)).toBe(2);
    expect(idp.count(GOOGLE_JWKS_URL)).toBe(0);
  });

  it('JWKS unreachable and nothing cached -> 503 unavailable', async () => {
    idp.jwksDown = true;
    await expectError(await apple({ identityToken: appleToken() }), 503, 'unavailable');
  });

  it('provider without audiences -> 503 not_configured', async () => {
    await boot({ appleAudiences: [], googleAudiences: undefined });
    await expectError(await apple({ identityToken: appleToken() }), 503, 'not_configured');
    await expectError(await google(googleToken()), 503, 'not_configured');
    expect(idp.calls).toEqual([]);
  });

  it('invalid Bearer -> 401 unauthorized (no silent new account); bad bodies -> 400', async () => {
    await expectError(await apple({ identityToken: appleToken() }, 'A'.repeat(43)), 401, 'unauthorized');
    const r = await fetch(url + '/v1/auth/google', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Basic x' },
      body: JSON.stringify({ idToken: googleToken() }),
    });
    await expectError(r, 401, 'unauthorized');
    for (const body of [{}, { identityToken: 42 }, { identityToken: '' }, { identityToken: appleToken(), fullName: 5 }, { identityToken: appleToken(), authorizationCode: 'bad code!' }, [1]]) {
      await expectError(await apple(body as Record<string, unknown>), 400, 'bad_request');
    }
    await expectError(await post('/v1/auth/google', { identityToken: googleToken() }), 400, 'bad_request');
    expect(await store.accountByProvider('apple', 'apple-sub-1')).toBeNull();
  });

  it('fullName is used only when the account has no name and it is valid', async () => {
    const g = await guest();
    await ok(await apple({ identityToken: appleToken(), fullName: '  Ayşe   Yılmaz ' }, g.token));
    expect((await me(g.token)).displayName).toBe('Ayşe Yılmaz');
    const named = await guest();
    await fetch(url + '/v1/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${named.token}` },
      body: JSON.stringify({ displayName: 'Mehmet' }),
    });
    await ok(await apple({ identityToken: appleToken({ sub: 'apple-sub-2' }), fullName: 'Başka İsim' }, named.token));
    expect((await me(named.token)).displayName).toBe('Mehmet');
    const fresh = await ok(await apple({ identityToken: appleToken({ sub: 'apple-sub-3' }), fullName: 'X' }));
    expect((await me(fresh.token)).displayName).toBeNull(); // too short -> ignored
  });

  it('deleting the account removes its links; the identity can start fresh', async () => {
    const res = await ok(await google(googleToken()));
    expect((await del(res.token)).status).toBe(204);
    expect(await store.accountByProvider('google', '1000001')).toBeNull();
    const again = await ok(await google(googleToken()));
    expect(again.accountId).not.toBe(res.accountId);
    expect(again.switched).toBe(false);
  });

  // ---------------------------------------------------------------- Apple refresh token + revoke
  it('Apple: code -> refresh token stored encrypted; deletion revokes it with an ES256 client_secret', async () => {
    await boot({ appleRevoke: REVOKE_CFG, secret: SECRET });
    const res = await ok(await apple({ identityToken: appleToken(), authorizationCode: 'c0de.Abc-1' }));
    await app.whenIdle();
    const tokenCall = idp.calls.find((c) => c.url === APPLE_TOKEN_URL)!;
    expect(new URLSearchParams(tokenCall.body).get('code')).toBe('c0de.Abc-1');
    const enc = await rawEnc(res.accountId);
    expect(enc).toMatch(/^v1\./);
    expect(enc).not.toContain('RT-');
    if (store instanceof SqliteStore) {
      const row = store.db.prepare('SELECT * FROM account_providers').get() as Record<string, unknown>;
      expect(JSON.stringify(row)).not.toContain('RT-c0de');
    }

    expect((await del(res.token)).status).toBe(204);
    await app.whenIdle();
    const revoke = idp.calls.filter((c) => c.url === APPLE_REVOKE_URL);
    expect(revoke).toHaveLength(1);
    const form = new URLSearchParams(revoke[0].body);
    expect(form.get('token')).toBe('RT-c0de.Abc-1');
    expect(form.get('client_id')).toBe(APPLE_AUD);
    const [h, p, s] = form.get('client_secret')!.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'KEYID12345' });
    expect(JSON.parse(Buffer.from(p, 'base64url').toString())).toMatchObject({ iss: 'TEAMID1234', sub: APPLE_AUD, aud: 'https://appleid.apple.com' });
    expect(cryptoVerify('sha256', Buffer.from(`${h}.${p}`), { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'))).toBe(true);
    expect(await store.accountByProvider('apple', 'apple-sub-1')).toBeNull();
    expect(await store.listProviderLinks(res.accountId)).toEqual([]);
    // tokens never reach the logs
    for (const l of logs) expect(l).not.toMatch(/RT-|c0de|eyJ/);
  });

  it('Apple: a code from another Apple ID (sub mismatch) is not stored', async () => {
    await boot({ appleRevoke: REVOKE_CFG, secret: SECRET });
    idp.tokenSub = 'someone-else';
    const res = await ok(await apple({ identityToken: appleToken(), authorizationCode: 'code1' }));
    await app.whenIdle();
    expect(await rawEnc(res.accountId)).toBeNull();
    expect(logs.join('\n')).toContain('sub mismatch');
  });

  it('Apple: without ACCOUNTS_SECRET or key nothing is exchanged; deletion still succeeds', async () => {
    await boot({ appleRevoke: REVOKE_CFG }); // no secret
    let res = await ok(await apple({ identityToken: appleToken(), authorizationCode: 'code1' }));
    await app.whenIdle();
    expect(idp.count(APPLE_TOKEN_URL)).toBe(0);
    expect(logs.join('\n')).toContain('ACCOUNTS_SECRET missing');
    expect((await del(res.token)).status).toBe(204);
    await app.whenIdle();
    expect(idp.count(APPLE_REVOKE_URL)).toBe(0);

    await boot({ secret: SECRET }); // no key
    res = await ok(await apple({ identityToken: appleToken(), authorizationCode: 'code2' }));
    await app.whenIdle();
    expect(idp.count(APPLE_TOKEN_URL)).toBe(0);
    expect((await del(res.token)).status).toBe(204);

    await boot({ secret: 'too-short', appleRevoke: REVOKE_CFG });
    res = await ok(await apple({ identityToken: appleToken(), authorizationCode: 'code3' }));
    await app.whenIdle();
    expect(idp.count(APPLE_TOKEN_URL)).toBe(0);
  });

  it('Apple: revoke / exchange failures never block sign-in or deletion', async () => {
    await boot({ appleRevoke: REVOKE_CFG, secret: SECRET });
    idp.tokenResponse = () => ({ status: 400, body: { error: 'invalid_grant' } });
    const a = await ok(await apple({ identityToken: appleToken(), authorizationCode: 'code1' }));
    await app.whenIdle();
    expect(await rawEnc(a.accountId)).toBeNull();
    // later sign-in with a fresh code fills the missing refresh token
    idp.tokenResponse = new FakeIdp().tokenResponse;
    await ok(await apple({ identityToken: appleToken(), authorizationCode: 'code2' }, a.token));
    await app.whenIdle();
    expect(await rawEnc(a.accountId)).toMatch(/^v1\./);
    idp.revokeStatus = 500;
    expect((await del(a.token)).status).toBe(204);
    await app.whenIdle();
    expect(idp.count(APPLE_REVOKE_URL)).toBe(1);
    expect(logs.join('\n')).toContain('Apple revoke failed');
    expect(await store.getAccount(a.accountId)).toBeNull();
  });

  it('Apple: account deleted while the code exchange is running -> the new refresh token is revoked at once', async () => {
    await boot({ appleRevoke: REVOKE_CFG, secret: SECRET });
    let release!: () => void;
    idp.tokenGate = new Promise<void>((r) => (release = r));
    const a = await ok(await apple({ identityToken: appleToken(), authorizationCode: 'slow' }));
    expect((await del(a.token)).status).toBe(204);
    release();
    await app.whenIdle();
    const revoke = idp.calls.filter((c) => c.url === APPLE_REVOKE_URL);
    expect(revoke).toHaveLength(1);
    expect(new URLSearchParams(revoke[0].body).get('token')).toBe('RT-slow');
  });

  it('Apple: a stored token sealed with another ACCOUNTS_SECRET is skipped (logged), deletion succeeds', async () => {
    await boot({ appleRevoke: REVOKE_CFG, secret: SECRET });
    const a = await ok(await apple({ identityToken: appleToken(), authorizationCode: 'code1' }));
    await app.whenIdle();
    await boot({ appleRevoke: REVOKE_CFG, secret: SECRET + '-rotated' });
    expect((await del(a.token)).status).toBe(204);
    await app.whenIdle();
    expect(idp.count(APPLE_REVOKE_URL)).toBe(0);
    expect(logs.join('\n')).toContain('cannot be decrypted');
  });
});
