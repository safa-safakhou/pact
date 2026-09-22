CREATE TABLE privacy_exports (
  export_id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  archive jsonb NOT NULL,
  readable_index text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  downloaded_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX privacy_exports_account_idx
  ON privacy_exports(product_scope, account_id, created_at DESC);

-- Deliberately has no account FK: this tombstone must survive account deletion and backup restore.
CREATE TABLE privacy_deletion_registry (
  deletion_id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  account_id uuid NOT NULL,
  requested_at timestamptz NOT NULL,
  live_purge_due_at timestamptz NOT NULL,
  backup_suppress_until timestamptz NOT NULL,
  last_replayed_at timestamptz,
  completed_at timestamptz,
  UNIQUE(product_scope, account_id),
  CHECK (live_purge_due_at >= requested_at),
  CHECK (backup_suppress_until >= live_purge_due_at)
);

CREATE INDEX privacy_deletion_replay_idx
  ON privacy_deletion_registry(product_scope, backup_suppress_until);

-- Legal holds extend only the named data scope and always carry a review date.
CREATE TABLE privacy_legal_holds (
  hold_id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  account_id uuid NOT NULL,
  data_scope text NOT NULL,
  legal_basis text NOT NULL,
  placed_at timestamptz NOT NULL,
  review_at timestamptz NOT NULL,
  released_at timestamptz,
  CHECK (review_at > placed_at)
);

CREATE INDEX privacy_legal_holds_active_idx
  ON privacy_legal_holds(product_scope, account_id) WHERE released_at IS NULL;
