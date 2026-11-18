import { createHmac, timingSafeEqual } from 'node:crypto';
import { TABLE_PASS_TOLERANCE_MS, TABLE_PASS_TTL_MS } from '@okey/shared';

/*
 * E2b table pass. The accounts server signs a short-lived pass with TABLE_PASS_SECRET; the game server checks it
 * locally with the same secret (no network call). Format (same code lives in packages/accounts/src/tablePass.ts):
 *   pass = base64url(JSON payload) + "." + base64url(HMAC-SHA256(secret, "kahve-table-pass.v1." + payloadB64))
 *   payload = { v: 1, sub: accountId, vb: voiceBannedUntil | 0, iat, exp }   (all times epoch milliseconds)
 */

export const TABLE_PASS_CONTEXT = 'kahve-table-pass.v1.';
/** Shorter secrets are treated as "not configured". */
export const TABLE_PASS_MIN_SECRET = 32;
/** Anything longer is junk (a real pass is ~200 chars). */
const MAX_PASS_LENGTH = 1024;
const B64URL_RE = /^[A-Za-z0-9_-]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface TablePassClaims {
  /** accounts id (lower-case UUID) */
  sub: string;
  /** voice ban end (epoch ms) at the time the pass was issued; 0 = none */
  vb: number;
  iat: number;
  exp: number;
}

const mac = (secret: string, payloadB64: string) => createHmac('sha256', secret).update(TABLE_PASS_CONTEXT + payloadB64).digest();

/** The secret if it is usable (≥ 32 chars), else null. */
export function tablePassSecret(v: unknown): string | null {
  return typeof v === 'string' && v.length >= TABLE_PASS_MIN_SECRET ? v : null;
}

/** Signs a pass (the accounts server does this in production; tests use it here). */
export function signTablePass(
  secret: string,
  p: { sub: string; vb?: number; iat?: number; exp?: number; v?: number },
): string {
  const iat = p.iat ?? Date.now();
  const payload = { v: p.v ?? 1, sub: p.sub, vb: p.vb ?? 0, iat, exp: p.exp ?? iat + TABLE_PASS_TTL_MS };
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${b64}.${mac(secret, b64).toString('base64url')}`;
}

/**
 * Checks a pass: shape, HMAC (constant time), v = 1, sub a UUID, exp not passed and iat not in the future
 * (each with TABLE_PASS_TOLERANCE_MS of clock slack). Anything wrong -> null (the player just sits as a guest).
 */
export function verifyTablePass(pass: unknown, secret: string | null, now = Date.now()): TablePassClaims | null {
  if (!secret || typeof pass !== 'string' || pass.length > MAX_PASS_LENGTH) return null;
  const parts = pass.split('.');
  if (parts.length !== 2 || !B64URL_RE.test(parts[0]) || !B64URL_RE.test(parts[1])) return null;
  const got = Buffer.from(parts[1], 'base64url');
  const want = mac(secret, parts[0]);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  let p: unknown;
  try {
    p = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof p !== 'object' || p === null) return null;
  const { v, sub, vb, iat, exp } = p as Record<string, unknown>;
  if (v !== 1 || typeof sub !== 'string' || !UUID_RE.test(sub)) return null;
  if (!Number.isSafeInteger(vb) || (vb as number) < 0) return null;
  if (!Number.isSafeInteger(iat) || !Number.isSafeInteger(exp)) return null;
  if ((exp as number) + TABLE_PASS_TOLERANCE_MS <= now || (iat as number) - TABLE_PASS_TOLERANCE_MS > now) return null;
  return { sub, vb: vb as number, iat: iat as number, exp: exp as number };
}
