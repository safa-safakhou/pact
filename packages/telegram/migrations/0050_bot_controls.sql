CREATE TABLE telegram_run_preferences (
 product_scope text NOT NULL,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 settings jsonb NOT NULL,updated_at timestamptz NOT NULL,PRIMARY KEY(product_scope,account_id)
);
CREATE TABLE telegram_run_previews (
 id uuid PRIMARY KEY,product_scope text NOT NULL,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 link_id uuid NOT NULL REFERENCES telegram_account_links(id) ON DELETE CASCADE,telegram_user_id text NOT NULL,
 nonce_hash text NOT NULL UNIQUE,sealed_objective text NOT NULL,settings jsonb NOT NULL,
 created_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,used_at timestamptz,run_id uuid,message_id bigint
);
CREATE TABLE telegram_bot_replies (
 id uuid PRIMARY KEY,product_scope text NOT NULL,account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
 telegram_user_id text NOT NULL,sealed_reply text NOT NULL,preview_id uuid REFERENCES telegram_run_previews(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'ready' CHECK(status IN('ready','delivered','cancelled')),created_at timestamptz NOT NULL,
 available_at timestamptz NOT NULL,attempts integer NOT NULL DEFAULT 0,leased_by text,lease_expires_at timestamptz
);
CREATE INDEX telegram_bot_reply_ready ON telegram_bot_replies(product_scope,available_at) WHERE status='ready';

CREATE TABLE telegram_started_runs(product_scope text NOT NULL,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,run_id uuid PRIMARY KEY,created_at timestamptz NOT NULL);
