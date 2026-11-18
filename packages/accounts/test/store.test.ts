import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SqliteStore } from '../src/sqliteStore';
import type { AccountStore } from '../src/store';
import { storeFactories } from './helpers';

describe.each(storeFactories)('AccountStore contract: $name', (factory) => {
  let store: AccountStore;
  let cleanup: () => void;
  beforeEach(() => {
    ({ store, cleanup } = factory.make());
  });
  afterEach(() => cleanup());

  it('creates accounts and finds them by token hash', async () => {
    await store.createAccount('a1', 'h1', 1000);
    expect(await store.accountByTokenHash('h1')).toEqual({ id: 'a1', displayName: null, createdAt: 1000, photoConsentVersion: 0 });
    expect(await store.accountByTokenHash('nope')).toBeNull();
    expect(await store.getAccount('missing')).toBeNull();
  });

  it('stores display name (unicode) and consent', async () => {
    await store.createAccount('a1', 'h1', 1);
    await store.setDisplayName('a1', 'Ayşe Öğün');
    await store.setConsent('a1', 'photo', 1, 2);
    const a = await store.getAccount('a1');
    expect(a?.displayName).toBe('Ayşe Öğün');
    expect(a?.photoConsentVersion).toBe(1);
  });

  it('puts photos with increasing versions and returns bytes intact', async () => {
    await store.createAccount('a1', 'h1', 1);
    const jpeg = Buffer.from([0xff, 0xd8, 0, 1, 2, 255, 0xff, 0xd9]);
    const v1 = await store.putPhoto('a1', { jpeg, sha256: 's1', status: 'pending', uploadedAt: 10 });
    const v2 = await store.putPhoto('a1', { jpeg, sha256: 's2', status: 'pending', uploadedAt: 20 });
    expect(v2).toBeGreaterThan(v1);
    const p = await store.getPhoto('a1');
    expect(p?.jpeg.equals(jpeg)).toBe(true);
    expect(p).toMatchObject({ accountId: 'a1', sha256: 's2', status: 'pending', reasons: [], uploadedAt: 20, version: v2 });
    expect(await store.getPhotoMeta('a1')).not.toHaveProperty('jpeg');
  });

  it('version keeps growing after delete + re-upload (cache busting)', async () => {
    await store.createAccount('a1', 'h1', 1);
    const v1 = await store.putPhoto('a1', { jpeg: Buffer.from([1]), sha256: 's', status: 'pending', uploadedAt: 1 });
    await store.deletePhoto('a1');
    expect(await store.getPhoto('a1')).toBeNull();
    const v2 = await store.putPhoto('a1', { jpeg: Buffer.from([1]), sha256: 's', status: 'pending', uploadedAt: 2 });
    expect(v2).toBeGreaterThan(v1);
  });

  it('setPhotoStatus honours the version guard', async () => {
    await store.createAccount('a1', 'h1', 1);
    const v1 = await store.putPhoto('a1', { jpeg: Buffer.from([1]), sha256: 's1', status: 'pending', uploadedAt: 1 });
    const v2 = await store.putPhoto('a1', { jpeg: Buffer.from([2]), sha256: 's2', status: 'pending', uploadedAt: 2 });
    expect(await store.setPhotoStatus('a1', 'approved', [], v1)).toBe(false);
    expect((await store.getPhotoMeta('a1'))?.status).toBe('pending');
    expect(await store.setPhotoStatus('a1', 'rejected', ['text', 'symbol'], v2)).toBe(true);
    expect(await store.getPhotoMeta('a1')).toMatchObject({ status: 'rejected', reasons: ['text', 'symbol'] });
    expect(await store.setPhotoStatus('nobody', 'approved', [])).toBe(false);
  });

  it('lists photos by status, oldest first, with display names', async () => {
    await store.createAccount('a1', 'h1', 1);
    await store.createAccount('a2', 'h2', 1);
    await store.setDisplayName('a2', 'Mehmet');
    await store.putPhoto('a2', { jpeg: Buffer.from([1]), sha256: 's2', status: 'pending', uploadedAt: 5 });
    await store.putPhoto('a1', { jpeg: Buffer.from([1]), sha256: 's1', status: 'pending', uploadedAt: 9 });
    await store.setPhotoStatus('a1', 'review', ['child']);
    await store.setPhotoStatus('a2', 'review', []);
    expect(await store.listPhotos('review')).toEqual([
      { accountId: 'a2', displayName: 'Mehmet', status: 'review', reasons: [], uploadedAt: 5 },
      { accountId: 'a1', displayName: null, status: 'review', reasons: ['child'], uploadedAt: 9 },
    ]);
    expect(await store.listPhotos('approved')).toEqual([]);
  });

  it('counts uploads per account and UTC day', async () => {
    await store.createAccount('a1', 'h1', 1);
    expect(await store.getUploads('a1', '2026-11-18')).toBe(0);
    expect(await store.incrementUploads('a1', '2026-11-18')).toBe(1);
    expect(await store.incrementUploads('a1', '2026-11-18')).toBe(2);
    expect(await store.incrementUploads('a1', '2026-11-19')).toBe(1);
    expect(await store.getUploads('a1', '2026-11-18')).toBe(2);
  });

  it('blocks and unblocks hashes', async () => {
    expect(await store.blockedReasons('x')).toBeNull();
    await store.blockHash('x', ['nudity'], 1);
    expect(await store.blockedReasons('x')).toEqual(['nudity']);
    await store.blockHash('x', ['text'], 2);
    expect(await store.blockedReasons('x')).toEqual(['text']);
    await store.unblockHash('x');
    expect(await store.blockedReasons('x')).toBeNull();
  });

  it('deleteAccount removes sessions, photo, consent and counters but keeps other accounts', async () => {
    await store.createAccount('a1', 'h1', 1);
    await store.createAccount('a2', 'h2', 1);
    await store.setConsent('a1', 'photo', 1, 1);
    await store.putPhoto('a1', { jpeg: Buffer.from([1]), sha256: 's', status: 'approved', uploadedAt: 1 });
    await store.incrementUploads('a1', 'd');
    await store.deleteAccount('a1');
    expect(await store.getAccount('a1')).toBeNull();
    expect(await store.accountByTokenHash('h1')).toBeNull();
    expect(await store.getPhoto('a1')).toBeNull();
    expect(await store.getUploads('a1', 'd')).toBe(0);
    expect(await store.listPhotos('approved')).toEqual([]);
    expect(await store.accountByTokenHash('h2')).not.toBeNull();
    // a re-created account with the same id starts clean
    await store.createAccount('a1', 'h3', 2);
    expect((await store.getAccount('a1'))?.photoConsentVersion).toBe(0);
  });

  it('addSession gives an existing account a second token', async () => {
    await store.createAccount('a1', 'h1', 1);
    await store.addSession('a1', 'h2', 2);
    expect((await store.accountByTokenHash('h1'))?.id).toBe('a1');
    expect((await store.accountByTokenHash('h2'))?.id).toBe('a1');
  });

  it('links providers with UNIQUE(provider, sub) and UNIQUE(account, provider)', async () => {
    await store.createAccount('a1', 'h1', 1);
    await store.createAccount('a2', 'h2', 1);
    expect(await store.accountByProvider('apple', 's1')).toBeNull();
    expect(await store.linkProvider('a1', 'google', 'g1', 5)).toBe('ok');
    expect(await store.linkProvider('a1', 'apple', 's1', 6)).toBe('ok');
    expect(await store.accountByProvider('apple', 's1')).toBe('a1');
    expect(await store.accountByProvider('google', 's1')).toBeNull(); // sub is per provider
    expect(await store.linkProvider('a2', 'apple', 's1', 7)).toBe('sub_taken');
    expect(await store.linkProvider('a1', 'apple', 's1', 7)).toBe('sub_taken');
    expect(await store.linkProvider('a1', 'apple', 's2', 7)).toBe('provider_taken');
    expect(await store.linkProvider('a2', 'apple', 's2', 7)).toBe('ok');
    expect(await store.listProviderLinks('a1')).toEqual([
      { provider: 'apple', sub: 's1', accountId: 'a1', createdAt: 6, appleRefreshEnc: null },
      { provider: 'google', sub: 'g1', accountId: 'a1', createdAt: 5, appleRefreshEnc: null },
    ]);
    await expect(store.linkProvider('nobody', 'google', 'g9', 1)).rejects.toThrow();
  });

  it('stores the sealed Apple refresh token only on the matching link', async () => {
    await store.createAccount('a1', 'h1', 1);
    await store.linkProvider('a1', 'apple', 's1', 1);
    expect(await store.setAppleRefresh('apple', 's1', 'a2', 'v1.x')).toBe(false);
    expect(await store.setAppleRefresh('apple', 'nope', 'a1', 'v1.x')).toBe(false);
    expect(await store.setAppleRefresh('apple', 's1', 'a1', 'v1.sealed')).toBe(true);
    expect((await store.listProviderLinks('a1'))[0].appleRefreshEnc).toBe('v1.sealed');
  });

  it('deleteAccount removes provider links (identity can be linked again)', async () => {
    await store.createAccount('a1', 'h1', 1);
    await store.linkProvider('a1', 'apple', 's1', 1);
    await store.addSession('a1', 'h9', 1);
    await store.deleteAccount('a1');
    expect(await store.accountByProvider('apple', 's1')).toBeNull();
    expect(await store.listProviderLinks('a1')).toEqual([]);
    expect(await store.accountByTokenHash('h9')).toBeNull();
    await store.createAccount('a2', 'h2', 2);
    expect(await store.linkProvider('a2', 'apple', 's1', 2)).toBe('ok');
  });
});

