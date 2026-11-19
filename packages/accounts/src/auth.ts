/**
 * Sign in with Apple / Google: token verification, Apple refresh-token sealing and revocation.
 * The HTTP flow (link / switch / new account) lives in app.ts.
 */
import { randomBytes } from 'node:crypto';
import { AppleClient, type AppleRevokeConfig } from './apple';
import { APPLE_ISSUERS, APPLE_JWKS_URL, GOOGLE_ISSUERS, GOOGLE_JWKS_URL, InvalidTokenError, JwksCache, verifyIdToken } from './jwt';
import type { FetchLike } from './moderation';
import { SecretBox } from './secretBox';
import type { Provider } from './types';

export interface AuthOptions {
  /** Allowed `aud` values of Apple identity tokens (iOS bundle id, e.g. com.farukisiker.okey101). Empty -> Apple sign-in 503. */
  appleAudiences?: string[];
  /** Allowed `aud` values of Google ID tokens (web / Android / iOS OAuth client ids). Empty -> Google sign-in 503. */
  googleAudiences?: string[];
  /** Sign in with Apple key for code exchange + revocation on deletion. Missing -> skipped (logged). */
  appleRevoke?: AppleRevokeConfig;
  /** ACCOUNTS_SECRET (>= 32 chars): key material for sealing Apple refresh tokens. Missing -> refresh tokens are not stored. */
  secret?: string;
  /**
   * APPLE_NONCE_REQUIRED=1: an Apple sign-in without a nonce is refused. Off (default, transition for older test builds):
   * a request without any nonce is accepted with a logged warning, as long as the token carries no nonce either.
   */
  appleNonceRequired?: boolean;
  fetch?: FetchLike;
  appleJwksUrl?: string;
  googleJwksUrl?: string;
}

/** Parses a comma separated env value into a clean list. */
export function parseList(v: string | undefined): string[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Apple sign-in nonces live this long and can be used once. */
export const APPLE_NONCE_TTL_MS = 10 * 60_000;
/** Upper bound of outstanding nonces kept in memory (per-IP issue limit keeps real use far below). */
export const MAX_APPLE_NONCES = 100_000;
export const APPLE_NONCE_RE = /^[A-Za-z0-9_-]{43}$/;

/**
 * Single-use, short-lived nonces in memory. The TTL is constant, so Map insertion order is expiry order and
 * purging stops at the first live entry. A restart forgets outstanding nonces (the user just taps again).
 */
export class NonceStore {
  private readonly m = new Map<string, number>();
  constructor(
    private readonly now: () => number,
    private readonly ttlMs = APPLE_NONCE_TTL_MS,
    private readonly max = MAX_APPLE_NONCES,
  ) {}

  /** A new nonce (32 random bytes, base64url), or null when the store is full of live nonces. */
  issue(): string | null {
    this.purge();
    if (this.m.size >= this.max) return null;
    const n = randomBytes(32).toString('base64url');
    this.m.set(n, this.now() + this.ttlMs);
    return n;
  }

  /** true once for a live nonce that was issued here; the nonce is gone afterwards. */
  take(n: string): boolean {
    const exp = this.m.get(n);
    if (exp === undefined) return false;
    this.m.delete(n);
    return exp > this.now();
  }

  get size(): number {
    return this.m.size;
  }

  private purge(): void {
    const t = this.now();
    for (const [k, exp] of this.m) {
      if (exp > t) break;
      this.m.delete(k);
    }
  }
}

interface SealedRefresh {
  rt: string;
  cid: string;
}

export class AuthService {
  private readonly jwks: Record<Provider, JwksCache>;
  private readonly audiences: Record<Provider, string[]>;
  readonly apple: AppleClient | null;
  private readonly box: SecretBox | null;
  readonly appleNonces: NonceStore;
  readonly appleNonceRequired: boolean;

  constructor(
    o: AuthOptions,
    private readonly env: { now: () => number; log: (msg: string) => void },
  ) {
    this.audiences = { apple: [...(o.appleAudiences ?? [])], google: [...(o.googleAudiences ?? [])] };
    this.appleNonces = new NonceStore(env.now);
    this.appleNonceRequired = o.appleNonceRequired === true;
    const common = { fetch: o.fetch, now: env.now, log: env.log };
    this.jwks = {
      apple: new JwksCache({ url: o.appleJwksUrl ?? APPLE_JWKS_URL, ...common }),
      google: new JwksCache({ url: o.googleJwksUrl ?? GOOGLE_JWKS_URL, ...common }),
    };
    let box: SecretBox | null = null;
    if (o.secret) {
      try {
        box = new SecretBox(o.secret);
      } catch {
        env.log('ACCOUNTS_SECRET shorter than 32 characters: Apple refresh tokens will not be stored');
      }
    }
    this.box = box;
    let apple: AppleClient | null = null;
    if (o.appleRevoke) {
      try {
        apple = new AppleClient(o.appleRevoke, { fetch: o.fetch, now: env.now });
      } catch (err) {
        env.log(`Apple key unusable, revocation disabled: ${(err as Error)?.message ?? 'error'}`);
      }
    }
    this.apple = apple;
  }

  configured(p: Provider): boolean {
    return this.audiences[p].length > 0;
  }

  /**
   * Verifies the provider's ID token; returns the identity (`sub`), the matched audience (Apple client_id) and the
   * token's `nonce` claim (undefined when absent). Google: when `azp` (the client that asked for the token) is present
   * it must be one of the allowed audiences too.
   */
  async verify(p: Provider, token: unknown): Promise<{ sub: string; aud: string; nonce: unknown }> {
    const c = await verifyIdToken(token, {
      jwks: this.jwks[p],
      issuers: p === 'apple' ? APPLE_ISSUERS : GOOGLE_ISSUERS,
      audiences: this.audiences[p],
      now: this.env.now,
    });
    if (p === 'google' && c.azp !== undefined && (typeof c.azp !== 'string' || !this.audiences.google.includes(c.azp))) {
      throw new InvalidTokenError('azp');
    }
    return { sub: c.sub, aud: c.aud, nonce: c.nonce };
  }

  /** Why Apple refresh tokens cannot be stored, or null when they can. */
  appleRefreshBlocker(): string | null {
    if (!this.apple) return 'APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY_PATH not configured';
    if (!this.box) return 'ACCOUNTS_SECRET missing';
    return null;
  }

  sealAppleRefresh(sub: string, refreshToken: string, clientId: string): string {
    if (!this.box) throw new Error('no secret');
    return this.box.seal(JSON.stringify({ rt: refreshToken, cid: clientId } satisfies SealedRefresh), `apple:${sub}`);
  }

  openAppleRefresh(sub: string, enc: string): SealedRefresh | null {
    const plain = this.box?.open(enc, `apple:${sub}`);
    if (!plain) return null;
    try {
      const v = JSON.parse(plain) as SealedRefresh;
      return typeof v.rt === 'string' && typeof v.cid === 'string' ? v : null;
    } catch {
      return null;
    }
  }

  /** For tests / metrics. */
  jwksFetchCount(p: Provider): number {
    return this.jwks[p].fetchCount;
  }
}
