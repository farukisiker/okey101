// Client side of the accounts HTTP contract (docs/kahve/tasks/E1-OPUS-SONNET.md).
// No React Native imports here: storage and fetch are injected, so the vitest suite can run it in Node.

export type PhotoStatus = 'none' | 'pending' | 'review' | 'approved' | 'rejected';
export type ReasonCode =
  | 'nudity'
  | 'violence'
  | 'hate'
  | 'selfHarm'
  | 'text'
  | 'symbol'
  | 'child'
  | 'otherPerson'
  | 'document'
  | 'other';

export type Provider = 'apple' | 'google';

/** `switched`: the sign-in belonged to an existing account, so this device now uses that one instead. */
export interface AuthResult {
  accountId: string;
  token: string;
  switched: boolean;
}

export interface Me {
  accountId: string;
  /** Sign-in identities linked to the account; empty for a plain guest. */
  providers: Provider[];
  displayName: string | null;
  photoConsent: boolean;
  uploadsLeftToday: number;
  /** `url` is a server-relative path, only present when approved. Use photoUrl(). */
  photo: { status: PhotoStatus; reasons: ReasonCode[]; url: string | null };
}

/** Error codes from the server, plus `network` (no answer) and `unknown` (anything unexpected). */
export type AccountsErrorCode =
  | 'unauthorized'
  | 'bad_request'
  | 'too_large'
  | 'bad_image'
  | 'rate_limited'
  | 'consent_required'
  | 'not_found'
  | 'invalid_token'
  | 'already_linked'
  | 'not_configured'
  | 'unavailable'
  | 'network'
  | 'unknown';

const KNOWN: AccountsErrorCode[] = ['unauthorized', 'bad_request', 'too_large', 'bad_image', 'rate_limited', 'consent_required', 'not_found', 'invalid_token', 'already_linked', 'not_configured', 'unavailable'];

export class AccountsError extends Error {
  constructor(
    readonly code: AccountsErrorCode,
    readonly status = 0,
  ) {
    super(code);
    this.name = 'AccountsError';
  }
}

export interface TokenStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface AccountsDeps {
  /** Base URL without a trailing slash needed; empty/undefined means the feature is off. */
  baseUrl: string | undefined;
  storage: TokenStorage;
  fetchImpl?: typeof fetch;
  /** Reads a local image file as a request body. Default: fetch(uri).blob(). */
  readFile?(uri: string): Promise<Blob>;
}

export const TOKEN_KEY = 'accounts.token';
export const NAME_MIN = 2;
export const NAME_MAX = 16;
export const PHOTO_CONSENT_VERSION = 1;

/** Name rule from the contract: 2 to 16 characters after trimming. */
export function validName(name: string): boolean {
  const n = [...name.trim()].length;
  return n >= NAME_MIN && n <= NAME_MAX;
}

