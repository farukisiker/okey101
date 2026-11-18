/**
 * Stand-alone accounts server.
 * Env: PORT (default 3100), ACCOUNTS_DB (SQLite file, default ./accounts.db; ':memory:' for a throwaway run),
 * ADMIN_TOKEN (>= 16 chars, else admin is disabled), OPENAI_API_KEY, ANTHROPIC_API_KEY (missing -> that layer sends
 * every photo to human review), TRUST_PROXY (optional, e.g. "1" behind one reverse proxy).
 */
import { createAccountsApp } from './app';
import { claudeVision, openaiModeration } from './moderation';
import { SqliteStore } from './sqliteStore';

const env = process.env;
const port = Number(env.PORT ?? 3100);
const store = new SqliteStore(env.ACCOUNTS_DB ?? './accounts.db');

if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 16) console.warn('[accounts] ADMIN_TOKEN missing or short: admin endpoints disabled');
if (!env.OPENAI_API_KEY) console.warn('[accounts] OPENAI_API_KEY missing: layer 1 will send photos to review');
if (!env.ANTHROPIC_API_KEY) console.warn('[accounts] ANTHROPIC_API_KEY missing: layer 2 will send photos to review');

const trust = env.TRUST_PROXY;
const app = createAccountsApp({
  store,
  moderation: [openaiModeration({ apiKey: env.OPENAI_API_KEY }), claudeVision({ apiKey: env.ANTHROPIC_API_KEY })],
  adminToken: env.ADMIN_TOKEN,
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
