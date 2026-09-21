CREATE TABLE write_leases (
  product_scope text NOT NULL,
  subject_id uuid NOT NULL,
  lease_id uuid NOT NULL DEFAULT gen_random_uuid(),
  holder_kind text NOT NULL CHECK (holder_kind IN ('pact_run', 'mcp', 'script')),
  holder_id text NOT NULL,
  run_id uuid,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  PRIMARY KEY (product_scope, subject_id)
);

CREATE TABLE envoy_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'waiting', 'finished', 'stopped', 'failed')),
  objective text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  credential_id uuid,
  client_kind text NOT NULL CHECK (client_kind IN ('pact', 'mcp')),
  deadline_at timestamptz NOT NULL,
  max_conversations integer NOT NULL CHECK (max_conversations > 0 AND max_conversations <= 12),
  max_messages integer NOT NULL CHECK (max_messages > 0 AND max_messages <= 24),
  max_calls integer NOT NULL CHECK (max_calls > 0),
  max_tokens integer NOT NULL CHECK (max_tokens > 0),
  used_conversations integer NOT NULL DEFAULT 0 CHECK (used_conversations >= 0),
  used_messages integer NOT NULL DEFAULT 0 CHECK (used_messages >= 0),
  used_calls integer NOT NULL DEFAULT 0 CHECK (used_calls >= 0),
  used_tokens integer NOT NULL DEFAULT 0 CHECK (used_tokens >= 0),
  reserved_tokens integer NOT NULL DEFAULT 0 CHECK (reserved_tokens >= 0),
  in_flight_request_id text,
  model_calls integer NOT NULL DEFAULT 0 CHECK (model_calls >= 0),
  last_error_code text,
  ambiguous_crash boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz
);

CREATE INDEX envoy_runs_account_idx ON envoy_runs(product_scope, account_id, created_at DESC);
CREATE INDEX envoy_runs_active_idx ON envoy_runs(product_scope, subject_id)
  WHERE status IN ('running', 'waiting');
