CREATE TABLE raid_seed_commitments (
  raid_id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  rules_version text NOT NULL,
  commitment char(64) NOT NULL,
  seed_ciphertext bytea NOT NULL,
  seed_nonce bytea NOT NULL,
  seed_auth_tag bytea NOT NULL,
  status text NOT NULL DEFAULT 'committed' CHECK (status IN ('committed', 'resolved', 'canceled')),
  revealed_seed text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revealed_at timestamptz,
  CHECK ((status = 'committed' AND revealed_seed IS NULL AND revealed_at IS NULL)
    OR (status <> 'committed' AND revealed_seed IS NOT NULL AND revealed_at IS NOT NULL))
);

CREATE INDEX raid_seed_commitments_scope_idx ON raid_seed_commitments(product_scope, created_at);

CREATE TABLE raid_seed_access_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_scope text NOT NULL,
  raid_id uuid NOT NULL REFERENCES raid_seed_commitments(raid_id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('resolve', 'cancel')),
  actor_ref text NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX raid_seed_access_audit_raid_idx ON raid_seed_access_audit(product_scope, raid_id, accessed_at);
