/**
 * Fake identity providers for tests: RSA keys generated in-process, JWKS served by an injected fetch,
 * and a fake Apple token/revoke endpoint. No network, no real keys.
 */
import { createHmac, generateKeyPairSync, sign as cryptoSign, type KeyObject } from 'node:crypto';
import { APPLE_REVOKE_URL, APPLE_TOKEN_URL } from '../src/apple';
import { APPLE_JWKS_URL, GOOGLE_JWKS_URL } from '../src/jwt';
import type { FetchLike } from '../src/moderation';

export const APPLE_AUD = 'com.example.kahve.test';
export const GOOGLE_AUD = 'test-web-client.apps.googleusercontent.com';
export const GOOGLE_AUD_ANDROID = 'test-android-client.apps.googleusercontent.com';

const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

export interface RsaKey {
  kid: string;
  privateKey: KeyObject;
  publicKey: KeyObject;
}

export function rsaKey(kid: string, bits = 2048): RsaKey {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: bits });
  return { kid, privateKey, publicKey };
}

export function jwk(k: RsaKey): Record<string, unknown> {
  return { ...(k.publicKey.export({ format: 'jwk' }) as object), kid: k.kid, use: 'sig', alg: 'RS256' };
}

/** Signs an RS256 JWT; `header` overrides allow crafting bad tokens. */
export function signJwt(key: RsaKey, payload: Record<string, unknown>, header: Record<string, unknown> = {}): string {
  const h = b64({ alg: 'RS256', kid: key.kid, typ: 'JWT', ...header });
  const p = b64(payload);
  const sig = cryptoSign('RSA-SHA256', Buffer.from(`${h}.${p}`), key.privateKey).toString('base64url');
  return `${h}.${p}.${sig}`;
}

export function hs256Jwt(secret: string, payload: Record<string, unknown>, kid: string): string {
  const h = b64({ alg: 'HS256', kid, typ: 'JWT' });
  const p = b64(payload);
  return `${h}.${p}.${createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`;
}

export function noneJwt(payload: Record<string, unknown>, kid: string): string {
  return `${b64({ alg: 'none', kid })}.${b64(payload)}.`;
}

export interface FakeCall {
  url: string;
  body: string;
}

/** Routes injected fetch calls to fake Apple/Google endpoints. */
export class FakeIdp {
  appleKeys: RsaKey[];
  googleKeys: RsaKey[];
  calls: FakeCall[] = [];
  jwksCacheControl = 'public, max-age=7200';
  jwksDown = false;
  /** Fake Apple /auth/token answer. */
  tokenResponse: (form: URLSearchParams) => { status: number; body: unknown } = (form) => ({
    status: 200,
    body: { access_token: 'at', token_type: 'Bearer', expires_in: 3600, refresh_token: `RT-${form.get('code')}`, id_token: this.tokenIdToken },
  });
  revokeStatus = 200;
  /** Sub placed in the id_token the fake /auth/token returns. */
  tokenSub = 'apple-sub-1';
  /** Optional gate: token endpoint waits for it (to test races with deletion). */
  tokenGate: Promise<void> | null = null;

  constructor() {
    this.appleKeys = [rsaKey('apple-k1')];
    this.googleKeys = [rsaKey('google-k1')];
  }

  get tokenIdToken(): string {
    return signJwt(this.appleKeys[0], { iss: 'https://appleid.apple.com', aud: APPLE_AUD, sub: this.tokenSub, iat: 0, exp: 1 });
  }

  count(url: string): number {
    return this.calls.filter((c) => c.url === url).length;
  }

  fetch: FetchLike = async (url, init) => {
    const body = typeof init?.body === 'string' ? init.body : '';
    this.calls.push({ url, body });
    const json = (status: number, v: unknown, headers: Record<string, string> = {}) =>
      new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', ...headers } });
    if (url === APPLE_JWKS_URL || url === GOOGLE_JWKS_URL) {
      if (this.jwksDown) return json(500, { error: 'down' });
      const keys = (url === APPLE_JWKS_URL ? this.appleKeys : this.googleKeys).map(jwk);
      return json(200, { keys }, { 'cache-control': this.jwksCacheControl });
    }
    if (url === APPLE_TOKEN_URL) {
      if (this.tokenGate) await this.tokenGate;
      const r = this.tokenResponse(new URLSearchParams(body));
      return json(r.status, r.body);
    }
    if (url === APPLE_REVOKE_URL) return new Response('', { status: this.revokeStatus });
    throw new Error(`unexpected fetch ${url}`);
  };
}

export function appleClaims(nowMs: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const t = Math.floor(nowMs / 1000);
  return { iss: 'https://appleid.apple.com', aud: APPLE_AUD, sub: 'apple-sub-1', iat: t, exp: t + 600, ...extra };
}

export function googleClaims(nowMs: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const t = Math.floor(nowMs / 1000);
  return { iss: 'https://accounts.google.com', aud: GOOGLE_AUD, azp: GOOGLE_AUD_ANDROID, sub: '1000001', iat: t, exp: t + 3600, ...extra };
}
