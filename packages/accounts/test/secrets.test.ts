import { generateKeyPairSync, verify as cryptoVerify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AppleApiError, AppleClient, appleClientSecret, APPLE_REVOKE_URL, APPLE_TOKEN_URL, loadApplePrivateKey } from '../src/apple';
import { SecretBox } from '../src/secretBox';
import { APPLE_AUD, FakeIdp } from './idp';

const SECRET = 'test-only-secret-0123456789abcdefghijkl';

describe('SecretBox (AES-256-GCM)', () => {
  it('round-trips and never contains the plaintext', () => {
    const box = new SecretBox(SECRET);
    const sealed = box.seal('refresh-token-PLAINTEXT', 'apple:sub1');
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(sealed).not.toContain('PLAINTEXT');
    expect(Buffer.from(sealed.slice(3), 'base64url').toString('latin1')).not.toContain('PLAINTEXT');
    expect(box.open(sealed, 'apple:sub1')).toBe('refresh-token-PLAINTEXT');
    expect(box.seal('x', 'a')).not.toBe(box.seal('x', 'a')); // random IV
  });

  it('refuses tampering, another row (aad), another secret and garbage', () => {
    const box = new SecretBox(SECRET);
    const sealed = box.seal('rt', 'apple:sub1');
    const raw = Buffer.from(sealed.slice(3), 'base64url');
    raw[raw.length - 1] ^= 1;
    expect(box.open('v1.' + raw.toString('base64url'), 'apple:sub1')).toBeNull();
    expect(box.open(sealed, 'apple:sub2')).toBeNull();
    expect(new SecretBox(SECRET + 'x').open(sealed, 'apple:sub1')).toBeNull();
    for (const g of ['', 'v1.', 'v2.' + sealed.slice(3), 'v1.AAAA']) expect(box.open(g, 'apple:sub1')).toBeNull();
  });

  it('requires a secret of at least 32 characters', () => {
    expect(() => new SecretBox('short')).toThrow();
    expect(() => new SecretBox('')).toThrow();
  });
});

describe('Apple client (ES256 client_secret, token exchange, revoke)', () => {
  const ec = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pem = ec.privateKey.export({ format: 'pem', type: 'pkcs8' }) as string;
  const NOW = Date.UTC(2026, 10, 18, 12, 0, 0);

  function checkClientSecret(jwt: string) {
    const [h, p, s] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'KEYID12345' });
    const iat = Math.floor(NOW / 1000);
    expect(JSON.parse(Buffer.from(p, 'base64url').toString())).toEqual({
      iss: 'TEAMID1234',
      iat,
      exp: iat + 300,
      aud: 'https://appleid.apple.com',
      sub: APPLE_AUD,
    });
    const sig = Buffer.from(s, 'base64url');
    expect(sig.length).toBe(64); // raw r||s (ieee-p1363), not DER
    expect(cryptoVerify('sha256', Buffer.from(`${h}.${p}`), { key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, sig)).toBe(true);
  }

  it('client_secret is a valid ES256 JWT', () => {
    checkClientSecret(appleClientSecret({ teamId: 'TEAMID1234', keyId: 'KEYID12345', key: loadApplePrivateKey(pem), clientId: APPLE_AUD, nowMs: NOW }));
  });

  it('rejects non P-256 keys', () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    expect(() => loadApplePrivateKey(rsa)).toThrow();
    expect(() => loadApplePrivateKey(generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).privateKey)).toThrow();
  });

  it('exchanges a code (form body, sub check) and revokes', async () => {
    const idp = new FakeIdp();
    const client = new AppleClient({ teamId: 'TEAMID1234', keyId: 'KEYID12345', privateKey: pem }, { fetch: idp.fetch, now: () => NOW });
    expect(await client.exchangeCode('code-1', APPLE_AUD, 'apple-sub-1')).toBe('RT-code-1');
    const form = new URLSearchParams(idp.calls.find((c) => c.url === APPLE_TOKEN_URL)!.body);
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('client_id')).toBe(APPLE_AUD);
    expect(form.get('code')).toBe('code-1');
    checkClientSecret(form.get('client_secret')!);

    await expect(client.exchangeCode('code-2', APPLE_AUD, 'someone-else')).rejects.toThrow('sub mismatch');
    idp.tokenResponse = () => ({ status: 400, body: { error: 'invalid_grant' } });
    await expect(client.exchangeCode('code-3', APPLE_AUD, 'apple-sub-1')).rejects.toThrow(AppleApiError);

    await client.revoke('RT-code-1', APPLE_AUD);
    const rform = new URLSearchParams(idp.calls.find((c) => c.url === APPLE_REVOKE_URL)!.body);
    expect(rform.get('token')).toBe('RT-code-1');
    expect(rform.get('token_type_hint')).toBe('refresh_token');
    expect(rform.get('client_id')).toBe(APPLE_AUD);
    checkClientSecret(rform.get('client_secret')!);
    idp.revokeStatus = 400;
    const err = await client.revoke('RT-code-1', APPLE_AUD).catch((e: unknown) => e as Error);
    expect(err).toBeInstanceOf(AppleApiError);
    expect((err as Error).message).not.toContain('RT-code-1');
  });
});
