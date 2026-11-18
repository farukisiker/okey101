/**
 * Minimal RS256 ID token verification on node:crypto (no npm packages) for Sign in with Apple and Google.
 * Only RS256 is accepted (alg "none", HS*, ES*, PS* are refused). Keys come from the provider's JWKS, picked by `kid`.
 */
import { createPublicKey, verify as cryptoVerify, type KeyObject } from 'node:crypto';
import type { FetchLike } from './moderation';

export const APPLE_ISSUERS = ['https://appleid.apple.com'] as const;
export const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'] as const;
export const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

/** Clock skew tolerance for exp / iat / nbf. */
export const CLOCK_SKEW_SEC = 60;
/** Tokens issued longer ago than this are refused (Apple tokens live 10 min, Google 1 h). */
export const MAX_TOKEN_AGE_SEC = 24 * 3600;
export const MAX_TOKEN_LENGTH = 8192;
export const JWKS_MIN_TTL_MS = 3600_000;
export const JWKS_MAX_TTL_MS = 24 * 3600_000;
export const JWKS_MIN_REFETCH_MS = 60_000;
const JWKS_TIMEOUT_MS = 10_000;
const MIN_RSA_BITS = 2048;

/** The token is not acceptable. `reason` is for server logs only (never contains the token). */
export class InvalidTokenError extends Error {
  constructor(public readonly reason: string) {
    super(`invalid token: ${reason}`);
    this.name = 'InvalidTokenError';
  }
}

/** Keys could not be fetched and none are cached. */
export class JwksUnavailableError extends Error {
  constructor(reason: string) {
    super(`jwks unavailable: ${reason}`);
    this.name = 'JwksUnavailableError';
  }
}

const B64URL_RE = /^[A-Za-z0-9_-]*$/;

export function b64urlJson(part: string): unknown {
  if (!B64URL_RE.test(part)) throw new InvalidTokenError('malformed');
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidTokenError('malformed');
  }
}

function parseMaxAge(cacheControl: string | null): number | null {
  const m = /(?:^|[,\s])max-age=(\d+)/i.exec(cacheControl ?? '');
  return m ? Number(m[1]) * 1000 : null;
}

export interface JwksCacheOptions {
  url: string;
  fetch?: FetchLike;
  now?: () => number;
  log?: (msg: string) => void;
}

/**
 * JWKS cache. TTL follows Cache-Control max-age, clamped to [1 h, 24 h]. An unknown `kid` triggers one refetch,
 * at most once per minute (so random kids cannot make us hammer the provider). Concurrent refreshes share one request.
 * If a refresh fails, the previously fetched keys stay in use.
 */
export class JwksCache {
  private keys = new Map<string, KeyObject>();
  private expiresAt = 0;
  private lastFetchAt = -Infinity;
  private inflight: Promise<void> | null = null;
  private readonly fetchFn: FetchLike;
  private readonly now: () => number;
  private readonly log: (msg: string) => void;
  /** Number of network fetches made (for tests / metrics). */
  fetchCount = 0;

  constructor(private readonly opts: JwksCacheOptions) {
    this.fetchFn = opts.fetch ?? ((u, i) => fetch(u, i));
    this.now = opts.now ?? Date.now;
    this.log = opts.log ?? (() => {});
  }

  async getKey(kid: string): Promise<KeyObject | null> {
    const t = this.now();
    const needed = t >= this.expiresAt || !this.keys.has(kid);
    if (this.inflight) await this.inflight;
    else if (needed && t - this.lastFetchAt >= JWKS_MIN_REFETCH_MS) await this.refresh();
    if (this.keys.size === 0) throw new JwksUnavailableError('no keys');
    return this.keys.get(kid) ?? null;
  }

  /** Never rejects: a failed refresh is logged and the previous keys stay in use. */
  private refresh(): Promise<void> {
    if (this.inflight) return this.inflight;
    this.inflight = this.doFetch()
      .catch((err: unknown) => {
        this.log(`JWKS fetch failed (${this.opts.url}): ${(err as Error)?.message ?? 'error'}`);
      })
      .finally(() => {
        this.inflight = null;
      });
    return this.inflight;
  }

