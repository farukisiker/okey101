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

/** E2 report reasons and where the behaviour happened (docs/kahve/tasks/E2-OPUS-SONNET.md). */
export type ReportReason = 'insult' | 'harass' | 'askGift' | 'spam' | 'other';
export type ReportContext = 'voice' | 'saying' | 'photo' | 'name';

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
  /** E2: epoch ms until which this account's voice chat is closed (after reports); null/missing = open. */
  voiceBannedUntil?: number | null;
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
  /** Clock, for the table pass cache (tests). Default Date.now. */
  now?(): number;
}

export const TOKEN_KEY = 'accounts.token';
export const NAME_MIN = 2;
export const NAME_MAX = 16;
export const PHOTO_CONSENT_VERSION = 1;
/** E2b: a cached table pass is replaced once it has less than this left (the pass lives 6 h). */
export const TABLE_PASS_REFRESH_MS = 10 * 60 * 1000;

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
  let myId: string | null = null;
  let passCache: { pass: string; expiresAt: number } | null = null;
  let passInFlight: Promise<string | null> | null = null;
  const now = () => (deps.now ? deps.now() : Date.now());

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
        myId = null;
        passCache = null;
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
    myId = j.accountId;
    passCache = null;
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
    /** E2: the signed-in account's id (cached after the first getMe), or null when it can't be read. */
    async myAccountId(): Promise<string | null> {
      if (myId) return myId;
      try {
        myId = (await (await call('GET', '/v1/me')).json() as Me).accountId;
      } catch {
        return null;
      }
      return myId;
    },
    /**
     * E2b: a short-lived signed table pass that proves to a game server who is sitting. Cached until 10 minutes
     * before it expires. 503 (server has no secret), any error, or a malformed answer -> null, silently: the
     * person still sits, just as a guest without report/block/voice-ban identity.
     */
    async tablePass(): Promise<string | null> {
      if (!enabled()) return null;
      if (passCache && passCache.expiresAt - now() > TABLE_PASS_REFRESH_MS) return passCache.pass;
      if (!passInFlight) {
        passInFlight = (async () => {
          try {
            const j = (await (await call('GET', '/v1/me/table-pass')).json()) as { pass?: unknown; expiresAt?: unknown };
            if (typeof j.pass !== 'string' || !j.pass || typeof j.expiresAt !== 'number') return null;
            passCache = { pass: j.pass, expiresAt: j.expiresAt };
            return j.pass;
          } catch {
            return null;
          }
        })().finally(() => {
          passInFlight = null;
        });
      }
      return passInFlight;
    },
    /** E2: reports another account (204). Own account -> bad_request, over the daily limit -> rate_limited. */
    async report(targetAccountId: string, reason: ReportReason, context?: ReportContext): Promise<void> {
      const body: Record<string, string> = { targetAccountId, reason };
      if (context) body.context = context;
      await call('POST', '/v1/reports', json(body), 'application/json');
    },
    /** E2: accounts this account blocked. */
    async getBlocks(): Promise<string[]> {
      const j = (await (await call('GET', '/v1/blocks')).json()) as { blocked?: unknown };
      return Array.isArray(j.blocked) ? j.blocked.filter((x): x is string => typeof x === 'string') : [];
    },
    async blockAccount(accountId: string): Promise<void> {
      await call('PUT', `/v1/blocks/${encodeURIComponent(accountId)}`);
    },
    async unblockAccount(accountId: string): Promise<void> {
      await call('DELETE', `/v1/blocks/${encodeURIComponent(accountId)}`);
    },
    /** Deletes the account on the server and forgets the token. */
    async deleteAccount(): Promise<void> {
      await call('DELETE', '/v1/me');
      token = null;
      myId = null;
      passCache = null;
      await deps.storage.removeItem(TOKEN_KEY).catch(() => {});
    },
  };
}

export type AccountsClient = ReturnType<typeof createAccountsClient>;
