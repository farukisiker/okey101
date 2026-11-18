import { mkdtempSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAccountsApp, DAILY_REPORT_LIMIT, MAX_BLOCKS, summarizeReports, VOICE_BAN_MS, type AccountsApp } from '../src/app';
import { SqliteStore } from '../src/sqliteStore';
import type { AccountStore, ReportRecord } from '../src/store';
import type { AdminReportItem, Me } from '../src/types';
import { listen, storeFactories } from './helpers';

/* E2: reports, voice bans and block lists (store contract + HTTP API). */

const ADMIN = 'admin-token-for-tests-0123456789';
const DAY0 = Date.UTC(2026, 10, 19, 10, 0, 0);
const H = 3600_000;
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

describe.each(storeFactories)('E2 store contract: $name', (factory) => {
  let store: AccountStore;
  let cleanup: () => void;
  beforeEach(async () => {
    ({ store, cleanup } = factory.make());
    for (const id of [A, B, C]) await store.createAccount(id, `h-${id}`, 1);
  });
  afterEach(() => cleanup());

  const rep = (id: string, reporterId: string, targetId: string, createdAt: number): Omit<ReportRecord, 'status'> => ({
    id,
    reporterId,
    targetId,
    reason: 'insult',
    context: 'voice',
    createdAt,
  });

  it('reports: add, count by reporter, list by status/since/target, close', async () => {
    await store.addReport(rep('r1', A, C, 100));
    await store.addReport({ ...rep('r2', B, C, 200), reason: 'askGift', context: null });
    await store.addReport(rep('r3', A, B, 300));
    expect(await store.countReportsBy(A, 0)).toBe(2);
    expect(await store.countReportsBy(A, 150)).toBe(1);
    expect((await store.listReports({ status: 'open', since: 0 })).map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
    const aboutC = await store.listReports({ status: 'open', since: 0, targetId: C });
    expect(aboutC).toEqual([
      { id: 'r1', reporterId: A, targetId: C, reason: 'insult', context: 'voice', createdAt: 100, status: 'open' },
      { id: 'r2', reporterId: B, targetId: C, reason: 'askGift', context: null, createdAt: 200, status: 'open' },
    ]);
    expect((await store.listReports({ status: 'open', since: 150, targetId: C })).map((r) => r.id)).toEqual(['r2']);
    expect(await store.closeReports(C)).toBe(2);
    expect(await store.closeReports(C)).toBe(0);
    expect((await store.listReports({ status: 'open', since: 0 })).map((r) => r.id)).toEqual(['r3']);
    expect((await store.listReports({ status: 'closed', since: 0 })).map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(await store.countReportsBy(A, 0)).toBe(2); // closed still count toward the daily limit
  });

  it('voice bans: set, overwrite, lift', async () => {
    expect(await store.getVoiceBan(A)).toBeNull();
    await store.setVoiceBan(A, 1000);
    await store.setVoiceBan(A, 2000);
    expect(await store.getVoiceBan(A)).toBe(2000);
    await store.setVoiceBan(A, null);
    expect(await store.getVoiceBan(A)).toBeNull();
  });

  it('blocks: ordered, idempotent, limited, removable', async () => {
    expect(await store.addBlock(A, C, 10, 2)).toBe('ok');
    expect(await store.addBlock(A, B, 20, 2)).toBe('ok');
    expect(await store.addBlock(A, B, 30, 2)).toBe('exists');
    expect(await store.addBlock(A, '00000000-0000-4000-8000-0000000000ff', 40, 2)).toBe('limit');
    expect(await store.listBlocks(A)).toEqual([C, B]);
    expect(await store.listBlocks(B)).toEqual([]);
    await store.removeBlock(A, C);
    await store.removeBlock(A, C);
    expect(await store.listBlocks(A)).toEqual([B]);
  });

  it('deleteAccount removes its reports (written and about it), voice ban, block list and entries in other lists', async () => {
    await store.addReport(rep('r1', A, C, 100)); // A wrote
    await store.addReport(rep('r2', C, A, 100)); // about A
    await store.addReport(rep('r3', B, C, 100)); // unrelated
    await store.setVoiceBan(A, 5000);
    await store.addBlock(A, B, 1, 10);
    await store.addBlock(B, A, 1, 10);
    await store.addBlock(B, C, 2, 10);
    await store.deleteAccount(A);
    expect((await store.listReports({ status: 'open', since: 0 })).map((r) => r.id)).toEqual(['r3']);
    expect(await store.getVoiceBan(A)).toBeNull();
    expect(await store.listBlocks(A)).toEqual([]);
    expect(await store.listBlocks(B)).toEqual([C]);
  });
});

describe('E2 schema migration', () => {
  it('an E1 database file gets the E2 tables on open', () => {
    const dir = mkdtempSync(join(tmpdir(), 'kahve-e2-'));
    const file = join(dir, 'accounts.db');
    try {
      const old = new DatabaseSync(file);
      old.exec('CREATE TABLE accounts (id TEXT PRIMARY KEY, display_name TEXT, created_at BIGINT NOT NULL, photo_consent_version INTEGER NOT NULL DEFAULT 0, photo_seq INTEGER NOT NULL DEFAULT 0);');
      old.exec("INSERT INTO accounts (id, created_at) VALUES ('x', 1);");
      old.close();
      const s = new SqliteStore(file);
      const tables = s.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => String(r.name));
      expect(tables).toEqual(expect.arrayContaining(['accounts', 'reports', 'voice_bans', 'blocks']));
      s.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('summarizeReports', () => {
  it('groups by target, counts reasons/contexts/reporters, most reporters first', () => {
    const r = (reporterId: string, targetId: string, at: number, reason: ReportRecord['reason'] = 'spam'): ReportRecord => ({
      id: `${reporterId}${targetId}${at}`,
      reporterId,
      targetId,
      reason,
      context: at % 2 ? 'saying' : null,
      createdAt: at,
      status: 'open',
    });
    expect(summarizeReports([r(A, C, 1), r(A, C, 2, 'insult'), r(A, B, 3), r(C, B, 4)])).toEqual([
      { targetAccountId: B, count: 2, reporters: 2, reasons: { spam: 2 }, contexts: { saying: 1 }, lastAt: 4 },
      { targetAccountId: C, count: 2, reporters: 1, reasons: { spam: 1, insult: 1 }, contexts: { saying: 1 }, lastAt: 2 },
    ]);
  });
});

describe.each(storeFactories)('E2 HTTP API on $name', (factory) => {
  let store: AccountStore;
  let cleanup: () => void;
  let app: AccountsApp;
  let url: string;
  let close: () => Promise<void>;
  let clock: number;

  beforeEach(async () => {
    ({ store, cleanup } = factory.make());
    clock = DAY0;
    app = createAccountsApp({ store, moderation: [], adminToken: ADMIN, now: () => clock, log: () => {} });
    ({ url, close } = await listen(app));
  });
  afterEach(async () => {
    await app.whenIdle();
    await close();
    cleanup();
  });

  const req = (path: string, init: RequestInit = {}) => fetch(url + path, init);
  const auth = (token: string, extra: Record<string, string> = {}) => ({ authorization: `Bearer ${token}`, ...extra });
  async function guest(): Promise<{ accountId: string; token: string }> {
    const r = await req('/v1/accounts/guest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(r.status).toBe(201);
    return r.json();
  }
  async function me(token: string): Promise<Me> {
    return (await req('/v1/me', { headers: auth(token) })).json();
  }
  const report = (token: string, body: unknown) =>
    req('/v1/reports', { method: 'POST', headers: auth(token, { 'content-type': 'application/json' }), body: JSON.stringify(body) });
  const adminReports = async (status = 'open'): Promise<AdminReportItem[]> =>
    (await req(`/admin/v1/reports?status=${status}`, { headers: auth(ADMIN) })).json();

  it('POST /v1/reports: validation, self 400, unknown target 404, 204', async () => {
    const a = await guest();
    const t = await guest();
    expect((await req('/v1/reports', { method: 'POST' })).status).toBe(401);
    for (const bad of [
      {},
      { targetAccountId: t.accountId },
      { targetAccountId: t.accountId, reason: 'rude' },
      { targetAccountId: 'not-a-uuid', reason: 'spam' },
      { targetAccountId: t.accountId.toUpperCase(), reason: 'spam' },
      { targetAccountId: t.accountId, reason: 'spam', context: 'chat' },
      [],
    ]) {
      const r = await report(a.token, bad);
      expect(r.status, JSON.stringify(bad)).toBe(400);
      expect(await r.json()).toEqual({ error: 'bad_request' });
    }
    expect((await report(a.token, { targetAccountId: a.accountId, reason: 'spam' })).status).toBe(400);
    expect((await report(a.token, { targetAccountId: '00000000-0000-4000-8000-000000000999', reason: 'spam' })).status).toBe(404);
    expect((await report(a.token, { targetAccountId: t.accountId, reason: 'askGift', context: 'saying' })).status).toBe(204);
    expect((await report(a.token, { targetAccountId: t.accountId, reason: 'other', context: null })).status).toBe(204);
    expect((await report(a.token, { targetAccountId: t.accountId, reason: 'harass' })).status).toBe(204);
    expect((await me(t.token)).voiceBannedUntil).toBeNull(); // one person, three reports: no ban
  });

  it('20 reports per account per 24 h', async () => {
    const a = await guest();
    const t = await guest();
    for (let i = 0; i < DAILY_REPORT_LIMIT; i++) {
      expect((await report(a.token, { targetAccountId: t.accountId, reason: 'spam' })).status).toBe(204);
    }
    const r = await report(a.token, { targetAccountId: t.accountId, reason: 'spam' });
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: 'rate_limited' });
    clock += 24 * H + 1;
    expect((await report(a.token, { targetAccountId: t.accountId, reason: 'spam' })).status).toBe(204);
  });

  it('3 different reporters within 7 days -> voiceBannedUntil = now + 24 h; window and expiry respected', async () => {
    const t = await guest();
    const [r1, r2, r3, r4] = [await guest(), await guest(), await guest(), await guest()];
    expect((await me(t.token)).voiceBannedUntil).toBeNull();
    await report(r1.token, { targetAccountId: t.accountId, reason: 'insult', context: 'voice' });
    clock += 6 * 24 * H; // still inside 7 days
    await report(r2.token, { targetAccountId: t.accountId, reason: 'insult', context: 'voice' });
    await report(r2.token, { targetAccountId: t.accountId, reason: 'insult' }); // same person again: no ban
    expect((await me(t.token)).voiceBannedUntil).toBeNull();
    clock += H;
    await report(r3.token, { targetAccountId: t.accountId, reason: 'harass', context: 'voice' });
    const bannedAt = clock;
    expect((await me(t.token)).voiceBannedUntil).toBe(bannedAt + VOICE_BAN_MS);
    expect((await me(r1.token)).voiceBannedUntil).toBeNull();

    // Admin list: grouped, names, ban shown.
    const list = await adminReports();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      targetAccountId: t.accountId,
      count: 4,
      reporters: 3,
      reasons: { insult: 3, harass: 1 },
      contexts: { voice: 3 },
      lastAt: bannedAt,
      voiceBannedUntil: bannedAt + VOICE_BAN_MS,
    });

    clock = bannedAt + VOICE_BAN_MS + 1;
    expect((await me(t.token)).voiceBannedUntil).toBeNull(); // expired
    // r1's report is now older than 7 days: r4 makes only 3 (r2, r3, r4) -> banned again
    await report(r4.token, { targetAccountId: t.accountId, reason: 'spam' });
    expect((await me(t.token)).voiceBannedUntil).toBe(clock + VOICE_BAN_MS);
  });

  it('a target outside the window is not banned by old reports', async () => {
    const t = await guest();
    const [r1, r2, r3] = [await guest(), await guest(), await guest()];
    await report(r1.token, { targetAccountId: t.accountId, reason: 'spam' });
    await report(r2.token, { targetAccountId: t.accountId, reason: 'spam' });
    clock += 7 * 24 * H + 1;
    await report(r3.token, { targetAccountId: t.accountId, reason: 'spam' });
    expect((await me(t.token)).voiceBannedUntil).toBeNull();
  });

  it('admin: reports list needs the admin token; close dismisses and lifts the ban; /admin?tab=reports renders escaped', async () => {
    const t = await guest();
    await req('/v1/me', { method: 'PATCH', headers: auth(t.token, { 'content-type': 'application/json' }), body: JSON.stringify({ displayName: '<b>x</b>' }) });
    for (const g of [await guest(), await guest(), await guest()]) await report(g.token, { targetAccountId: t.accountId, reason: 'insult' });
    expect((await me(t.token)).voiceBannedUntil).not.toBeNull();

    expect((await req('/admin/v1/reports')).status).toBe(401);
    expect((await req('/admin/v1/reports', { headers: auth(t.token) })).status).toBe(401);
    expect((await req('/admin/v1/reports?status=weird', { headers: auth(ADMIN) })).status).toBe(400);
    expect((await req(`/admin/v1/reports/${t.accountId}/close`, { method: 'POST' })).status).toBe(401);

    let r = await req('/admin?tab=reports');
    expect(r.status).toBe(401);
    let html = await r.text();
    expect(html).not.toContain(t.accountId);
    expect(html).toContain('id="login"');
    r = await req('/admin?tab=reports', { headers: auth(ADMIN) });
    expect(r.status).toBe(200);
    html = await r.text();
    expect(html).toContain(t.accountId);
    expect(html).toContain('Şikâyetler');
    expect(html).not.toContain('<b>x</b>');
    expect(html).toContain('data-query="?tab=reports"');
    expect(html).not.toContain(ADMIN);

    const closed = await req(`/admin/v1/reports/${t.accountId}/close`, { method: 'POST', headers: auth(ADMIN) });
    expect(await closed.json()).toEqual({ accountId: t.accountId, closed: 3 });
    expect(await adminReports()).toEqual([]);
    expect((await adminReports('closed'))[0]).toMatchObject({ targetAccountId: t.accountId, count: 3, voiceBannedUntil: null });
    expect((await me(t.token)).voiceBannedUntil).toBeNull();
  });

  it('blocks: list, put (idempotent), delete, self/invalid 400, limit 409', async () => {
    const a = await guest();
    const b = await guest();
    const list = async () => (await (await req('/v1/blocks', { headers: auth(a.token) })).json()) as { blocked: string[] };
    expect((await req('/v1/blocks')).status).toBe(401);
    expect(await list()).toEqual({ blocked: [] });
    expect((await req(`/v1/blocks/${b.accountId}`, { method: 'PUT', headers: auth(a.token) })).status).toBe(204);
    expect((await req(`/v1/blocks/${b.accountId}`, { method: 'PUT', headers: auth(a.token) })).status).toBe(204);
    expect(await list()).toEqual({ blocked: [b.accountId] });
    expect((await req(`/v1/blocks/${a.accountId}`, { method: 'PUT', headers: auth(a.token) })).status).toBe(400);
    expect((await req('/v1/blocks/nope', { method: 'PUT', headers: auth(a.token) })).status).toBe(400);
    expect((await req('/v1/blocks/nope', { method: 'DELETE', headers: auth(a.token) })).status).toBe(400);
    expect((await req(`/v1/blocks/${b.accountId}`, { method: 'DELETE', headers: auth(a.token) })).status).toBe(204);
    expect((await req(`/v1/blocks/${b.accountId}`, { method: 'DELETE', headers: auth(a.token) })).status).toBe(204);
    expect(await list()).toEqual({ blocked: [] });

    // Fill to the limit through the store (fast), then the API refuses a new one.
    for (let i = 0; i < MAX_BLOCKS; i++) {
      await store.addBlock(a.accountId, `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, i, MAX_BLOCKS);
    }
    const r = await req(`/v1/blocks/${b.accountId}`, { method: 'PUT', headers: auth(a.token) });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: 'limit_reached' });
    expect((await list()).blocked).toHaveLength(MAX_BLOCKS);
  });

  it('DELETE /v1/me clears the reports it wrote, the reports about it and its blocks', async () => {
    const a = await guest();
    const b = await guest();
    await report(a.token, { targetAccountId: b.accountId, reason: 'spam' });
    await report(b.token, { targetAccountId: a.accountId, reason: 'spam' });
    await req(`/v1/blocks/${b.accountId}`, { method: 'PUT', headers: auth(a.token) });
    await req(`/v1/blocks/${a.accountId}`, { method: 'PUT', headers: auth(b.token) });
    expect((await req('/v1/me', { method: 'DELETE', headers: auth(a.token) })).status).toBe(204);
    expect(await adminReports()).toEqual([]);
    expect(await store.listBlocks(a.accountId)).toEqual([]);
    expect(await (await req('/v1/blocks', { headers: auth(b.token) })).json()).toEqual({ blocked: [] });
  });
});
