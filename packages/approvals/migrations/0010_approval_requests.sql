CREATE TABLE approval_requests (
  approval_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  command_id uuid NOT NULL,
  canonical_command_hash text NOT NULL,
  action jsonb NOT NULL,
  effects_summary text NOT NULL,
  mandate_version integer,
  preconditions jsonb NOT NULL DEFAULT '{}'::jsonb,
  requesting_client_id text,
  run_id uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'revoked')),
  receipt jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  resolved_at timestamptz,
  UNIQUE(product_scope, command_id)
);

CREATE INDEX approval_requests_account_idx ON approval_requests(product_scope, account_id, created_at DESC);