  private async doFetch(): Promise<void> {
    this.lastFetchAt = this.now();
    this.fetchCount++;
    const res = await this.fetchFn(this.opts.url, { method: 'GET', signal: AbortSignal.timeout(JWKS_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { keys?: unknown };
    if (!body || !Array.isArray(body.keys)) throw new Error('no keys array');
    const next = new Map<string, KeyObject>();
    for (const k of body.keys as Array<Record<string, unknown>>) {
      if (!k || typeof k !== 'object' || k.kty !== 'RSA' || typeof k.kid !== 'string') continue;
      if (k.use !== undefined && k.use !== 'sig') continue;
      if (k.alg !== undefined && k.alg !== 'RS256') continue;
      if (typeof k.n !== 'string' || typeof k.e !== 'string') continue;
      try {
        const key = createPublicKey({ key: { kty: 'RSA', n: k.n, e: k.e }, format: 'jwk' });
        if ((key.asymmetricKeyDetails?.modulusLength ?? 0) < MIN_RSA_BITS) continue;
        next.set(k.kid, key);
      } catch {
        // skip malformed key
      }
    }
    if (next.size === 0) throw new Error('no usable RSA keys');
    this.keys = next;
    const ttl = parseMaxAge(res.headers.get('cache-control')) ?? JWKS_MIN_TTL_MS;
    this.expiresAt = this.now() + Math.min(JWKS_MAX_TTL_MS, Math.max(JWKS_MIN_TTL_MS, ttl));
  }
}

export interface IdTokenClaims {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  [k: string]: unknown;
}

export interface VerifyOptions {
  jwks: JwksCache;
  issuers: readonly string[];
  audiences: readonly string[];
  now?: () => number;
}

/**
 * Verifies an RS256 ID token and returns its claims; `aud` is returned as the matched allowed audience.
 * Throws InvalidTokenError (-> 401) or JwksUnavailableError (-> 503).
 */
export async function verifyIdToken(token: unknown, o: VerifyOptions): Promise<IdTokenClaims> {
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) throw new InvalidTokenError('malformed');
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0].length === 0) throw new InvalidTokenError('malformed');
  const [h, p, s] = parts;

  const header = b64urlJson(h) as Record<string, unknown> | null;
  if (!header || typeof header !== 'object' || Array.isArray(header)) throw new InvalidTokenError('malformed');
  if (header.alg !== 'RS256') throw new InvalidTokenError('alg');
  if ('crit' in header) throw new InvalidTokenError('crit');
  if (typeof header.kid !== 'string' || header.kid.length === 0 || header.kid.length > 256) throw new InvalidTokenError('kid');
  if (p.length === 0 || s.length === 0 || !B64URL_RE.test(s)) throw new InvalidTokenError('malformed');

  const key = await o.jwks.getKey(header.kid);
  if (!key) throw new InvalidTokenError('unknown kid');
  const ok = cryptoVerify('RSA-SHA256', Buffer.from(`${h}.${p}`, 'ascii'), key, Buffer.from(s, 'base64url'));
  if (!ok) throw new InvalidTokenError('signature');

  const c = b64urlJson(p) as Record<string, unknown> | null;
  if (!c || typeof c !== 'object' || Array.isArray(c)) throw new InvalidTokenError('malformed');
  const nowSec = (o.now ?? Date.now)() / 1000;
  if (typeof c.iss !== 'string' || !o.issuers.includes(c.iss)) throw new InvalidTokenError('iss');
  const auds = typeof c.aud === 'string' ? [c.aud] : Array.isArray(c.aud) ? c.aud.filter((a) => typeof a === 'string') : [];
  const aud = auds.find((a) => o.audiences.includes(a));
  if (!aud) throw new InvalidTokenError('aud');
  if (typeof c.exp !== 'number' || !Number.isFinite(c.exp) || c.exp + CLOCK_SKEW_SEC <= nowSec) throw new InvalidTokenError('exp');
  if (typeof c.iat !== 'number' || !Number.isFinite(c.iat) || c.iat > nowSec + CLOCK_SKEW_SEC || c.iat < nowSec - MAX_TOKEN_AGE_SEC) {
    throw new InvalidTokenError('iat');
  }
  if (c.nbf !== undefined && (typeof c.nbf !== 'number' || c.nbf > nowSec + CLOCK_SKEW_SEC)) throw new InvalidTokenError('nbf');
  if (typeof c.sub !== 'string' || c.sub.length === 0 || c.sub.length > 255) throw new InvalidTokenError('sub');
  return { ...c, iss: c.iss, sub: c.sub, aud, exp: c.exp, iat: c.iat };
}
