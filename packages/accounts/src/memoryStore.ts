import type { AccountRecord, AccountStore, LinkResult, PhotoMeta, PhotoRecord, ProviderLink } from './store';
import { PROVIDERS, type AdminPhotoItem, type PhotoStatus, type Provider, type ReasonCode } from './types';

export class MemoryStore implements AccountStore {
  private accounts = new Map<string, AccountRecord>();
  private sessions = new Map<string, string>(); // tokenHash -> accountId
  private photos = new Map<string, PhotoRecord>();
  private photoSeq = new Map<string, number>();
  private uploads = new Map<string, number>(); // `${id}|${day}`
  private blocked = new Map<string, ReasonCode[]>();
  private links = new Map<string, ProviderLink>(); // `${provider}|${sub}`

  async createAccount(id: string, tokenHash: string, now: number): Promise<void> {
    this.accounts.set(id, { id, displayName: null, createdAt: now, photoConsentVersion: 0 });
    this.sessions.set(tokenHash, id);
  }

  async accountByTokenHash(tokenHash: string): Promise<AccountRecord | null> {
    const id = this.sessions.get(tokenHash);
    return id ? this.getAccount(id) : null;
  }

  async getAccount(id: string): Promise<AccountRecord | null> {
    const a = this.accounts.get(id);
    return a ? { ...a } : null;
  }

  async addSession(accountId: string, tokenHash: string): Promise<void> {
    if (!this.accounts.has(accountId)) throw new Error('account not found');
    this.sessions.set(tokenHash, accountId);
  }

  async accountByProvider(provider: Provider, sub: string): Promise<string | null> {
    return this.links.get(`${provider}|${sub}`)?.accountId ?? null;
  }

  async linkProvider(accountId: string, provider: Provider, sub: string, now: number): Promise<LinkResult> {
    if (!this.accounts.has(accountId)) throw new Error('account not found');
    if (this.links.has(`${provider}|${sub}`)) return 'sub_taken';
    for (const l of this.links.values()) if (l.accountId === accountId && l.provider === provider) return 'provider_taken';
    this.links.set(`${provider}|${sub}`, { provider, sub, accountId, createdAt: now, appleRefreshEnc: null });
    return 'ok';
  }

  async listProviderLinks(accountId: string): Promise<ProviderLink[]> {
    return [...this.links.values()]
      .filter((l) => l.accountId === accountId)
      .sort((a, b) => PROVIDERS.indexOf(a.provider) - PROVIDERS.indexOf(b.provider))
      .map((l) => ({ ...l }));
  }

  async setAppleRefresh(provider: Provider, sub: string, accountId: string, enc: string | null): Promise<boolean> {
    const l = this.links.get(`${provider}|${sub}`);
    if (!l || l.accountId !== accountId) return false;
    l.appleRefreshEnc = enc;
    return true;
  }

  async setDisplayName(id: string, displayName: string): Promise<void> {
    const a = this.accounts.get(id);
    if (a) a.displayName = displayName;
  }

  async setConsent(id: string, _kind: 'photo', version: number): Promise<void> {
    const a = this.accounts.get(id);
    if (a) a.photoConsentVersion = Math.max(a.photoConsentVersion, version);
  }

  async putPhoto(accountId: string, p: { jpeg: Buffer; sha256: string; status: PhotoStatus; uploadedAt: number }): Promise<number> {
    const version = (this.photoSeq.get(accountId) ?? 0) + 1;
    this.photoSeq.set(accountId, version);
    this.photos.set(accountId, { accountId, jpeg: Buffer.from(p.jpeg), sha256: p.sha256, status: p.status, reasons: [], uploadedAt: p.uploadedAt, version });
    return version;
  }

  async getPhoto(accountId: string): Promise<PhotoRecord | null> {
    const p = this.photos.get(accountId);
    return p ? { ...p, reasons: [...p.reasons], jpeg: Buffer.from(p.jpeg) } : null;
  }

  async getPhotoMeta(accountId: string): Promise<PhotoMeta | null> {
    const p = this.photos.get(accountId);
    if (!p) return null;
    const { jpeg: _j, ...meta } = p;
    return { ...meta, reasons: [...p.reasons] };
  }

  async setPhotoStatus(accountId: string, status: PhotoStatus, reasons: ReasonCode[], version?: number): Promise<boolean> {
    const p = this.photos.get(accountId);
    if (!p || (version !== undefined && p.version !== version)) return false;
    p.status = status;
    p.reasons = [...reasons];
    return true;
  }

  async deletePhoto(accountId: string): Promise<void> {
    this.photos.delete(accountId);
  }

  async listPhotos(status: PhotoStatus): Promise<AdminPhotoItem[]> {
    return [...this.photos.values()]
      .filter((p) => p.status === status)
      .sort((a, b) => a.uploadedAt - b.uploadedAt)
      .map((p) => ({
        accountId: p.accountId,
        displayName: this.accounts.get(p.accountId)?.displayName ?? null,
        status: p.status,
        reasons: [...p.reasons],
        uploadedAt: p.uploadedAt,
      }));
  }

  async incrementUploads(accountId: string, day: string): Promise<number> {
    const k = `${accountId}|${day}`;
    const n = (this.uploads.get(k) ?? 0) + 1;
    this.uploads.set(k, n);
    return n;
  }

  async getUploads(accountId: string, day: string): Promise<number> {
    return this.uploads.get(`${accountId}|${day}`) ?? 0;
  }

  async blockHash(sha256: string, reasons: ReasonCode[]): Promise<void> {
    this.blocked.set(sha256, [...reasons]);
  }

  async unblockHash(sha256: string): Promise<void> {
    this.blocked.delete(sha256);
  }

  async blockedReasons(sha256: string): Promise<ReasonCode[] | null> {
    const r = this.blocked.get(sha256);
    return r ? [...r] : null;
  }

  async deleteAccount(id: string): Promise<void> {
    this.accounts.delete(id);
    this.photos.delete(id);
    this.photoSeq.delete(id);
    for (const [h, a] of this.sessions) if (a === id) this.sessions.delete(h);
    for (const [k, l] of this.links) if (l.accountId === id) this.links.delete(k);
    for (const k of this.uploads.keys()) if (k.startsWith(`${id}|`)) this.uploads.delete(k);
  }
}
