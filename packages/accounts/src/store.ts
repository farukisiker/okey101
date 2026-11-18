import type { AdminPhotoItem, PhotoStatus, Provider, ReasonCode } from './types';

export interface AccountRecord {
  id: string;
  displayName: string | null;
  createdAt: number;
  /** Highest photo consent version given, 0 if none. */
  photoConsentVersion: number;
}

export interface PhotoRecord {
  accountId: string;
  jpeg: Buffer;
  sha256: string;
  status: PhotoStatus;
  reasons: ReasonCode[];
  uploadedAt: number;
  /** Monotonic per account; used in the public URL (?v=) and to drop stale moderation results. */
  version: number;
}

export type PhotoMeta = Omit<PhotoRecord, 'jpeg'>;

export interface ProviderLink {
  provider: Provider;
  sub: string;
  accountId: string;
  createdAt: number;
  /** Apple refresh token sealed with AES-256-GCM (SecretBox), or null. Never plaintext. */
  appleRefreshEnc: string | null;
}

/** Result of linkProvider: 'sub_taken' = this identity is linked to some account; 'provider_taken' = the account already has this provider. */
export type LinkResult = 'ok' | 'sub_taken' | 'provider_taken';

/**
 * Storage for accounts. Every method is async so a network database (Postgres) can implement it later.
 * Implementations: MemoryStore (tests/dev), SqliteStore (node:sqlite).
 */
export interface AccountStore {
  createAccount(id: string, tokenHash: string, now: number): Promise<void>;
  /** Looks up the account owning a session token hash. */
  accountByTokenHash(tokenHash: string): Promise<AccountRecord | null>;
  getAccount(id: string): Promise<AccountRecord | null>;
  /** Adds another session token for an existing account (sign-in on a new device). */
  addSession(accountId: string, tokenHash: string, now: number): Promise<void>;

  /** Account id linked to (provider, sub), or null. */
  accountByProvider(provider: Provider, sub: string): Promise<string | null>;
  /** Atomically links (provider, sub) to the account; UNIQUE(provider, sub) and UNIQUE(account_id, provider). */
  linkProvider(accountId: string, provider: Provider, sub: string, now: number): Promise<LinkResult>;
  listProviderLinks(accountId: string): Promise<ProviderLink[]>;
  /** Stores the sealed Apple refresh token on an existing link. Returns false when the link no longer exists. */
  setAppleRefresh(provider: Provider, sub: string, accountId: string, enc: string | null): Promise<boolean>;
  setDisplayName(id: string, displayName: string): Promise<void>;
  setConsent(id: string, kind: 'photo', version: number, now: number): Promise<void>;

  /** Replaces the account's photo; returns the new version number. */
  putPhoto(accountId: string, photo: { jpeg: Buffer; sha256: string; status: PhotoStatus; uploadedAt: number }): Promise<number>;
  getPhoto(accountId: string): Promise<PhotoRecord | null>;
  getPhotoMeta(accountId: string): Promise<PhotoMeta | null>;
  /** Updates status only if the stored photo still has `version` (or any version when undefined). Returns true if updated. */
  setPhotoStatus(accountId: string, status: PhotoStatus, reasons: ReasonCode[], version?: number): Promise<boolean>;
  deletePhoto(accountId: string): Promise<void>;
  listPhotos(status: PhotoStatus): Promise<AdminPhotoItem[]>;

  /** Increments and returns the upload count for (account, UTC day "YYYY-MM-DD"). */
  incrementUploads(accountId: string, day: string): Promise<number>;
  getUploads(accountId: string, day: string): Promise<number>;

  blockHash(sha256: string, reasons: ReasonCode[], now: number): Promise<void>;
  unblockHash(sha256: string): Promise<void>;
  blockedReasons(sha256: string): Promise<ReasonCode[] | null>;

  /** Removes account, sessions, provider links, photo, consents and counters. */
  deleteAccount(id: string): Promise<void>;
  close?(): void;
}
