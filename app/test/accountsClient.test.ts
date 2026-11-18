import { describe, expect, it } from 'vitest';
import { tr } from '../src/i18n/tr';
import { en } from '../src/i18n/locales/en';
import {
  AccountsError,
  type Me,
  type ReasonCode,
  TOKEN_KEY,
  type TokenStorage,
  createAccountsClient,
  validName,
} from '../src/net/accountsClient';
import { REASON_KEYS, errorKey, isWaiting, photoStatusKey, reasonKeys } from '../src/net/photoStatus';

const me = (o: Partial<Me> = {}): Me => ({
  accountId: 'a1',
  providers: [],
  displayName: null,
  photoConsent: false,
  uploadsLeftToday: 3,
  photo: { status: 'none', reasons: [], url: null },
  ...o,
});

function memStorage(initial?: string): TokenStorage & { data: Map<string, string> } {
  const data = new Map<string, string>(initial ? [[TOKEN_KEY, initial]] : []);
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
}

interface Call {
  method: string;
  url: string;
  auth: string | null;
  type: string | null;
  body: unknown;
}

/** Fake server: `handler` answers each call; every call is recorded. */
function fakeFetch(handler: (c: Call, n: number) => { status: number; json?: unknown }) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const h = (init.headers ?? {}) as Record<string, string>;
    const c: Call = { method: init.method ?? 'GET', url, auth: h.Authorization ?? null, type: h['Content-Type'] ?? null, body: init.body };
    calls.push(c);
    const r = handler(c, calls.length);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.json } as unknown as Response;
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe('accounts client', () => {
  it('is off without a base URL', async () => {
    const c = createAccountsClient({ baseUrl: undefined, storage: memStorage() });
    expect(c.enabled()).toBe(false);
    await expect(c.getMe()).rejects.toBeInstanceOf(AccountsError);
  });

  it('opens a guest account on first use and keeps the token', async () => {
    const storage = memStorage();
    const { calls, fetchImpl } = fakeFetch((c) =>
      c.url.endsWith('/guest') ? { status: 201, json: { accountId: 'a1', token: 'tok1' } } : { status: 200, json: me() },
    );
    const c = createAccountsClient({ baseUrl: 'https://acc.example/', storage, fetchImpl });
    await c.getMe();
    await c.getMe();
    expect(calls.map((x) => `${x.method} ${x.url}`)).toEqual([
      'POST https://acc.example/v1/accounts/guest',
      'GET https://acc.example/v1/me',
      'GET https://acc.example/v1/me',
    ]);
    expect(calls[1].auth).toBe('Bearer tok1');
    expect(storage.data.get(TOKEN_KEY)).toBe('tok1');
  });

  it('reuses a stored token without a guest call', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ({ status: 200, json: me() }));
    const c = createAccountsClient({ baseUrl: 'https://x', storage: memStorage('saved'), fetchImpl });
    await c.getMe();
    expect(calls).toHaveLength(1);
    expect(calls[0].auth).toBe('Bearer saved');
  });

  it('on 401 drops the token, opens a new guest once and retries', async () => {
    const storage = memStorage('old');
    const { calls, fetchImpl } = fakeFetch((c) => {
      if (c.url.endsWith('/guest')) return { status: 201, json: { accountId: 'a2', token: 'new' } };
      return c.auth === 'Bearer new' ? { status: 200, json: me({ accountId: 'a2' }) } : { status: 401, json: { error: 'unauthorized' } };
    });
    const c = createAccountsClient({ baseUrl: 'https://x', storage, fetchImpl });
    expect((await c.getMe()).accountId).toBe('a2');
    expect(calls).toHaveLength(3);
    expect(storage.data.get(TOKEN_KEY)).toBe('new');
  });

  it('gives up after one retry when the new account is also refused', async () => {
    const { calls, fetchImpl } = fakeFetch((c) =>
      c.url.endsWith('/guest') ? { status: 201, json: { token: 't' } } : { status: 401, json: { error: 'unauthorized' } },
    );
    const c = createAccountsClient({ baseUrl: 'https://x', storage: memStorage('old'), fetchImpl });
    await expect(c.getMe()).rejects.toMatchObject({ code: 'unauthorized' });
    expect(calls).toHaveLength(3);
  });

  it('sends consent, name and the JPEG with the right shape', async () => {
    const { calls, fetchImpl } = fakeFetch(() => ({ status: 200, json: me() }));
    const blob = new Blob([new Uint8Array([0xff, 0xd8])]);
    const c = createAccountsClient({ baseUrl: 'https://x', storage: memStorage('t'), fetchImpl, readFile: async () => blob });
    await c.giveConsent();
    await c.setName('  Ayşe ');
    await c.uploadPhoto('file:///a.jpg');
    await c.deletePhoto();
    expect(calls[0]).toMatchObject({ method: 'POST', url: 'https://x/v1/me/consent', type: 'application/json', body: '{"kind":"photo","version":1}' });
    expect(calls[1]).toMatchObject({ method: 'PATCH', url: 'https://x/v1/me', body: '{"displayName":"Ayşe"}' });
    expect(calls[2]).toMatchObject({ method: 'POST', url: 'https://x/v1/me/photo', type: 'image/jpeg', body: blob });
    expect(calls[3]).toMatchObject({ method: 'DELETE', url: 'https://x/v1/me/photo' });
  });

  it('maps error bodies to codes', async () => {
    const codes = ['rate_limited', 'consent_required', 'bad_image', 'too_large'] as const;
    for (const code of codes) {
      const { fetchImpl } = fakeFetch(() => ({ status: 400, json: { error: code } }));
      const c = createAccountsClient({ baseUrl: 'https://x', storage: memStorage('t'), fetchImpl });
      await expect(c.deletePhoto()).rejects.toMatchObject({ code });
    }
    const { fetchImpl } = fakeFetch(() => ({ status: 500, json: { error: 'weird' } }));
    const c = createAccountsClient({ baseUrl: 'https://x', storage: memStorage('t'), fetchImpl });
    await expect(c.getMe()).rejects.toMatchObject({ code: 'unknown', status: 500 });
  });

  it('reports a dead network as "network"', async () => {
    const fetchImpl = (async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    const c = createAccountsClient({ baseUrl: 'https://x', storage: memStorage('t'), fetchImpl });
    await expect(c.getMe()).rejects.toMatchObject({ code: 'network' });
  });

  it('deleteAccount forgets the token', async () => {
    const storage = memStorage('t');
    const { calls, fetchImpl } = fakeFetch(() => ({ status: 204 }));
    const c = createAccountsClient({ baseUrl: 'https://x', storage, fetchImpl });
    await c.deleteAccount();
    expect(calls[0]).toMatchObject({ method: 'DELETE', url: 'https://x/v1/me' });
    expect(storage.data.has(TOKEN_KEY)).toBe(false);
  });

  it('builds an absolute photo address only for approved photos', () => {
    const c = createAccountsClient({ baseUrl: 'https://x/', storage: memStorage() });
    expect(c.photoUrl(me())).toBeNull();
    expect(c.photoUrl(me({ photo: { status: 'approved', reasons: [], url: '/v1/photos/a1.jpg?v=2' } }))).toBe('https://x/v1/photos/a1.jpg?v=2');
    expect(c.photoUrl(null)).toBeNull();
  });

  it('checks the name length rule', () => {
    expect(validName('A')).toBe(false);
    expect(validName(' Ay ')).toBe(true);
    expect(validName('a'.repeat(16))).toBe(true);
    expect(validName('a'.repeat(17))).toBe(false);
  });
});

