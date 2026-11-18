import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAccountsApp, type AccountsApp } from '../src/app';
import { claudeVision, openaiModeration, type ModerationLayer } from '../src/moderation';
import type { AccountStore } from '../src/store';
import type { Me } from '../src/types';
import { COM_SECRET, EXIF_SECRET, FakeLayer, listen, makeJpeg, storeFactories } from './helpers';

const ADMIN = 'admin-token-for-tests-0123456789';
const DAY0 = Date.UTC(2026, 10, 18, 10, 0, 0);

describe.each(storeFactories)('accounts HTTP API on $name', (factory) => {
  let store: AccountStore;
  let cleanup: () => void;
  let app: AccountsApp;
  let url: string;
  let close: () => Promise<void>;
  let clock: number;
  let layer1: FakeLayer;
  let layer2: FakeLayer;
  let deleted: string[];

  async function boot(layers?: ModerationLayer[], adminToken: string | null = ADMIN) {
    if (close) await close();
    app = createAccountsApp({
      store,
      moderation: layers ?? [layer1, layer2],
      adminToken: adminToken ?? undefined,
      now: () => clock,
      moderationTimeoutMs: 200,
      onAccountDeleted: (id) => void deleted.push(id),
      log: () => {},
    });
    ({ url, close } = await listen(app));
  }

  beforeEach(async () => {
    ({ store, cleanup } = factory.make());
    clock = DAY0;
    layer1 = new FakeLayer('l1');
    layer2 = new FakeLayer('l2');
    deleted = [];
    close = undefined as never;
    await boot();
  });
  afterEach(async () => {
    await app.whenIdle();
    await close();
    cleanup();
  });

  // ---------------------------------------------------------------- helpers
  const req = (path: string, init: RequestInit = {}) => fetch(url + path, init);
  const auth = (token: string, extra: Record<string, string> = {}) => ({ authorization: `Bearer ${token}`, ...extra });
  async function guest(): Promise<{ accountId: string; token: string }> {
    const r = await req('/v1/accounts/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(r.status).toBe(201);
    return r.json();
  }
  async function me(token: string): Promise<Me> {
    const r = await req('/v1/me', { headers: auth(token) });
    expect(r.status).toBe(200);
    return r.json();
  }
  const sendJson = (method: string, path: string, token: string, body: unknown) =>
    req(path, { method, headers: auth(token, { 'content-type': 'application/json' }), body: typeof body === 'string' ? body : JSON.stringify(body) });
  const consent = (token: string) => sendJson('POST', '/v1/me/consent', token, { kind: 'photo', version: 1 });
  const upload = (token: string, body: Buffer, type = 'image/jpeg') =>
    req('/v1/me/photo', { method: 'POST', headers: auth(token, { 'content-type': type }), body: new Uint8Array(body) });
  const adminGet = (path: string, token = ADMIN) => req(path, { headers: auth(token) });
  const decide = (accountId: string, body: unknown, token = ADMIN) => sendJson('POST', `/admin/v1/photos/${accountId}/decision`, token, body);
  async function readyUser() {
    const g = await guest();
    expect((await consent(g.token)).status).toBe(200);
    return g;
  }

  // ---------------------------------------------------------------- accounts
  it('POST /v1/accounts/guest -> 201, token works, fresh Me', async () => {
    const g = await guest();
    expect(g.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await me(g.token)).toEqual({
      accountId: g.accountId,
      displayName: null,
      photoConsent: false,
      uploadsLeftToday: 3,
      photo: { status: 'none', reasons: [], url: null },
      providers: [],
    });
  });

  it('stores only the sha256 of the token', async () => {
    const g = await guest();
    expect(await store.accountByTokenHash(g.token)).toBeNull();
  });

  it('guest creation is limited to 10 per IP per hour', async () => {
    for (let i = 0; i < 10; i++) await guest();
    const r = await req('/v1/accounts/guest', { method: 'POST' });
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: 'rate_limited' });
    clock += 3600_001;
    await guest();
  });

  it.each([
    ['GET', '/v1/me'],
    ['PATCH', '/v1/me'],
    ['POST', '/v1/me/consent'],
    ['POST', '/v1/me/photo'],
    ['DELETE', '/v1/me/photo'],
    ['DELETE', '/v1/me'],
  ])('%s %s without/with bad token -> 401', async (method, path) => {
    for (const headers of <Array<Record<string, string>>>[{}, { authorization: 'Bearer nope' }, { authorization: `Bearer ${'A'.repeat(43)}` }, { authorization: 'Basic abc' }]) {
      const r = await req(path, { method, headers });
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: 'unauthorized' });
    }
  });

  it('PATCH /v1/me validates and trims displayName', async () => {
    const g = await guest();
    let r = await sendJson('PATCH', '/v1/me', g.token, { displayName: '   Ayşe   Teyze  ' });
    expect(r.status).toBe(200);
    expect(((await r.json()) as Me).displayName).toBe('Ayşe Teyze');
    for (const bad of [{ displayName: 'A' }, { displayName: 'x'.repeat(17) }, { displayName: 42 }, { displayName: 'ab\u0000c' }, [1]]) {
      r = await sendJson('PATCH', '/v1/me', g.token, bad);
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ error: 'bad_request' });
    }
    expect((await sendJson('PATCH', '/v1/me', g.token, '{bad json')).status).toBe(400);
    r = await sendJson('PATCH', '/v1/me', g.token, { displayName: 'x'.repeat(5000) });
    expect(r.status).toBe(413);
    expect(await r.json()).toEqual({ error: 'too_large' });
    expect((await me(g.token)).displayName).toBe('Ayşe Teyze');
    // 16 code points incl. Turkish letters is fine
    expect((await sendJson('PATCH', '/v1/me', g.token, { displayName: 'ĞÜŞİÖÇğüşıöç1234' })).status).toBe(200);
  });

  it('POST /v1/me/consent', async () => {
    const g = await guest();
    expect((await sendJson('POST', '/v1/me/consent', g.token, { kind: 'photo', version: 2 })).status).toBe(400);
    expect((await sendJson('POST', '/v1/me/consent', g.token, { kind: 'chat', version: 1 })).status).toBe(400);
    const r = await consent(g.token);
    expect(r.status).toBe(200);
    expect(((await r.json()) as Me).photoConsent).toBe(true);
  });

  // ---------------------------------------------------------------- photo upload
  it('photo without consent -> 403 consent_required', async () => {
    const g = await guest();
    const r = await upload(g.token, makeJpeg());
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ error: 'consent_required' });
  });

  it('upload -> 202 pending -> approved; public URL serves the EXIF-free JPEG', async () => {
    const g = await readyUser();
    const r = await upload(g.token, makeJpeg({ trailing: true }));
    expect(r.status).toBe(202);
    const pending = (await r.json()) as Me;
    expect(pending.photo).toEqual({ status: 'pending', reasons: [], url: null });
    expect(pending.uploadsLeftToday).toBe(2);
    await app.whenIdle();
    const m = await me(g.token);
    expect(m.photo.status).toBe('approved');
    expect(m.photo.url).toMatch(new RegExp(`^/v1/photos/${g.accountId}\\.jpg\\?v=\\d+$`));
    const img = await req(m.photo.url!);
    expect(img.status).toBe(200);
    expect(img.headers.get('content-type')).toBe('image/jpeg');
    expect(img.headers.get('cache-control')).toBe('public, max-age=300');
    const bytes = Buffer.from(await img.arrayBuffer());
    expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(bytes.includes(EXIF_SECRET)).toBe(false);
    expect(bytes.includes(COM_SECRET)).toBe(false);
    expect(layer1.calls).toBe(1);
    expect(layer2.calls).toBe(1);
  });

  it('a photo is not public while pending/review/rejected (404), even to its owner', async () => {
    const owner = await readyUser();
    let release!: () => void;
    layer1.gate = new Promise((r) => (release = r));
    await upload(owner.token, makeJpeg());
    const path = `/v1/photos/${owner.accountId}.jpg`;
    expect((await req(path)).status).toBe(404); // pending
    expect((await req(path, { headers: auth(owner.token) })).status).toBe(404);
    layer1.next = { verdict: 'review', reasons: ['otherPerson'] };
    release();
    await app.whenIdle();
    const m = await me(owner.token);
    expect(m.photo).toEqual({ status: 'review', reasons: [], url: null }); // reasons hidden while in review
    expect((await req(path)).status).toBe(404);
    expect((await req('/v1/photos/not-a-uuid.jpg')).status).toBe(404);
    expect((await req(`/v1/photos/${owner.accountId}.png`)).status).toBe(404);
  });

  it('bad images -> 400 bad_image; >150 KB -> 413 too_large; nothing counted', async () => {
    const g = await readyUser();
    for (const [body, type] of [
      [Buffer.from('definitely not a jpeg'), 'image/jpeg'],
      [makeJpeg().subarray(0, 50), 'image/jpeg'],
      [makeJpeg(), 'image/png'],
      [makeJpeg({ width: 600, height: 400 }), 'image/jpeg'],
      [makeJpeg({ width: 512, height: 513 }), 'image/jpeg'],
    ] as Array<[Buffer, string]>) {
      const r = await upload(g.token, body, type);
      expect(r.status).toBe(400);
      expect(await r.json()).toEqual({ error: 'bad_image' });
    }
    const big = makeJpeg({ salt: 'x'.repeat(160 * 1024) });
    const r = await upload(g.token, big);
    expect(r.status).toBe(413);
    expect(await r.json()).toEqual({ error: 'too_large' });
    expect((await me(g.token)).uploadsLeftToday).toBe(3);
    expect((await upload(g.token, makeJpeg({ width: 512, height: 512 }))).status).toBe(202);
  });

  it('4th upload in a UTC day -> 429; counter survives a restart and resets next UTC day', async () => {
    const g = await readyUser();
    for (let i = 0; i < 3; i++) expect((await upload(g.token, makeJpeg({ salt: `s${i}` }))).status).toBe(202);
    let r = await upload(g.token, makeJpeg({ salt: 's3' }));
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: 'rate_limited' });
    expect((await me(g.token)).uploadsLeftToday).toBe(0);
    await app.whenIdle();
    await boot(); // new app instance, same store
    expect((await upload(g.token, makeJpeg({ salt: 's4' }))).status).toBe(429);
    clock = Date.UTC(2026, 10, 19, 0, 0, 1);
    expect((await me(g.token)).uploadsLeftToday).toBe(3);
    r = await upload(g.token, makeJpeg({ salt: 's5' }));
    expect(r.status).toBe(202);
  });

  it('a new upload unpublishes the old approved photo immediately', async () => {
    const g = await readyUser();
    await upload(g.token, makeJpeg({ salt: 'old' }));
    await app.whenIdle();
    const oldUrl = (await me(g.token)).photo.url!;
    expect((await req(oldUrl)).status).toBe(200);
    let release!: () => void;
    layer1.gate = new Promise((r) => (release = r));
    await upload(g.token, makeJpeg({ salt: 'new' }));
    expect((await req(oldUrl)).status).toBe(404);
    release();
    await app.whenIdle();
    const newUrl = (await me(g.token)).photo.url!;
    expect(newUrl).not.toBe(oldUrl);
  });

  it('a stale moderation result does not overwrite a newer upload', async () => {
    const g = await readyUser();
    let releaseOld!: () => void;
    layer1.gate = new Promise((r) => (releaseOld = r));
    layer1.next = { verdict: 'reject', reasons: ['nudity'] };
    await upload(g.token, makeJpeg({ salt: 'first' }));
    layer1.gate = null;
    layer1.next = { verdict: 'ok', reasons: [] };
    // second upload resolves immediately (approved), then the first finishes with "reject"
    await upload(g.token, makeJpeg({ salt: 'second' }));
    await new Promise((r) => setTimeout(r, 20));
    layer1.next = { verdict: 'reject', reasons: ['nudity'] };
    releaseOld();
    await app.whenIdle();
    expect((await me(g.token)).photo.status).toBe('approved');
  });

  it('moderation merge: any reject -> rejected with reasons, review -> review', async () => {
    const g = await readyUser();
    layer2.next = { verdict: 'reject', reasons: ['text'] };
    await upload(g.token, makeJpeg({ salt: 'a' }));
    await app.whenIdle();
    expect((await me(g.token)).photo).toEqual({ status: 'rejected', reasons: ['text'], url: null });
    layer2.next = { verdict: 'review', reasons: ['child'] };
    await upload(g.token, makeJpeg({ salt: 'b' }));
    await app.whenIdle();
    expect((await me(g.token)).photo.status).toBe('review');
  });

  it('missing API keys -> review, never approved', async () => {
    await boot([openaiModeration({ apiKey: undefined }), claudeVision({ apiKey: undefined })]);
    const g = await readyUser();
    await upload(g.token, makeJpeg());
    await app.whenIdle();
    expect((await me(g.token)).photo.status).toBe('review');
  });

  it('a hanging layer times out -> review', async () => {
    layer1.gate = new Promise(() => {});
    const g = await readyUser();
    await upload(g.token, makeJpeg());
    await app.whenIdle();
    expect((await me(g.token)).photo.status).toBe('review');
  });

  it('auto-rejected file is blocklisted: the same file is rejected again without calling the layers', async () => {
    const a = await readyUser();
    layer1.next = { verdict: 'reject', reasons: ['violence'] };
    await upload(a.token, makeJpeg({ salt: 'bad' }));
    await app.whenIdle();
    expect(layer1.calls).toBe(1);
    layer1.next = { verdict: 'ok', reasons: [] };
    const b = await readyUser();
    // same pixels, different EXIF: still the same file after stripping
    await upload(b.token, makeJpeg({ salt: 'bad', exif: false }));
    await app.whenIdle();
    expect(layer1.calls).toBe(1);
    expect((await me(b.token)).photo).toEqual({ status: 'rejected', reasons: ['violence'], url: null });
  });

  it('DELETE /v1/me/photo removes the photo', async () => {
    const g = await readyUser();
    await upload(g.token, makeJpeg());
    await app.whenIdle();
    const url0 = (await me(g.token)).photo.url!;
    const r = await req('/v1/me/photo', { method: 'DELETE', headers: auth(g.token) });
    expect(r.status).toBe(200);
    expect(((await r.json()) as Me).photo).toEqual({ status: 'none', reasons: [], url: null });
    expect((await req(url0)).status).toBe(404);
  });

  it('DELETE /v1/me -> 204; token invalid, photo 404, data gone, hook called', async () => {
    const g = await readyUser();
    await sendJson('PATCH', '/v1/me', g.token, { displayName: 'Hasan' });
    await upload(g.token, makeJpeg());
    await app.whenIdle();
    const photoUrl = (await me(g.token)).photo.url!;
    const r = await req('/v1/me', { method: 'DELETE', headers: auth(g.token) });
    expect(r.status).toBe(204);
    expect((await req('/v1/me', { headers: auth(g.token) })).status).toBe(401);
    expect((await req(photoUrl)).status).toBe(404);
    expect(await store.getAccount(g.accountId)).toBeNull();
    expect(await store.getPhoto(g.accountId)).toBeNull();
    expect(deleted).toEqual([g.accountId]);
  });

  // ---------------------------------------------------------------- admin
  it('admin endpoints reject missing/wrong tokens, and are disabled without ADMIN_TOKEN', async () => {
    const g = await readyUser();
    await upload(g.token, makeJpeg());
    await app.whenIdle();
    const paths: Array<[string, string]> = [
      ['GET', '/admin/v1/photos?status=review'],
      ['GET', `/admin/v1/photos/${g.accountId}/image`],
      ['POST', `/admin/v1/photos/${g.accountId}/decision`],
    ];
    for (const token of [undefined, 'wrong-token-wrong-token', g.token, ADMIN + 'x']) {
      for (const [method, path] of paths) {
        const headers: Record<string, string> = token ? auth(token, { 'content-type': 'application/json' }) : {};
        const r = await req(path, { method, headers, body: method === 'POST' ? '{"decision":"approve"}' : undefined });
        expect(r.status).toBe(401);
      }
    }
    await boot(undefined, null);
    expect((await adminGet('/admin/v1/photos')).status).toBe(401);
    await boot(undefined, 'short');
    expect((await adminGet('/admin/v1/photos', 'short')).status).toBe(401);
  });

  it('review queue: list, image, approve -> public; reject -> reasons + blocklist', async () => {
    layer1.next = { verdict: 'review', reasons: ['otherPerson'] };
    const a = await readyUser();
    await sendJson('PATCH', '/v1/me', a.token, { displayName: 'Fatma' });
    const b = await readyUser();
    await upload(a.token, makeJpeg({ salt: 'A' }));
    clock += 1000;
    await upload(b.token, makeJpeg({ salt: 'B' }));
    await app.whenIdle();
    expect(layer2.calls).toBe(2); // review does not stop layer 2

    let r = await adminGet('/admin/v1/photos?status=review');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual([
      { accountId: a.accountId, displayName: 'Fatma', status: 'review', reasons: ['otherPerson'], uploadedAt: DAY0 },
      { accountId: b.accountId, displayName: null, status: 'review', reasons: ['otherPerson'], uploadedAt: DAY0 + 1000 },
    ]);
    expect((await adminGet('/admin/v1/photos?status=bogus')).status).toBe(400);

    r = await adminGet(`/admin/v1/photos/${a.accountId}/image`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await r.arrayBuffer()).includes(EXIF_SECRET)).toBe(false);
    expect((await adminGet(`/admin/v1/photos/00000000-0000-4000-8000-000000000000/image`)).status).toBe(404);

    expect((await decide(a.accountId, { decision: 'maybe' })).status).toBe(400);
    expect((await decide(a.accountId, { decision: 'reject', reason: 'ugly' })).status).toBe(400);
    expect((await decide('00000000-0000-4000-8000-000000000000', { decision: 'approve' })).status).toBe(404);

    r = await decide(a.accountId, { decision: 'approve' });
    expect(r.status).toBe(200);
    const ma = await me(a.token);
    expect(ma.photo.status).toBe('approved');
    expect((await req(ma.photo.url!)).status).toBe(200);

    r = await decide(b.accountId, { decision: 'reject', reason: 'document' });
    expect(r.status).toBe(200);
    expect((await me(b.token)).photo).toEqual({ status: 'rejected', reasons: ['document'], url: null });
    expect(await (await adminGet('/admin/v1/photos?status=review')).json()).toEqual([]);

    // the rejected file is now blocklisted
    const c = await readyUser();
    const before = layer1.calls;
    await upload(c.token, makeJpeg({ salt: 'B' }));
    await app.whenIdle();
    expect(layer1.calls).toBe(before);
    expect((await me(c.token)).photo.status).toBe('rejected');
  });

  it('admin approve lifts a blocklist entry', async () => {
    layer1.next = { verdict: 'reject', reasons: ['symbol'] };
    const a = await readyUser();
    await upload(a.token, makeJpeg({ salt: 'flag' }));
    await app.whenIdle();
    expect((await decide(a.accountId, { decision: 'approve' })).status).toBe(200);
    layer1.next = { verdict: 'ok', reasons: [] };
    const b = await readyUser();
    await upload(b.token, makeJpeg({ salt: 'flag' }));
    await app.whenIdle();
    expect((await me(b.token)).photo.status).toBe('approved');
  });

  it('GET /admin: 401 shell without data; with token, server-rendered list with escaped names and no token', async () => {
    layer1.next = { verdict: 'review', reasons: [] };
    const evil = '<img src=x onerror=alert(1)>';
    const g = await readyUser();
    // 16-char limit: use a shorter payload that still contains markup
    const shortEvil = '<b onclick=x>"\'';
    expect((await sendJson('PATCH', '/v1/me', g.token, { displayName: shortEvil })).status).toBe(200);
    expect((await sendJson('PATCH', '/v1/me', g.token, { displayName: evil })).status).toBe(400);
    await upload(g.token, makeJpeg());
    await app.whenIdle();

    let r = await req('/admin');
    expect(r.status).toBe(401);
    let html = await r.text();
    expect(r.headers.get('content-type')).toMatch(/text\/html/);
    expect(html).not.toContain(g.accountId);
    expect(html).toContain('id="login"');

    r = await adminGet('/admin');
    expect(r.status).toBe(200);
    html = await r.text();
    const csp = r.headers.get('content-security-policy')!;
    expect(csp).toContain("script-src 'nonce-");
    expect(csp).toContain('img-src blob:');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(html).toContain(g.accountId);
    expect(html).not.toContain('<b onclick');
    expect(html).toContain('&#60;b onclick=x&#62;&#34;&#39;');
    expect(html).not.toContain(ADMIN);
    expect(html).not.toMatch(/\?token=|access_token/);
    // every <script> carries the nonce from the CSP header
    const nonce = /'nonce-([^']+)'/.exec(csp)![1];
    const scripts = html.match(/<script[^>]*>/g) ?? [];
    expect(scripts.length).toBe(1);
    expect(scripts[0]).toContain(`nonce="${nonce}"`);
  });

  it('unknown routes -> 404 not_found JSON', async () => {
    const r = await req('/v1/nope');
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: 'not_found' });
    expect(r.headers.get('x-powered-by')).toBeNull();
  });
});
