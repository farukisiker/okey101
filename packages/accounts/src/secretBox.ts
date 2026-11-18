/**
 * AES-256-GCM for small secrets stored in the database (Apple refresh tokens).
 * Key = HKDF-SHA256(ACCOUNTS_SECRET, info = purpose). Output: "v1." + base64url(iv[12] | tag[16] | ciphertext).
 * `aad` binds the ciphertext to its row (e.g. "apple:<sub>") so it cannot be moved to another row.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

export const MIN_SECRET_LENGTH = 32;

export class SecretBox {
  private readonly key: Buffer;

  constructor(secret: string, purpose = 'kahve-accounts/apple-refresh/v1') {
    if (typeof secret !== 'string' || secret.length < MIN_SECRET_LENGTH) {
      throw new Error(`secret must be at least ${MIN_SECRET_LENGTH} characters`);
    }
    this.key = Buffer.from(hkdfSync('sha256', Buffer.from(secret, 'utf8'), Buffer.alloc(0), purpose, 32));
  }

  seal(plain: string, aad: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    c.setAAD(Buffer.from(aad, 'utf8'));
    const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return 'v1.' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64url');
  }

  /** Returns null when the value is malformed, tampered with, or sealed with another key / aad. */
  open(sealed: string, aad: string): string | null {
    if (typeof sealed !== 'string' || !sealed.startsWith('v1.')) return null;
    const raw = Buffer.from(sealed.slice(3), 'base64url');
    if (raw.length < 12 + 16 + 1) return null;
    try {
      const d = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
      d.setAAD(Buffer.from(aad, 'utf8'));
      d.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
    } catch {
      return null;
    }
  }
}