describe('SqliteStore on an existing E1a database file', () => {
  it('adds account_providers on open and keeps existing data', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kahve-e1a-'));
    const file = join(dir, 'accounts.db');
    try {
      // Build the E1a schema (everything before the E1b block) with one account in it.
      const full = readFileSync(new URL('../src/schema.sql', import.meta.url), 'utf8');
      const e1a = full.slice(0, full.indexOf('-- E1b'));
      expect(e1a).not.toContain('account_providers');
      const old = new DatabaseSync(file);
      old.exec(e1a);
      old.prepare('INSERT INTO accounts (id, display_name, created_at) VALUES (?, ?, ?)').run('old', 'Eski Hesap', 1);
      old.prepare('INSERT INTO sessions (token_hash, account_id, created_at) VALUES (?, ?, ?)').run('hold', 'old', 1);
      old.close();

      const store = new SqliteStore(file);
      expect((await store.accountByTokenHash('hold'))?.displayName).toBe('Eski Hesap');
      expect(await store.linkProvider('old', 'apple', 's1', 2)).toBe('ok');
      expect(await store.accountByProvider('apple', 's1')).toBe('old');
      store.close();
      // re-opening is idempotent and keeps the link
      const again = new SqliteStore(file);
      expect(await again.accountByProvider('apple', 's1')).toBe('old');
      again.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
