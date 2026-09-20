CREATE TABLE oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  client_id text NOT NULL,
  client_type text NOT NULL CHECK (client_type IN ('preregistered', 'metadata', 'dynamic')),
  audience text NOT NULL CHECK (audience IN ('human', 'mcp')),
  display_name text NOT NULL,
  redirect_uris text[] NOT NULL,
  metadata_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(product_scope, client_id)
);

CREATE TABLE oauth_authorization_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  code_hash text NOT NULL UNIQUE,
  client_id text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  scopes text[] NOT NULL,
  code_challenge text NOT NULL,
  code_challenge_method text NOT NULL CHECK (code_challenge_method = 'S256'),
  resource text NOT NULL,
  subject_label text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE oauth_refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  grant_id uuid NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE,
  token_family_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  parent_token_hash text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX oauth_refresh_family_idx ON oauth_refresh_tokens(product_scope, token_family_id);

ALTER TABLE oauth_grants
  ADD COLUMN IF NOT EXISTS audience text CHECK (audience IN ('human', 'mcp')),
  ADD COLUMN IF NOT EXISTS resource text,
  ADD COLUMN IF NOT EXISTS subject_label text,
  ADD COLUMN IF NOT EXISTS access_token_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS oauth_grants_access_token_hash_uidx
  ON oauth_grants(access_token_hash) WHERE access_token_hash IS NOT NULL;
