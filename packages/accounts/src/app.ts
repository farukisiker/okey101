import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { ADMIN_STATUSES, renderAdminPage } from './admin';
import { BadJpegError, cleanJpeg } from './jpeg';
import { runModeration, type ModerationLayer, type ModerationResult } from './moderation';
import type { AccountRecord, AccountStore } from './store';
import { isReasonCode, type ErrorCode, type Me, type PhotoStatus, type ReasonCode } from './types';

export const PHOTO_CONSENT_VERSION = 1;
export const DAILY_UPLOAD_LIMIT = 3;
export const GUEST_PER_IP_PER_HOUR = 10;
export const MAX_PHOTO_SIDE = 512;
export const MAX_PHOTO_BYTES = 150 * 1024;

export interface AccountsAppOptions {
  store: AccountStore;
  /** Moderation layers in order (layer 1 OpenAI, layer 2 Claude). Empty -> every photo goes to human review. */
  moderation: ModerationLayer[];
  /** Admin bearer token; missing or shorter than 16 chars disables the admin endpoints (always 401). */
  adminToken?: string;
  now?: () => number;
  moderationTimeoutMs?: number;
  /** Express "trust proxy" setting; needed behind a reverse proxy so the per-IP guest limit sees the client IP. */
  trustProxy?: boolean | number | string;
  /** Called after an account is deleted (place for Apple/Google token revocation). Errors are logged, not returned. */
  onAccountDeleted?: (accountId: string) => void | Promise<void>;
  log?: (msg: string, err?: unknown) => void;
}

export type AccountsApp = Express & {
  /** Resolves when all background moderation jobs started so far are finished (tests, graceful shutdown). */
  whenIdle(): Promise<void>;
};

const TOKEN_RE = /^Bearer ([A-Za-z0-9_-]{43})$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest();
const sha256hex = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function fail(res: Response, status: number, error: ErrorCode | 'internal'): void {
  res.status(status).json({ error });
}

/** Trims, NFC-normalizes and collapses whitespace; returns null when invalid (2–16 characters, no control chars). */
export function normalizeDisplayName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (/[\p{Cc}\p{Cf}\p{Co}\p{Cn}]/u.test(s)) return null;
  const len = [...s].length;
  return len >= 2 && len <= 16 ? s : null;
}