describe('photo status texts', () => {
  it('maps each status to a text key (review looks like pending)', () => {
    expect(photoStatusKey('none')).toBe('profPhotoNone');
    expect(photoStatusKey('pending')).toBe('profPhotoPending');
    expect(photoStatusKey('review')).toBe('profPhotoPending');
    expect(photoStatusKey('approved')).toBe('profPhotoApproved');
    expect(photoStatusKey('rejected')).toBe('profPhotoRejected');
    expect(isWaiting('review') && isWaiting('pending')).toBe(true);
    expect(isWaiting('approved') || isWaiting('rejected') || isWaiting('none')).toBe(false);
  });

  it('has a friendly text for every reason code, in Turkish and English', () => {
    const all: ReasonCode[] = ['nudity', 'violence', 'hate', 'selfHarm', 'text', 'symbol', 'child', 'otherPerson', 'document', 'other'];
    for (const r of all) {
      expect(tr[REASON_KEYS[r]]).toBeTruthy();
      expect(en[REASON_KEYS[r]]).toBeTruthy();
    }
    expect(reasonKeys(['text', 'text', 'newCode'])).toEqual(['profReasonText', 'profReasonOther']);
  });

  it('maps errors to texts', () => {
    expect(errorKey('rate_limited')).toBe('profErrLimit');
    expect(errorKey('bad_image')).toBe('profErrImage');
    expect(errorKey('permission')).toBe('profErrPerm');
    expect(errorKey('network')).toBe('profErrNet');
    expect(errorKey('already_linked')).toBe('profErrLinked');
    expect(errorKey('invalid_token')).toBe('profErrToken');
    expect(errorKey('not_configured')).toBe('profErrSignInOff');
  });
});

