CREATE TABLE authority_commitments (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  operation_key text NOT NULL,
  action text NOT NULL,
  actor_kind text NOT NULL CHECK (actor_kind IN ('agent', 'human_exception')),
  subject_ref text,
  permit_ref text,
  mandate_version integer,
  troop_count integer NOT NULL DEFAULT 0 CHECK (troop_count >= 0),
  status text NOT NULL CHECK (status IN ('reserved', 'active', 'closed')),
  created_game_time_ms bigint NOT NULL CHECK (created_game_time_ms >= 0),
  closed_game_time_ms bigint,
  closed_at timestamptz,
  UNIQUE(product_scope, account_id, operation_key),
  CHECK (actor_kind = 'agent' OR permit_ref IS NOT NULL)
);

CREATE TABLE authority_commitment_assets (
  product_scope text NOT NULL,
  commitment_id uuid NOT NULL REFERENCES authority_commitments(id) ON DELETE CASCADE,
  asset text NOT NULL,
  original_units bigint NOT NULL CHECK (original_units > 0),
  remaining_units bigint NOT NULL CHECK (remaining_units >= 0),
  spent_units bigint NOT NULL DEFAULT 0 CHECK (spent_units >= 0),
  PRIMARY KEY(product_scope, commitment_id, asset),
  CHECK (remaining_units + spent_units <= original_units)
);

CREATE TABLE authority_spends (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  asset text NOT NULL,
  units bigint NOT NULL CHECK (units > 0),
  game_time_ms bigint NOT NULL CHECK (game_time_ms >= 0),
  operation_key text NOT NULL,
  commitment_id uuid REFERENCES authority_commitments(id) ON DELETE SET NULL,
  count_against_limit boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(product_scope, account_id, operation_key, asset)
);
CREATE INDEX authority_spends_window_idx ON authority_spends(product_scope, account_id, asset, game_time_ms)
  WHERE count_against_limit;

ALTER TABLE supply_offer_signatures DROP CONSTRAINT supply_offer_signatures_check;
ALTER TABLE supply_offer_signatures ADD CONSTRAINT supply_signature_authority_check
  CHECK (actor_kind <> 'agent' OR authority_ref IS NOT NULL);

CREATE TABLE authority_human_permits (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  action text NOT NULL,
  operation_key text NOT NULL,
  assets jsonb NOT NULL,
  troop_count integer NOT NULL DEFAULT 0 CHECK (troop_count >= 0),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(product_scope, account_id, action, operation_key)
);
