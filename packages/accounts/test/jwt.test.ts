import { beforeEach, describe, expect, it } from 'vitest';
import { APPLE_ISSUERS, APPLE_JWKS_URL, GOOGLE_ISSUERS, GOOGLE_JWKS_URL, InvalidTokenError, JwksCache, JwksUnavailableError, verifyIdToken } from '../src/jwt';
import { APPLE_AUD, appleClaims, FakeIdp, GOOGLE_AUD, GOOGLE_AUD_ANDROID, googleClaims, hs256Jwt, jwk, noneJwt, rsaKey, signJwt } from './idp';

const T0 = Date.UTC(2026, 10, 18, 12, 0, 0);

describe('verifyIdToken (RS256 + JWKS)', () => {
  let idp: FakeIdp;
  let clock: number;
  let apple: JwksCache;
  let google: JwksCache;
  const verifyApple = (token: unknown) => verifyIdToken(token, { jwks: apple, issuers: APPLE_ISSUERS, audiences: [APPLE_AUD], now: () => clock });
  const verifyGoogle = (token: unknown) =>
    verifyIdToken(token, { jwks: google, issuers: GOOGLE_ISSUERS, audiences: [GOOGLE_AUD, GOOGLE_AUD_ANDROID], now: () => clock });
  async function refused(p: Promise<unknown>, reason: string) {
    const err = await p.then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(InvalidTokenError);
    expect((err as InvalidTokenError).reason).toBe(reason);
  }

  beforeEach(() => {
    idp = new FakeIdp();
    clock = T0;
    apple = new JwksCache({ url: APPLE_JWKS_URL, fetch: idp.fetch, now: () => clock });
    google = new JwksCache({ url: GOOGLE_JWKS_URL, fetch: idp.fetch, now: () => clock });
  });

  it('accepts a valid Apple token and returns sub + matched aud', async () => {
    const c = await verifyApple(signJwt(idp.appleKeys[0], appleClaims(clock)));
    expect(c.sub).toBe('apple-sub-1');
    expect(c.aud).toBe(APPLE_AUD);
  });

  it('accepts both Google issuer spellings and any allowed audience (array aud too)', async () => {
    const k = idp.googleKeys[0];
    expect((await verifyGoogle(signJwt(k, googleClaims(clock)))).sub).toBe('1000001');
    expect((await verifyGoogle(signJwt(k, googleClaims(clock, { iss: 'accounts.google.com' })))).sub).toBe('1000001');
    expect((await verifyGoogle(signJwt(k, googleClaims(clock, { aud: GOOGLE_AUD_ANDROID })))).aud).toBe(GOOGLE_AUD_ANDROID);
    expect((await verifyGoogle(signJwt(k, googleClaims(clock, { aud: ['other', GOOGLE_AUD] })))).aud).toBe(GOOGLE_AUD);
    // email_verified is not required (email is not stored)
    expect((await verifyGoogle(signJwt(k, googleClaims(clock, { email: 'x@example.com', email_verified: false })))).sub).toBe('1000001');
  });

  it('rejects alg none, HS256 (key confusion), ES256 and missing alg', async () => {
    const pub = idp.appleKeys[0].publicKey.export({ format: 'pem', type: 'spki' }) as string;
    await refused(verifyApple(noneJwt(appleClaims(clock), 'apple-k1')), 'alg');
    await refused(verifyApple(hs256Jwt(pub, appleClaims(clock), 'apple-k1')), 'alg');
    await refused(verifyApple(signJwt(idp.appleKeys[0], appleClaims(clock), { alg: 'ES256' })), 'alg');
    await refused(verifyApple(signJwt(idp.appleKeys[0], appleClaims(clock), { alg: undefined })), 'alg');
    await refused(verifyApple(signJwt(idp.appleKeys[0], appleClaims(clock), { alg: 'rs256' })), 'alg');
    expect(idp.count(APPLE_JWKS_URL)).toBe(0); // refused before any key lookup
  });

  it('rejects wrong iss, aud, expired, future iat, too old iat, nbf in future, missing sub', async () => {
    const k = idp.appleKeys[0];
    await refused(verifyApple(signJwt(k, appleClaims(clock, { iss: 'https://accounts.google.com' }))), 'iss');
    await refused(verifyApple(signJwt(k, appleClaims(clock, { iss: 'https://appleid.apple.com/' }))), 'iss');
    await refused(verifyApple(signJwt(k, appleClaims(clock, { aud: 'com.someone.else' }))), 'aud');
    await refused(verifyApple(signJwt(k, appleClaims(clock, { aud: [] }))), 'aud');
    await refused(verifyGoogle(signJwt(idp.googleKeys[0], googleClaims(clock, { iss: 'https://appleid.apple.com' }))), 'iss');
    const t = Math.floor(clock / 1000);
    await refused(verifyApple(signJwt(k, appleClaims(clock, { exp: t - 61 }))), 'exp');
    await refused(verifyApple(signJwt(k, appleClaims(clock, { exp: '9999999999' }))), 'exp');
    await refused(verifyApple(signJwt(k, appleClaims(clock, { iat: t + 120 }))), 'iat');
    await refused(verifyApple(signJwt(k, appleClaims(clock, { iat: t - 2 * 86400, exp: t + 600 }))), 'iat');
    await refused(verifyApple(signJwt(k, appleClaims(clock, { nbf: t + 600 }))), 'nbf');
    await refused(verifyApple(signJwt(k, appleClaims(clock, { sub: '' }))), 'sub');
    await refused(verifyApple(signJwt(k, appleClaims(clock, { sub: 42 }))), 'sub');
  });

  it('allows 60 s clock skew on exp and iat', async () => {
    const t = Math.floor(clock / 1000);
    const k = idp.appleKeys[0];
    await verifyApple(signJwt(k, appleClaims(clock, { exp: t - 30 })));
    await verifyApple(signJwt(k, appleClaims(clock, { iat: t + 30 })));
  });

  it('rejects a bad signature, a token signed by another key with the same kid, and tampering', async () => {
    const k = idp.appleKeys[0];
    const good = signJwt(k, appleClaims(clock));
    const [h, , s] = good.split('.');
    const forgedPayload = Buffer.from(JSON.stringify(appleClaims(clock, { sub: 'attacker' }))).toString('base64url');
    await refused(verifyApple(`${h}.${forgedPayload}.${s}`), 'signature');
    const impostor = { ...rsaKey('apple-k1') };
    await refused(verifyApple(signJwt(impostor, appleClaims(clock))), 'signature');
    await refused(verifyApple(good.slice(0, -4) + 'AAAA'), 'signature');
  });

  it('rejects malformed tokens', async () => {
    for (const t of [undefined, 42, '', 'a.b', 'a.b.c.d', '..', '%%%.e30.sig', 'x'.repeat(9000), `${Buffer.from('not json').toString('base64url')}.e30.c2ln`]) {
      await refused(verifyApple(t), 'malformed');
    }
    await refused(verifyApple(signJwt(idp.appleKeys[0], appleClaims(clock), { kid: undefined })), 'kid');
    await refused(verifyApple(signJwt(idp.appleKeys[0], appleClaims(clock), { crit: ['exp'] })), 'crit');
  });

  it('unknown kid refreshes JWKS once (key rotation), at most once per minute', async () => {
    await verifyApple(signJwt(idp.appleKeys[0], appleClaims(clock)));
    expect(idp.count(APPLE_JWKS_URL)).toBe(1);
    // Apple rotates: new key appears
    const k2 = rsaKey('apple-k2');
    idp.appleKeys.push(k2);
    clock += 61_000;
    await verifyApple(signJwt(k2, appleClaims(clock)));
    expect(idp.count(APPLE_JWKS_URL)).toBe(2);
    // random kids within the same minute cause no further fetches
    const stranger = rsaKey('random-kid');
    for (let i = 0; i < 5; i++) await refused(verifyApple(signJwt(stranger, appleClaims(clock), { kid: `random-${i}` })), 'unknown kid');
    expect(idp.count(APPLE_JWKS_URL)).toBe(2);
    clock += 60_000;
    await refused(verifyApple(signJwt(stranger, appleClaims(clock))), 'unknown kid');
    expect(idp.count(APPLE_JWKS_URL)).toBe(3);
  });

  it('concurrent verifications share one JWKS fetch', async () => {
    const tokens = Array.from({ length: 5 }, () => signJwt(idp.appleKeys[0], appleClaims(clock)));
    await Promise.all(tokens.map(verifyApple));
    expect(idp.count(APPLE_JWKS_URL)).toBe(1);
  });

  it('caches by Cache-Control max-age, with a 1 hour minimum', async () => {
    const tok = () => signJwt(idp.appleKeys[0], appleClaims(clock));
    await verifyApple(tok());
    clock += 7199_000; // max-age=7200
    await verifyApple(tok());
    expect(idp.count(APPLE_JWKS_URL)).toBe(1);
    clock += 2000;
    await verifyApple(tok());
    expect(idp.count(APPLE_JWKS_URL)).toBe(2);

    idp.jwksCacheControl = 'max-age=60';
    clock += 3 * 3600_000;
    await verifyApple(tok());
    expect(idp.count(APPLE_JWKS_URL)).toBe(3);
    clock += 30 * 60_000; // 60 s requested, but at least 1 h is kept
    await verifyApple(tok());
    expect(idp.count(APPLE_JWKS_URL)).toBe(3);
  });

  it('keeps old keys when a refresh fails; no keys at all -> JwksUnavailableError', async () => {
    idp.jwksDown = true;
    const err = await verifyApple(signJwt(idp.appleKeys[0], appleClaims(clock))).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(JwksUnavailableError);
    idp.jwksDown = false;
    // within the minute: no refetch, still unavailable
    expect(await verifyApple(signJwt(idp.appleKeys[0], appleClaims(clock))).catch((e: unknown) => e)).toBeInstanceOf(JwksUnavailableError);
    clock += 61_000;
    await verifyApple(signJwt(idp.appleKeys[0], appleClaims(clock)));
    idp.jwksDown = true;
    clock += 25 * 3600_000; // cache expired, provider down -> previous keys still verify
    await verifyApple(signJwt(idp.appleKeys[0], appleClaims(clock)));
  });

  it('ignores RSA keys shorter than 2048 bits and non-RSA / non-sig keys', async () => {
    const weak = rsaKey('weak', 1024);
    idp.appleKeys = [weak, idp.appleKeys[0]];
    await refused(verifyApple(signJwt(weak, appleClaims(clock))), 'unknown kid');
    const encKey = rsaKey('enc');
    const fetchFn = async () =>
      new Response(JSON.stringify({ keys: [{ ...jwk(encKey), use: 'enc' }, { kty: 'EC', kid: 'ec', crv: 'P-256', x: 'a', y: 'b' }] }), { status: 200 });
    const cache = new JwksCache({ url: APPLE_JWKS_URL, fetch: fetchFn, now: () => clock });
    const err = await verifyIdToken(signJwt(encKey, appleClaims(clock)), { jwks: cache, issuers: APPLE_ISSUERS, audiences: [APPLE_AUD], now: () => clock }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(JwksUnavailableError);
  });
});
