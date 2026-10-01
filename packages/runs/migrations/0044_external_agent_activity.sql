CREATE TABLE external_agent_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  dedup_id uuid,
  summary text NOT NULL CHECK (octet_length(summary) <= 3600),
  created_at timestamptz NOT NULL,
  UNIQUE (product_scope, dedup_id)
);
CREATE INDEX external_agent_activity_owner ON external_agent_activity(product_scope, account_id, id DESC);