export function createAccountsApp(opts: AccountsAppOptions): AccountsApp {
  const { store, moderation } = opts;
  const now = opts.now ?? Date.now;
  const log = opts.log ?? ((m: string, e?: unknown) => console.error(`[accounts] ${m}`, e ?? ''));
  const adminHash = opts.adminToken && opts.adminToken.length >= 16 ? sha256(opts.adminToken) : null;
  const jobs = new Set<Promise<void>>();
  const guestHits = new Map<string, number[]>();

  const app = express() as AccountsApp;
  app.disable('x-powered-by');
  if (opts.trustProxy !== undefined) app.set('trust proxy', opts.trustProxy);
  app.whenIdle = async () => {
    while (jobs.size) await Promise.allSettled([...jobs]);
  };

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  const json = express.json({ limit: '4kb' });

  // ------------------------------------------------------------ helpers
  type AuthedReq = Request & { account?: AccountRecord };

  async function requireUser(req: AuthedReq, res: Response, next: NextFunction): Promise<void> {
    const m = TOKEN_RE.exec(req.get('authorization') ?? '');
    const acc = m ? await store.accountByTokenHash(sha256hex(m[1])) : null;
    if (!acc) return fail(res, 401, 'unauthorized');
    req.account = acc;
    next();
  }

  function isAdmin(req: Request): boolean {
    if (!adminHash) return false;
    const h = req.get('authorization') ?? '';
    if (!h.startsWith('Bearer ')) return false;
    return timingSafeEqual(sha256(h.slice(7)), adminHash);
  }

  function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    if (!isAdmin(req)) return fail(res, 401, 'unauthorized');
    res.setHeader('Cache-Control', 'no-store');
    next();
  }

  async function buildMe(acc: AccountRecord): Promise<Me> {
    const photo = await store.getPhotoMeta(acc.id);
    const used = await store.getUploads(acc.id, utcDay(now()));
    return {
      accountId: acc.id,
      displayName: acc.displayName,
      photoConsent: acc.photoConsentVersion >= PHOTO_CONSENT_VERSION,
      uploadsLeftToday: Math.max(0, DAILY_UPLOAD_LIMIT - used),
      photo: photo
        ? {
            status: photo.status,
            reasons: photo.status === 'rejected' ? photo.reasons : [],
            url: photo.status === 'approved' ? `/v1/photos/${acc.id}.jpg?v=${photo.version}` : null,
          }
        : { status: 'none', reasons: [], url: null },
    };
  }

  async function sendMe(req: AuthedReq, res: Response, status = 200): Promise<void> {
    const acc = await store.getAccount(req.account!.id);
    if (!acc) return fail(res, 401, 'unauthorized');
    res.status(status).json(await buildMe(acc));
  }

  function guestAllowed(ip: string): boolean {
    const t = now();
    const cutoff = t - 3600_000;
    if (guestHits.size > 10_000) {
      for (const [k, v] of guestHits) if (!v.some((x) => x > cutoff)) guestHits.delete(k);
    }
    const hits = (guestHits.get(ip) ?? []).filter((x) => x > cutoff);
    if (hits.length >= GUEST_PER_IP_PER_HOUR) {
      guestHits.set(ip, hits);
      return false;
    }
    hits.push(t);
    guestHits.set(ip, hits);
    return true;
  }

  function startModeration(accountId: string, version: number, jpeg: Buffer, hash: string): void {
    const job = (async () => {
      let result: ModerationResult;
      let fromBlocklist = false;
      try {
        const blocked = await store.blockedReasons(hash);
        if (blocked) {
          fromBlocklist = true;
          result = { verdict: 'reject', reasons: blocked.length ? blocked : ['other'] };
        } else {
          result = await runModeration(moderation, jpeg, {
            timeoutMs: opts.moderationTimeoutMs,
            onError: (layer, err) => log(`moderation layer ${layer} failed -> review`, err),
          });
        }
      } catch (err) {
        log('moderation failed -> review', err);
        result = { verdict: 'review', reasons: [] };
      }
      const status: PhotoStatus = result.verdict === 'ok' ? 'approved' : result.verdict === 'reject' ? 'rejected' : 'review';
      const applied = await store.setPhotoStatus(accountId, status, result.reasons, version);
      if (applied && status === 'rejected' && !fromBlocklist) await store.blockHash(hash, result.reasons, now());
    })().catch((err) => log('moderation job crashed', err));
    jobs.add(job);
    void job.finally(() => jobs.delete(job));
  }

  // ------------------------------------------------------------ user routes
  app.post('/v1/accounts/guest', json, async (req, res) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    if (!guestAllowed(ip)) return fail(res, 429, 'rate_limited');
    const accountId = randomUUID();
    const token = randomBytes(32).toString('base64url');
    await store.createAccount(accountId, sha256hex(token), now());
    res.status(201).json({ accountId, token });
  });

  app.get('/v1/me', requireUser, (req, res) => sendMe(req, res));

  app.patch('/v1/me', requireUser, json, async (req: AuthedReq, res) => {
    const body = req.body as unknown;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(res, 400, 'bad_request');
    if ('displayName' in body) {
      const name = normalizeDisplayName((body as { displayName: unknown }).displayName);
      if (name === null) return fail(res, 400, 'bad_request');
      await store.setDisplayName(req.account!.id, name);
    }
    await sendMe(req, res);
  });

  app.post('/v1/me/consent', requireUser, json, async (req: AuthedReq, res) => {
    const b = req.body as { kind?: unknown; version?: unknown } | undefined;
    if (!b || b.kind !== 'photo' || b.version !== PHOTO_CONSENT_VERSION) return fail(res, 400, 'bad_request');
    await store.setConsent(req.account!.id, 'photo', PHOTO_CONSENT_VERSION, now());
    await sendMe(req, res);
  });

  app.post(
    '/v1/me/photo',
    requireUser,
    async (req: AuthedReq, res, next) => {
      // Checked before reading the body so refused uploads cost nothing.
      if (req.account!.photoConsentVersion < PHOTO_CONSENT_VERSION) return fail(res, 403, 'consent_required');
      if ((await store.getUploads(req.account!.id, utcDay(now()))) >= DAILY_UPLOAD_LIMIT) return fail(res, 429, 'rate_limited');
      next();
    },
    express.raw({ type: 'image/jpeg', limit: MAX_PHOTO_BYTES }),
    async (req: AuthedReq, res) => {
      const raw = req.body as unknown;
      if (!Buffer.isBuffer(raw) || raw.length === 0) return fail(res, 400, 'bad_image');
      let clean;
      try {
        clean = cleanJpeg(raw);
      } catch (e) {
        if (e instanceof BadJpegError) return fail(res, 400, 'bad_image');
        throw e;
      }
      if (clean.width > MAX_PHOTO_SIDE || clean.height > MAX_PHOTO_SIDE) return fail(res, 400, 'bad_image');
      const id = req.account!.id;
      if ((await store.incrementUploads(id, utcDay(now()))) > DAILY_UPLOAD_LIMIT) return fail(res, 429, 'rate_limited');
      const hash = sha256hex(clean.jpeg);
      // A new upload replaces (and unpublishes) the previous photo immediately.
      const version = await store.putPhoto(id, { jpeg: clean.jpeg, sha256: hash, status: 'pending', uploadedAt: now() });
      startModeration(id, version, clean.jpeg, hash);
      await sendMe(req, res, 202);
    },
  );

  app.delete('/v1/me/photo', requireUser, async (req: AuthedReq, res) => {
    await store.deletePhoto(req.account!.id);
    await sendMe(req, res);
  });

  app.delete('/v1/me', requireUser, async (req: AuthedReq, res) => {
    const id = req.account!.id;
    await store.deleteAccount(id);
    try {
      await opts.onAccountDeleted?.(id);
    } catch (err) {
      log('onAccountDeleted hook failed', err);
    }
    res.status(204).end();
  });

  app.get('/v1/photos/:file', async (req, res) => {
    const m = /^(.+)\.jpg$/.exec(req.params.file);
    if (!m || !UUID_RE.test(m[1])) return fail(res, 404, 'not_found');
    const meta = await store.getPhotoMeta(m[1]);
    if (!meta || meta.status !== 'approved') return fail(res, 404, 'not_found');
    const photo = await store.getPhoto(m[1]);
    if (!photo || photo.status !== 'approved') return fail(res, 404, 'not_found');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.end(photo.jpeg);
  });

  // ------------------------------------------------------------ admin
  app.get('/admin', async (req, res) => {
    const q = typeof req.query.status === 'string' ? req.query.status : 'review';
    const status = (ADMIN_STATUSES as readonly string[]).includes(q) ? (q as PhotoStatus) : 'review';
    const authed = isAdmin(req);
    const nonce = randomBytes(16).toString('base64');
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src blob:; connect-src 'self'; ` +
        "form-action 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Vary', 'Authorization');
    res.status(authed ? 200 : 401).type('html').send(renderAdminPage({ nonce, status, items: authed ? await store.listPhotos(status) : null }));
  });

  app.get('/admin/v1/photos', requireAdmin, async (req, res) => {
    const q = typeof req.query.status === 'string' ? req.query.status : 'review';
    if (!(ADMIN_STATUSES as readonly string[]).includes(q)) return fail(res, 400, 'bad_request');
    res.json(await store.listPhotos(q as PhotoStatus));
  });

  app.get('/admin/v1/photos/:accountId/image', requireAdmin, async (req, res) => {
    const id = req.params.accountId as string;
    if (!UUID_RE.test(id)) return fail(res, 404, 'not_found');
    const photo = await store.getPhoto(id);
    if (!photo) return fail(res, 404, 'not_found');
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.end(photo.jpeg);
  });

  app.post('/admin/v1/photos/:accountId/decision', requireAdmin, json, async (req, res) => {
    const id = req.params.accountId as string;
    const b = req.body as { decision?: unknown; reason?: unknown } | undefined;
    if (!b || (b.decision !== 'approve' && b.decision !== 'reject')) return fail(res, 400, 'bad_request');
    if (b.reason !== undefined && !isReasonCode(b.reason)) return fail(res, 400, 'bad_request');
    const meta = UUID_RE.test(id) ? await store.getPhotoMeta(id) : null;
    if (!meta) return fail(res, 404, 'not_found');
    if (b.decision === 'approve') {
      await store.setPhotoStatus(id, 'approved', [], meta.version);
      await store.unblockHash(meta.sha256);
      return void res.json({ accountId: id, status: 'approved', reasons: [] });
    }
    const reasons: ReasonCode[] = [isReasonCode(b.reason) ? b.reason : 'other'];
    await store.setPhotoStatus(id, 'rejected', reasons, meta.version);
    await store.blockHash(meta.sha256, reasons, now());
    res.json({ accountId: id, status: 'rejected', reasons });
  });

  // ------------------------------------------------------------ fallbacks
  app.use((_req, res) => fail(res, 404, 'not_found'));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { type?: string; status?: number };
    if (e?.type === 'entity.too.large') return fail(res, 413, 'too_large');
    if (e?.type === 'entity.parse.failed' || e?.status === 400) return fail(res, 400, 'bad_request');
    log('unhandled error', err);
    fail(res, 500, 'internal');
  });

  return app;
}
