ALTER TABLE model_connections
  DROP CONSTRAINT IF EXISTS model_connections_product_scope_account_id_provider_key;

ALTER TABLE model_connections
  ADD COLUMN label text,
  ADD COLUMN suffix text,
  ADD COLUMN credential_ciphertext bytea,
  ADD COLUMN credential_nonce bytea,
  ADD COLUMN credential_auth_tag bytea,
  ADD COLUMN wrapped_data_key text,
  ADD COLUMN wrapping_algorithm text,
  ADD COLUMN wrapping_key_id text,
  ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

UPDATE model_connections
SET label = provider,
    suffix = 'unknown',
    revoked_at = COALESCE(revoked_at, now()),
    updated_at = now();

ALTER TABLE model_connections
  ALTER COLUMN label SET NOT NULL,
  ALTER COLUMN suffix SET NOT NULL,
  DROP COLUMN credential_ref,
  ADD CONSTRAINT model_connections_label_length CHECK (char_length(label) BETWEEN 1 AND 80),
  ADD CONSTRAINT model_connections_suffix_length CHECK (char_length(suffix) BETWEEN 1 AND 16),
  ADD CONSTRAINT model_connections_ciphertext_state CHECK (
    (revoked_at IS NULL
      AND credential_ciphertext IS NOT NULL
      AND credential_nonce IS NOT NULL
      AND octet_length(credential_nonce) = 12
      AND credential_auth_tag IS NOT NULL
      AND octet_length(credential_auth_tag) = 16
      AND wrapped_data_key IS NOT NULL
      AND wrapping_algorithm IS NOT NULL
      AND wrapping_key_id IS NOT NULL)
    OR
    (revoked_at IS NOT NULL
      AND credential_ciphertext IS NULL
      AND credential_nonce IS NULL
      AND credential_auth_tag IS NULL
      AND wrapped_data_key IS NULL
      AND wrapping_algorithm IS NULL
      AND wrapping_key_id IS NULL)
  );

CREATE UNIQUE INDEX model_connections_active_provider_idx
  ON model_connections(product_scope, account_id, provider)
  WHERE revoked_at IS NULL;

CREATE INDEX model_connections_account_status_idx
  ON model_connections(product_scope, account_id, revoked_at, created_at);

CREATE TABLE model_credential_audit_events (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  credential_id uuid NOT NULL REFERENCES model_connections(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('saved', 'replaced', 'revoked')),
  credential_version integer NOT NULL CHECK (credential_version > 0),
  occurred_at timestamptz NOT NULL
);

CREATE INDEX model_credential_audit_account_idx
  ON model_credential_audit_events(product_scope, account_id, occurred_at DESC);

CREATE TABLE model_credential_uses (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  credential_id uuid NOT NULL REFERENCES model_connections(id) ON DELETE CASCADE,
  credential_version integer NOT NULL CHECK (credential_version > 0),
  status text NOT NULL CHECK (status IN ('admitted', 'completed', 'failed')),
  admitted_at timestamptz NOT NULL,
  completed_at timestamptz,
  CHECK ((status = 'admitted' AND completed_at IS NULL) OR (status <> 'admitted' AND completed_at IS NOT NULL))
);

CREATE INDEX model_credential_uses_account_idx
  ON model_credential_uses(product_scope, account_id, admitted_at DESC);
