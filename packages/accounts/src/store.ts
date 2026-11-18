import type { AdminPhotoItem, PhotoStatus, ReasonCode } from './types';

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

/**
 * Storage for accounts. Every method is async so a network database (Postgres) can implement it later.
 * Implementations: MemoryStore (tests/dev), SqliteStore (node:sqlite).
 */
export interface AccountStore {
  createAccount(id: string, tokenHash: string, now: number): Promise<void>;
  /** Looks up the account owning a session token hash. */
  accountByTokenHash(tokenHash: string): Promise<AccountRecord | null>;
  getAccount(id: string): Promise<AccountRecord | null>;
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

  /** Removes account, sessions, photo, consents and counters. */
  deleteAccount(id: string): Promise<void>;
  close?(): void;
}
