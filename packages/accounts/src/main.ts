/**
 * Stand-alone accounts server.
 * Env: PORT (default 3100), ACCOUNTS_DB (SQLite file, default ./accounts.db; ':memory:' for a throwaway run),
 * ADMIN_TOKEN (>= 16 chars, else admin is disabled), OPENAI_API_KEY, ANTHROPIC_API_KEY (missing -> that layer sends
 * every photo to human review), TRUST_PROXY (optional, e.g. "1" behind one reverse proxy).
 * Sign-in: APPLE_AUDIENCES, GOOGLE_AUDIENCES (comma separated; missing -> that provider answers 503 not_configured).
 * Apple revocation: APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY_PATH (.p8) and ACCOUNTS_SECRET (>= 32 chars, seals the
 * stored refresh tokens with AES-256-GCM; changing it makes stored tokens unusable).
 */
import { readFileSync } from 'node:fs';
import { createAccountsApp } from './app';
import type { AppleRevokeConfig } from './apple';
import { parseList } from './auth';
import { claudeVision, openaiModeration } from './moderation';
import { SqliteStore } from './sqliteStore';

const env = process.env;
const port = Number(env.PORT ?? 3100);
const store = new SqliteStore(env.ACCOUNTS_DB ?? './accounts.db');

if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 16) console.warn('[accounts] ADMIN_TOKEN missing or short: admin endpoints disabled');
if (!env.OPENAI_API_KEY) console.warn('[accounts] OPENAI_API_KEY missing: layer 1 will send photos to review');
if (!env.ANTHROPIC_API_KEY) console.warn('[accounts] ANTHROPIC_API_KEY missing: layer 2 will send photos to review');

const appleAudiences = parseList(env.APPLE_AUDIENCES);
const googleAudiences = parseList(env.GOOGLE_AUDIENCES);
if (!appleAudiences.length) console.warn('[accounts] APPLE_AUDIENCES missing: Apple sign-in disabled (503)');
if (!googleAudiences.length) console.warn('[accounts] GOOGLE_AUDIENCES missing: Google sign-in disabled (503)');
let appleRevoke: AppleRevokeConfig | undefined;
if (env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY_PATH) {
  try {
    appleRevoke = { teamId: env.APPLE_TEAM_ID, keyId: env.APPLE_KEY_ID, privateKey: readFileSync(env.APPLE_PRIVATE_KEY_PATH, 'utf8') };
  } catch {
    console.warn('[accounts] APPLE_PRIVATE_KEY_PATH unreadable: Apple token revocation disabled');
  }
} else {
  console.warn('[accounts] APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY_PATH missing: Apple token revocation disabled');
}
if (!env.TABLE_PASS_SECRET || env.TABLE_PASS_SECRET.length < 32) console.warn('[accounts] TABLE_PASS_SECRET missing or short: GET /v1/me/table-pass answers 503');
if (!env.ACCOUNTS_SECRET) console.warn('[accounts] ACCOUNTS_SECRET missing: Apple refresh tokens will not be stored');

const trust = env.TRUST_PROXY;
const app = createAccountsApp({
  store,
  moderation: [openaiModeration({ apiKey: env.OPENAI_API_KEY }), claudeVision({ apiKey: env.ANTHROPIC_API_KEY })],
  adminToken: env.ADMIN_TOKEN,
  tablePassSecret: env.TABLE_PASS_SECRET,
  auth: { appleAudiences, googleAudiences, appleRevoke, secret: env.ACCOUNTS_SECRET },
  trustProxy: trust === undefined ? undefined : /^\d+$/.test(trust) ? Number(trust) : trust === 'true' ? true : trust,
});

const server = app.listen(port, () => console.log(`[accounts] listening on :${port}`));

async function shutdown(): Promise<void> {
  server.close();
  await app.whenIdle();
  store.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
