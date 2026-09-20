CREATE TABLE mcp_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  protocol_version text NOT NULL,
  client_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX mcp_sessions_account_idx ON mcp_sessions(product_scope, account_id)
  WHERE closed_at IS NULL;
