-- Additive: no existing identities, messages, offers, receipts or read states change.
CREATE TABLE communication_buckets (
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  credits_ms integer NOT NULL CHECK (credits_ms BETWEEN 0 AND 30000),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY(product_scope,kingdom_id)
);
CREATE INDEX direct_messages_pending_bytes ON direct_messages(product_scope,recipient_kingdom_id) WHERE read_game_time_ms IS NULL;
CREATE TABLE social_delegations (
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('manual','allowlist','agent_decides')),
  allowed_kingdom_ids uuid[] NOT NULL DEFAULT '{}',
  version integer NOT NULL DEFAULT 1,
  enrolled_game_time_ms bigint NOT NULL,
  PRIMARY KEY(product_scope,kingdom_id)
);
