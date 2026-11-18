/**
 * Sign in with Apple / Google: token verification, Apple refresh-token sealing and revocation.
 * The HTTP flow (link / switch / new account) lives in app.ts.
 */
import { AppleClient, type AppleRevokeConfig } from './apple';
import { APPLE_ISSUERS, APPLE_JWKS_URL, GOOGLE_ISSUERS, GOOGLE_JWKS_URL, JwksCache, verifyIdToken } from './jwt';
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

interface SealedRefresh {
  rt: string;
  cid: string;
}

export class AuthService {
  private readonly jwks: Record<Provider, JwksCache>;
  private readonly audiences: Record<Provider, string[]>;
  readonly apple: AppleClient | null;
  private readonly box: SecretBox | null;

  constructor(
    o: AuthOptions,
    private readonly env: { now: () => number; log: (msg: string) => void },
  ) {
    this.audiences = { apple: [...(o.appleAudiences ?? [])], google: [...(o.googleAudiences ?? [])] };
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

  /** Verifies the provider's ID token; returns the identity (`sub`) and the matched audience (Apple client_id). */
  async verify(p: Provider, token: unknown): Promise<{ sub: string; aud: string }> {
    const c = await verifyIdToken(token, {
      jwks: this.jwks[p],
      issuers: p === 'apple' ? APPLE_ISSUERS : GOOGLE_ISSUERS,
      audiences: this.audiences[p],
      now: this.env.now,
    });
    return { sub: c.sub, aud: c.aud };
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
