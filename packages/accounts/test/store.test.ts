import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
});
