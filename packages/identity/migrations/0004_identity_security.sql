ALTER TABLE accounts
  ADD COLUMN terms_version text,
  ADD COLUMN terms_accepted_at timestamptz,
  ADD COLUMN age_18_declared_at timestamptz,
  ADD COLUMN password_changed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN role text NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'staff')),
  ADD COLUMN totp_secret_ciphertext text;

ALTER TABLE sessions
  ADD COLUMN idle_expires_at timestamptz,
  ADD COLUMN csrf_token_hash text,
  ADD COLUMN authenticated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN label text;

UPDATE sessions SET idle_expires_at = LEAST(expires_at, created_at + interval '7 days') WHERE idle_expires_at IS NULL;
ALTER TABLE sessions ALTER COLUMN idle_expires_at SET NOT NULL;

CREATE INDEX sessions_active_account_idx ON sessions(product_scope, account_id)
  WHERE revoked_at IS NULL;

CREATE TABLE email_verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE email_change_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  new_email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE oauth_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  token_family_id uuid NOT NULL,
  scopes text[] NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX oauth_grants_active_account_idx ON oauth_grants(product_scope, account_id)
  WHERE revoked_at IS NULL;

CREATE TABLE auth_rate_limits (
  product_scope text NOT NULL,
  kind text NOT NULL,
  subject_hash text NOT NULL,
  bucket_start timestamptz NOT NULL,
  count integer NOT NULL CHECK (count > 0),
  PRIMARY KEY(product_scope, kind, subject_hash, bucket_start)
);

CREATE TABLE totp_enrollments (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  product_scope text NOT NULL,
  secret_ciphertext text NOT NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mfa_recovery_codes (
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(account_id, code_hash)
);

CREATE TABLE security_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_scope text NOT NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  type text NOT NULL,
  request_id uuid,
  ip_hash text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX security_events_account_time_idx ON security_events(product_scope, account_id, occurred_at DESC);
CREATE INDEX accounts_unverified_expiry_idx ON accounts(created_at) WHERE email_verified_at IS NULL;
