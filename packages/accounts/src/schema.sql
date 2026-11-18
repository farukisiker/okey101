-- @kahve/accounts schema. Portable SQL: plain types, no SQLite-only features.
-- Postgres port: BLOB -> BYTEA, everything else unchanged (BIGINT = epoch milliseconds).
-- Statements are separated by ';' and are idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  created_at BIGINT NOT NULL,
  photo_consent_version INTEGER NOT NULL DEFAULT 0,
  photo_seq INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account ON sessions(account_id);

CREATE TABLE IF NOT EXISTS consents (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  version INTEGER NOT NULL,
  given_at BIGINT NOT NULL,
  PRIMARY KEY (account_id, kind)
);

CREATE TABLE IF NOT EXISTS photos (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  jpeg BLOB NOT NULL,
  sha256 TEXT NOT NULL,
  status TEXT NOT NULL,
  reasons TEXT NOT NULL,
  uploaded_at BIGINT NOT NULL,
  version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS photos_status ON photos(status, uploaded_at);

CREATE TABLE IF NOT EXISTS upload_counts (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (account_id, day)
);

CREATE TABLE IF NOT EXISTS blocked_hashes (
  sha256 TEXT PRIMARY KEY,
  reasons TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

-- E1b: Apple / Google identities. Added with IF NOT EXISTS so an existing E1a database picks it up on start.
-- apple_refresh_enc: Apple refresh token sealed with AES-256-GCM (never plaintext), used to revoke on deletion.
CREATE TABLE IF NOT EXISTS account_providers (
  provider TEXT NOT NULL,
  sub TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  apple_refresh_enc TEXT,
  PRIMARY KEY (provider, sub),
  UNIQUE (account_id, provider)
);

-- E2: reports, voice bans, block lists. Added with IF NOT EXISTS so an E1 database picks them up on start.
-- A report is deleted with either account (writer or target). app.ts checks the target exists before inserting.
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  context TEXT,
  created_at BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
);
CREATE INDEX IF NOT EXISTS reports_target ON reports(target_id, created_at);
CREATE INDEX IF NOT EXISTS reports_reporter ON reports(reporter_id, created_at);
CREATE INDEX IF NOT EXISTS reports_status ON reports(status, created_at);

CREATE TABLE IF NOT EXISTS voice_bans (
  account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  until_at BIGINT NOT NULL
);

-- blocked_id has no foreign key: blocking needs only a well-formed id (the target may be deleted meanwhile).
CREATE TABLE IF NOT EXISTS blocks (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (account_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS blocks_blocked ON blocks(blocked_id);
