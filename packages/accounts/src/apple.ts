/**
 * Sign in with Apple server calls: authorization code -> refresh token, and token revocation on account deletion
 * (App Store Review Guideline 5.1.1(v)). client_secret is an ES256 JWT signed with the Sign in with Apple .p8 key.
 * Tokens are never logged; errors carry only HTTP status / Apple's error code.
 */
import { createPrivateKey, sign as cryptoSign, type KeyObject } from 'node:crypto';
import { b64urlJson } from './jwt';
import type { FetchLike } from './moderation';

export const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';
export const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
const APPLE_TIMEOUT_MS = 10_000;
const CLIENT_SECRET_TTL_SEC = 300;

export interface AppleRevokeConfig {
  teamId: string;
  keyId: string;
  /** Contents of the .p8 file (PKCS#8 PEM) or an already loaded EC P-256 private key. */
  privateKey: string | KeyObject;
}

export class AppleApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppleApiError';
  }
}

const b64url = (v: unknown) => Buffer.from(JSON.stringify(v), 'utf8').toString('base64url');

export function loadApplePrivateKey(k: string | KeyObject): KeyObject {
  const key = typeof k === 'string' ? createPrivateKey(k) : k;
  if (key.type !== 'private' || key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error('Apple key must be an EC P-256 private key (.p8)');
  }
  return key;
}

/** ES256 client_secret JWT for appleid.apple.com (raw r||s signature, not DER). */
export function appleClientSecret(cfg: { teamId: string; keyId: string; key: KeyObject; clientId: string; nowMs: number }): string {
  const iat = Math.floor(cfg.nowMs / 1000);
  const head = b64url({ alg: 'ES256', kid: cfg.keyId });
  const body = b64url({ iss: cfg.teamId, iat, exp: iat + CLIENT_SECRET_TTL_SEC, aud: 'https://appleid.apple.com', sub: cfg.clientId });
  const sig = cryptoSign('sha256', Buffer.from(`${head}.${body}`, 'ascii'), { key: cfg.key, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${sig.toString('base64url')}`;
}

export class AppleClient {
  private readonly key: KeyObject;
  private readonly fetchFn: FetchLike;
  private readonly now: () => number;

  constructor(
    private readonly cfg: AppleRevokeConfig,
    opts: { fetch?: FetchLike; now?: () => number } = {},
  ) {
    this.key = loadApplePrivateKey(cfg.privateKey);
    this.fetchFn = opts.fetch ?? ((u, i) => fetch(u, i));
    this.now = opts.now ?? Date.now;
  }

  private async post(url: string, clientId: string, fields: Record<string, string>): Promise<Response> {
    const client_secret = appleClientSecret({ teamId: this.cfg.teamId, keyId: this.cfg.keyId, key: this.key, clientId, nowMs: this.now() });
    return this.fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({ client_id: clientId, client_secret, ...fields }).toString(),
      signal: AbortSignal.timeout(APPLE_TIMEOUT_MS),
    });
  }

  /**
   * Exchanges an authorization code for a refresh token. `expectedSub` must match the `sub` of the id_token Apple
   * returns, so a code from another Apple ID cannot be attached to this account.
   */
  async exchangeCode(code: string, clientId: string, expectedSub: string): Promise<string> {
    const res = await this.post(APPLE_TOKEN_URL, clientId, { code, grant_type: 'authorization_code' });
    const body = (await res.json().catch(() => null)) as { refresh_token?: unknown; id_token?: unknown; error?: unknown } | null;
    if (!res.ok) throw new AppleApiError(`token HTTP ${res.status} ${typeof body?.error === 'string' ? body.error : ''}`.trim());
    if (!body || typeof body.refresh_token !== 'string' || body.refresh_token.length === 0) throw new AppleApiError('token: no refresh_token');
    // id_token came straight from Apple over TLS, so reading its payload is enough here.
    let sub: unknown;
    try {
      sub = typeof body.id_token === 'string' ? (b64urlJson(body.id_token.split('.')[1] ?? '') as { sub?: unknown })?.sub : undefined;
    } catch {
      sub = undefined;
    }
    if (sub !== expectedSub) throw new AppleApiError('token: sub mismatch');
    return body.refresh_token;
  }

  async revoke(refreshToken: string, clientId: string): Promise<void> {
    const res = await this.post(APPLE_REVOKE_URL, clientId, { token: refreshToken, token_type_hint: 'refresh_token' });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
      throw new AppleApiError(`revoke HTTP ${res.status} ${typeof body?.error === 'string' ? body.error : ''}`.trim());
    }
  }
}
