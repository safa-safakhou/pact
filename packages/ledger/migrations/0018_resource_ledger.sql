CREATE TABLE ledger_kingdoms (
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL,
  grant_expires_game_time_ms bigint NOT NULL CHECK (grant_expires_game_time_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_scope, kingdom_id)
);

CREATE TABLE resource_balances (
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL,
  resource text NOT NULL CHECK (resource IN ('iron', 'silver', 'grain')),
  ordinary_units bigint NOT NULL DEFAULT 0 CHECK (ordinary_units >= 0),
  allowance_units bigint NOT NULL DEFAULT 0 CHECK (allowance_units >= 0),
  locked_units bigint NOT NULL DEFAULT 0 CHECK (locked_units >= 0),
  storage_cap_units bigint NOT NULL CHECK (storage_cap_units >= 0),
  allowance_cap_units bigint NOT NULL CHECK (allowance_cap_units >= 0),
  production_per_minute_units bigint NOT NULL CHECK (production_per_minute_units >= 0),
  version bigint NOT NULL DEFAULT 0 CHECK (version >= 0),
  PRIMARY KEY (product_scope, kingdom_id, resource),
  FOREIGN KEY (product_scope, kingdom_id) REFERENCES ledger_kingdoms(product_scope, kingdom_id) ON DELETE CASCADE,
  CHECK (ordinary_units <= storage_cap_units),
  CHECK (allowance_units <= allowance_cap_units)
);

CREATE TABLE resource_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL,
  resource text NOT NULL CHECK (resource IN ('iron', 'silver', 'grain')),
  operation_key text NOT NULL,
  reason text NOT NULL,
  requested_units bigint NOT NULL CHECK (requested_units >= 0),
  ordinary_delta bigint NOT NULL DEFAULT 0,
  allowance_delta bigint NOT NULL DEFAULT 0,
  locked_delta bigint NOT NULL DEFAULT 0,
  overflow_units bigint NOT NULL DEFAULT 0 CHECK (overflow_units >= 0),
  cancellation_loss_units bigint NOT NULL DEFAULT 0 CHECK (cancellation_loss_units >= 0),
  ordinary_after bigint NOT NULL CHECK (ordinary_after >= 0),
  allowance_after bigint NOT NULL CHECK (allowance_after >= 0),
  locked_after bigint NOT NULL CHECK (locked_after >= 0),
  storage_cap_after bigint,
  production_per_minute_after bigint,
  game_time_ms bigint NOT NULL CHECK (game_time_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (product_scope, kingdom_id, resource)
    REFERENCES resource_balances(product_scope, kingdom_id, resource) ON DELETE CASCADE,
  UNIQUE (product_scope, kingdom_id, resource, operation_key)
);

CREATE INDEX resource_movements_history_idx
  ON resource_movements(product_scope, kingdom_id, created_at, id);

CREATE TABLE resource_cost_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL,
  resource text NOT NULL CHECK (resource IN ('iron', 'silver', 'grain')),
  kind text NOT NULL CHECK (kind IN ('construction', 'training')),
  operation_key text NOT NULL,
  ordinary_paid_units bigint NOT NULL CHECK (ordinary_paid_units >= 0),
  allowance_paid_units bigint NOT NULL CHECK (allowance_paid_units >= 0),
  ordinary_remaining_units bigint NOT NULL CHECK (ordinary_remaining_units >= 0),
  status text NOT NULL CHECK (status IN ('active', 'installed', 'completed', 'canceled')),
  created_game_time_ms bigint NOT NULL CHECK (created_game_time_ms >= 0),
  settled_game_time_ms bigint,
  FOREIGN KEY (product_scope, kingdom_id, resource)
    REFERENCES resource_balances(product_scope, kingdom_id, resource) ON DELETE CASCADE,
  UNIQUE (product_scope, kingdom_id, resource, kind, operation_key),
  CHECK (ordinary_remaining_units <= ordinary_paid_units),
  CHECK (kind = 'construction' OR allowance_paid_units = 0)
);

CREATE TABLE resource_training_consumptions (
  cost_id uuid NOT NULL REFERENCES resource_cost_provenance(id) ON DELETE CASCADE,
  operation_key text NOT NULL,
  ordinary_units bigint NOT NULL CHECK (ordinary_units > 0),
  game_time_ms bigint NOT NULL CHECK (game_time_ms >= 0),
  PRIMARY KEY (cost_id, operation_key)
);
