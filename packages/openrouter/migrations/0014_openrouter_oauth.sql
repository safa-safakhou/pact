CREATE TABLE openrouter_oauth_flows (
  flow_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  state_hash text NOT NULL UNIQUE,
  code_verifier text NOT NULL,
  code_challenge text NOT NULL,
  callback_url text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX openrouter_oauth_flows_account_idx
  ON openrouter_oauth_flows(product_scope, account_id, created_at DESC);
