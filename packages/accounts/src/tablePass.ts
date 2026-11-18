import { createHmac } from 'node:crypto';

/*
 * E2b table pass, signing side. The game server checks it locally with the same TABLE_PASS_SECRET
 * (server/src/tablePass.ts; both test suites pin the same golden vector, so the two copies cannot drift apart).
 *   pass = base64url(JSON payload) + "." + base64url(HMAC-SHA256(secret, "kahve-table-pass.v1." + payloadB64))
 *   payload = { v: 1, sub: accountId, vb: voiceBannedUntil | 0, iat, exp }   (epoch milliseconds, exp = iat + 6 h)
 */

export const TABLE_PASS_CONTEXT = 'kahve-table-pass.v1.';
/** Lifetime of a pass (same as TABLE_PASS_TTL_MS in @okey/shared). */
export const TABLE_PASS_TTL_MS = 60 * 60 * 1000; // 1 h: a new voice ban reaches the game server within the hour
/** Shorter secrets are treated as "not configured" (503). */
export const TABLE_PASS_MIN_SECRET = 32;

export interface TablePassClaims {
  sub: string;
  /** voice ban end (epoch ms), 0 = none */
  vb: number;
  iat: number;
  exp: number;
}

export function signTablePass(secret: string, c: TablePassClaims): string {
  const payload = { v: 1, sub: c.sub, vb: c.vb, iat: c.iat, exp: c.exp };
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${b64}.${createHmac('sha256', secret).update(TABLE_PASS_CONTEXT + b64).digest('base64url')}`;
}
