CREATE TABLE IF NOT EXISTS shared_drafts (
  basho_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  document TEXT NOT NULL CHECK (json_valid(document)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