export function createAccountsClient(deps: AccountsDeps) {
  const base = (deps.baseUrl ?? '').trim().replace(/\/+$/, '');
  const doFetch: typeof fetch = deps.fetchImpl ?? ((...a) => fetch(...a));
  const readFile = deps.readFile ?? (async (uri: string) => (await doFetch(uri)).blob());
  let token: string | null = null;
  let guestInFlight: Promise<string> | null = null;

  const enabled = () => base.length > 0;

  async function send(method: string, path: string, auth: string | null, body?: BodyInit | null, contentType?: string): Promise<Response> {
    const headers: Record<string, string> = {};
    if (auth) headers.Authorization = `Bearer ${auth}`;
    if (contentType) headers['Content-Type'] = contentType;
    try {
      return await doFetch(base + path, { method, headers, body: body ?? undefined });
    } catch {
      throw new AccountsError('network');
    }
  }

  async function fail(res: Response): Promise<never> {
    let code: AccountsErrorCode = 'unknown';
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error && (KNOWN as string[]).includes(j.error)) code = j.error as AccountsErrorCode;
    } catch {
      // body was not JSON
    }
    throw new AccountsError(code, res.status);
  }

  async function createGuest(): Promise<string> {
    if (!guestInFlight) {
      guestInFlight = (async () => {
        const res = await send('POST', '/v1/accounts/guest', null, '{}', 'application/json');
        if (res.status !== 201 && !res.ok) return fail(res);
        const j = (await res.json()) as { token?: string };
        if (!j.token) throw new AccountsError('unknown', res.status);
        token = j.token;
        await deps.storage.setItem(TOKEN_KEY, j.token).catch(() => {});
        return j.token;
      })().finally(() => {
        guestInFlight = null;
      });
    }
    return guestInFlight;
  }

  async function ensureToken(): Promise<string> {
    if (token) return token;
    const saved = await deps.storage.getItem(TOKEN_KEY).catch(() => null);
    if (saved) {
      token = saved;
      return saved;
    }
    return createGuest();
  }

  /** Authenticated call. A 401 drops the token and opens a new guest account, once. */
  async function call(method: string, path: string, body?: BodyInit | null, contentType?: string): Promise<Response> {
    if (!enabled()) throw new AccountsError('unknown');
    let res = await send(method, path, await ensureToken(), body, contentType);
    if (res.status === 401) {
      token = null;
      await deps.storage.removeItem(TOKEN_KEY).catch(() => {});
      res = await send(method, path, await createGuest(), body, contentType);
    }
    if (!res.ok) return fail(res);
    return res;
  }

  const json = (data: unknown) => JSON.stringify(data);

  /**
   * Sign-in call. The guest token is optional on the server: with it the identity is linked to the guest account,
   * without it a new account is opened (or the existing one returned). Never creates a guest just to sign in.
   * The returned token replaces the stored one.
   */
  async function auth(path: string, body: Record<string, unknown>): Promise<AuthResult> {
    if (!enabled()) throw new AccountsError('unknown');
    const saved = token ?? (await deps.storage.getItem(TOKEN_KEY).catch(() => null));
    let res = await send('POST', path, saved, json(body), 'application/json');
    if (res.status === 401 && saved) {
      // Stale guest token: drop it and sign in without it.
      token = null;
      await deps.storage.removeItem(TOKEN_KEY).catch(() => {});
      res = await send('POST', path, null, json(body), 'application/json');
    }
    if (!res.ok) return fail(res);
    const j = (await res.json()) as Partial<AuthResult>;
    if (!j.token || !j.accountId) throw new AccountsError('unknown', res.status);
    token = j.token;
    await deps.storage.setItem(TOKEN_KEY, j.token).catch(() => {});
    return { accountId: j.accountId, token: j.token, switched: j.switched === true };
  }

  return {
    enabled,
    /** Absolute address of an approved photo, or null. */
    photoUrl(me: Me | null): string | null {
      const u = me?.photo.url;
      if (!u) return null;
      return /^https?:\/\//.test(u) ? u : base + u;
    },
    async getMe(): Promise<Me> {
      return (await call('GET', '/v1/me')).json() as Promise<Me>;
    },
    async setName(displayName: string): Promise<Me> {
      return (await call('PATCH', '/v1/me', json({ displayName: displayName.trim() }), 'application/json')).json() as Promise<Me>;
    },
    async giveConsent(): Promise<Me> {
      return (await call('POST', '/v1/me/consent', json({ kind: 'photo', version: PHOTO_CONSENT_VERSION }), 'application/json')).json() as Promise<Me>;
    },
    /** `uri` is the already prepared 256x256 JPEG. */
    async uploadPhoto(uri: string): Promise<Me> {
      let body: Blob;
      try {
        body = await readFile(uri);
      } catch {
        throw new AccountsError('bad_image');
      }
      return (await call('POST', '/v1/me/photo', body, 'image/jpeg')).json() as Promise<Me>;
    },
    async deletePhoto(): Promise<Me> {
      return (await call('DELETE', '/v1/me/photo')).json() as Promise<Me>;
    },
    /** Links an Apple identity to this account (or returns to the account it already belongs to). */
    async signInApple(p: { identityToken: string; authorizationCode?: string | null; fullName?: string | null }): Promise<AuthResult> {
      const body: Record<string, unknown> = { identityToken: p.identityToken };
      if (p.authorizationCode) body.authorizationCode = p.authorizationCode;
      const name = p.fullName?.trim();
      if (name) body.fullName = name;
      return auth('/v1/auth/apple', body);
    },
    async signInGoogle(idToken: string): Promise<AuthResult> {
      return auth('/v1/auth/google', { idToken });
    },
    /** Deletes the account on the server and forgets the token. */
    async deleteAccount(): Promise<void> {
      await call('DELETE', '/v1/me');
      token = null;
      await deps.storage.removeItem(TOKEN_KEY).catch(() => {});
    },
  };
}

export type AccountsClient = ReturnType<typeof createAccountsClient>;
