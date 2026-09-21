CREATE TABLE telegram_link_bootstraps (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  telegram_user_id bigint NOT NULL,
  init_fingerprint text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  used_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (confirmed_at IS NULL OR account_id IS NOT NULL)
);

CREATE UNIQUE INDEX telegram_link_bootstraps_live_init_idx
  ON telegram_link_bootstraps(product_scope, init_fingerprint)
  WHERE used_at IS NULL;

CREATE TABLE telegram_account_links (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  telegram_user_id bigint NOT NULL,
  display_username text,
  linked_at timestamptz NOT NULL,
  revoked_at timestamptz,
  UNIQUE(product_scope, account_id),
  UNIQUE(product_scope, telegram_user_id)
);

CREATE TABLE telegram_channel_sessions (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  link_id uuid NOT NULL REFERENCES telegram_account_links(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  human_session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX telegram_channel_sessions_active_idx
  ON telegram_channel_sessions(product_scope, account_id, revoked_at, expires_at);

CREATE TABLE telegram_webhook_updates (
  product_scope text NOT NULL,
  bot_id text NOT NULL,
  update_id bigint NOT NULL,
  received_at timestamptz NOT NULL,
  PRIMARY KEY(product_scope, bot_id, update_id)
);
