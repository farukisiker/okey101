import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { AccountRecord, AccountStore, PhotoMeta, PhotoRecord } from './store';
import { isReasonCode, type AdminPhotoItem, type PhotoStatus, type ReasonCode } from './types';

const SCHEMA_URL = new URL('./schema.sql', import.meta.url);

type Row = Record<string, unknown>;

function parseReasons(v: unknown): ReasonCode[] {
  try {
    const arr = JSON.parse(String(v));
    return Array.isArray(arr) ? arr.filter(isReasonCode) : [];
  } catch {
    return [];
  }
}

function toAccount(r: Row): AccountRecord {
  return {
    id: String(r.id),
    displayName: r.display_name == null ? null : String(r.display_name),
    createdAt: Number(r.created_at),
    photoConsentVersion: Number(r.photo_consent_version),
  };
}

function toMeta(r: Row): PhotoMeta {
  return {
    accountId: String(r.account_id),
    sha256: String(r.sha256),
    status: String(r.status) as PhotoStatus,
    reasons: parseReasons(r.reasons),
    uploadedAt: Number(r.uploaded_at),
    version: Number(r.version),
  };
}

/** AccountStore on node:sqlite. `path` is a file path or ':memory:'. */
export class SqliteStore implements AccountStore {
  readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(readFileSync(SCHEMA_URL, 'utf8'));
  }

  private tx<T>(fn: () => T): T {
    this.db.exec('BEGIN');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  async createAccount(id: string, tokenHash: string, now: number): Promise<void> {
    this.tx(() => {
      this.db.prepare('INSERT INTO accounts (id, display_name, created_at) VALUES (?, NULL, ?)').run(id, now);
      this.db.prepare('INSERT INTO sessions (token_hash, account_id, created_at) VALUES (?, ?, ?)').run(tokenHash, id, now);
    });
  }

  async accountByTokenHash(tokenHash: string): Promise<AccountRecord | null> {
    const r = this.db
      .prepare('SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = ?')
      .get(tokenHash);
    return r ? toAccount(r) : null;
  }

  async getAccount(id: string): Promise<AccountRecord | null> {
    const r = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    return r ? toAccount(r) : null;
  }

  async setDisplayName(id: string, displayName: string): Promise<void> {
    this.db.prepare('UPDATE accounts SET display_name = ? WHERE id = ?').run(displayName, id);
  }

  async setConsent(id: string, kind: 'photo', version: number, now: number): Promise<void> {
    this.tx(() => {
      this.db
        .prepare(
          'INSERT INTO consents (account_id, kind, version, given_at) VALUES (?, ?, ?, ?) ' +
            'ON CONFLICT (account_id, kind) DO UPDATE SET version = excluded.version, given_at = excluded.given_at',
        )
        .run(id, kind, version, now);
      this.db
        .prepare('UPDATE accounts SET photo_consent_version = ? WHERE id = ? AND photo_consent_version < ?')
        .run(version, id, version);
    });
  }

  async putPhoto(accountId: string, p: { jpeg: Buffer; sha256: string; status: PhotoStatus; uploadedAt: number }): Promise<number> {
    return this.tx(() => {
      this.db.prepare('UPDATE accounts SET photo_seq = photo_seq + 1 WHERE id = ?').run(accountId);
      const r = this.db.prepare('SELECT photo_seq FROM accounts WHERE id = ?').get(accountId);
      if (!r) throw new Error('account not found');
      const version = Number(r.photo_seq);
      this.db
        .prepare(
          'INSERT INTO photos (account_id, jpeg, sha256, status, reasons, uploaded_at, version) VALUES (?, ?, ?, ?, ?, ?, ?) ' +
            'ON CONFLICT (account_id) DO UPDATE SET jpeg = excluded.jpeg, sha256 = excluded.sha256, status = excluded.status, ' +
            'reasons = excluded.reasons, uploaded_at = excluded.uploaded_at, version = excluded.version',
        )
        .run(accountId, p.jpeg, p.sha256, p.status, '[]', p.uploadedAt, version);
      return version;
    });
  }

  async getPhoto(accountId: string): Promise<PhotoRecord | null> {
    const r = this.db.prepare('SELECT * FROM photos WHERE account_id = ?').get(accountId);
    if (!r) return null;
    return { ...toMeta(r), jpeg: Buffer.from(r.jpeg as Uint8Array) };
  }

  async getPhotoMeta(accountId: string): Promise<PhotoMeta | null> {
    const r = this.db
      .prepare('SELECT account_id, sha256, status, reasons, uploaded_at, version FROM photos WHERE account_id = ?')
      .get(accountId);
    return r ? toMeta(r) : null;
  }

  async setPhotoStatus(accountId: string, status: PhotoStatus, reasons: ReasonCode[], version?: number): Promise<boolean> {
    const res =
      version === undefined
        ? this.db.prepare('UPDATE photos SET status = ?, reasons = ? WHERE account_id = ?').run(status, JSON.stringify(reasons), accountId)
        : this.db
            .prepare('UPDATE photos SET status = ?, reasons = ? WHERE account_id = ? AND version = ?')
            .run(status, JSON.stringify(reasons), accountId, version);
    return Number(res.changes) > 0;
  }

  async deletePhoto(accountId: string): Promise<void> {
    this.db.prepare('DELETE FROM photos WHERE account_id = ?').run(accountId);
  }

  async listPhotos(status: PhotoStatus): Promise<AdminPhotoItem[]> {
    const rows = this.db
      .prepare(
        'SELECT p.account_id, p.status, p.reasons, p.uploaded_at, a.display_name FROM photos p ' +
          'JOIN accounts a ON a.id = p.account_id WHERE p.status = ? ORDER BY p.uploaded_at ASC',
      )
      .all(status);
    return rows.map((r) => ({
      accountId: String(r.account_id),
      displayName: r.display_name == null ? null : String(r.display_name),
      status: String(r.status) as PhotoStatus,
      reasons: parseReasons(r.reasons),
      uploadedAt: Number(r.uploaded_at),
    }));
  }

  async incrementUploads(accountId: string, day: string): Promise<number> {
    return this.tx(() => {
      this.db
        .prepare(
          'INSERT INTO upload_counts (account_id, day, count) VALUES (?, ?, 1) ' +
            'ON CONFLICT (account_id, day) DO UPDATE SET count = upload_counts.count + 1',
        )
        .run(accountId, day);
      const r = this.db.prepare('SELECT count FROM upload_counts WHERE account_id = ? AND day = ?').get(accountId, day);
      return Number(r?.count ?? 0);
    });
  }

  async getUploads(accountId: string, day: string): Promise<number> {
    const r = this.db.prepare('SELECT count FROM upload_counts WHERE account_id = ? AND day = ?').get(accountId, day);
    return Number(r?.count ?? 0);
  }

  async blockHash(sha256: string, reasons: ReasonCode[], now: number): Promise<void> {
    this.db
      .prepare(
        'INSERT INTO blocked_hashes (sha256, reasons, created_at) VALUES (?, ?, ?) ' +
          'ON CONFLICT (sha256) DO UPDATE SET reasons = excluded.reasons',
      )
      .run(sha256, JSON.stringify(reasons), now);
  }

  async unblockHash(sha256: string): Promise<void> {
    this.db.prepare('DELETE FROM blocked_hashes WHERE sha256 = ?').run(sha256);
  }

  async blockedReasons(sha256: string): Promise<ReasonCode[] | null> {
    const r = this.db.prepare('SELECT reasons FROM blocked_hashes WHERE sha256 = ?').get(sha256);
    return r ? parseReasons(r.reasons) : null;
  }

  async deleteAccount(id: string): Promise<void> {
    // Explicit deletes (do not rely on FK cascade being enabled in every database).
    this.tx(() => {
      for (const t of ['sessions', 'consents', 'photos', 'upload_counts']) {
        this.db.prepare(`DELETE FROM ${t} WHERE account_id = ?`).run(id);
      }
      this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    });
  }

  close(): void {
    this.db.close();
  }
}