describe('sign-in calls', () => {
  it('links Apple to the guest account: Bearer sent, token kept, empty fields left out', async () => {
    const storage = memStorage('guest1');
    const { calls, fetchImpl } = fakeFetch(() => ({ status: 200, json: { accountId: 'a1', token: 'guest1', switched: false } }));
    const c = createAccountsClient({ baseUrl: 'https://x', storage, fetchImpl });
    const r = await c.signInApple({ identityToken: 'idt', authorizationCode: 'code', fullName: '  Ayşe Y ' });
    expect(r).toEqual({ accountId: 'a1', token: 'guest1', switched: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'POST', url: 'https://x/v1/auth/apple', auth: 'Bearer guest1', type: 'application/json' });
    expect(JSON.parse(calls[0].body as string)).toEqual({ identityToken: 'idt', authorizationCode: 'code', fullName: 'Ayşe Y' });
    await c.signInApple({ identityToken: 'idt', authorizationCode: null, fullName: '  ' });
    expect(JSON.parse(calls[1].body as string)).toEqual({ identityToken: 'idt' });
  });

  it('switched: stores the other account token and uses it afterwards', async () => {
    const storage = memStorage('guest1');
    const { calls, fetchImpl } = fakeFetch((c) =>
      c.url.endsWith('/v1/auth/google') ? { status: 200, json: { accountId: 'old', token: 'oldTok', switched: true } } : { status: 200, json: me({ accountId: 'old' }) },
    );
    const c = createAccountsClient({ baseUrl: 'https://x', storage, fetchImpl });
    const r = await c.signInGoogle('gid');
    expect(r.switched).toBe(true);
    expect(storage.data.get(TOKEN_KEY)).toBe('oldTok');
    expect(JSON.parse(calls[0].body as string)).toEqual({ idToken: 'gid' });
    await c.getMe();
    expect(calls[1].auth).toBe('Bearer oldTok');
  });

  it('without a stored token it signs in with no Bearer and opens no guest', async () => {
    const storage = memStorage();
    const { calls, fetchImpl } = fakeFetch(() => ({ status: 200, json: { accountId: 'n', token: 'newTok', switched: false } }));
    const c = createAccountsClient({ baseUrl: 'https://x', storage, fetchImpl });
    await c.signInGoogle('gid');
    expect(calls).toHaveLength(1);
    expect(calls[0].auth).toBeNull();
    expect(storage.data.get(TOKEN_KEY)).toBe('newTok');
  });

  it('a stale guest token (401) is dropped and the sign-in retried without it, once', async () => {
    const storage = memStorage('stale');
    const { calls, fetchImpl } = fakeFetch((c) =>
      c.auth ? { status: 401, json: { error: 'unauthorized' } } : { status: 200, json: { accountId: 'n', token: 'fresh', switched: false } },
    );
    const c = createAccountsClient({ baseUrl: 'https://x', storage, fetchImpl });
    await c.signInApple({ identityToken: 'i' });
    expect(calls.map((x) => x.auth)).toEqual(['Bearer stale', null]);
    expect(storage.data.get(TOKEN_KEY)).toBe('fresh');
  });

  it('maps the new error codes and keeps the old token on failure', async () => {
    for (const code of ['invalid_token', 'already_linked', 'not_configured'] as const) {
      const storage = memStorage('g');
      const { fetchImpl } = fakeFetch(() => ({ status: code === 'already_linked' ? 409 : code === 'not_configured' ? 503 : 401, json: { error: code } }));
      const c = createAccountsClient({ baseUrl: 'https://x', storage, fetchImpl });
      await expect(c.signInGoogle('t')).rejects.toMatchObject({ code });
      if (code !== 'invalid_token') expect(storage.data.get(TOKEN_KEY)).toBe('g');
    }
  });

  it('rejects an answer without a token', async () => {
    const { fetchImpl } = fakeFetch(() => ({ status: 200, json: { accountId: 'a' } }));
    const c = createAccountsClient({ baseUrl: 'https://x', storage: memStorage(), fetchImpl });
    await expect(c.signInGoogle('t')).rejects.toMatchObject({ code: 'unknown' });
  });
});
