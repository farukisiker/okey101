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
