CREATE TABLE training_batches (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  troop_type text NOT NULL CHECK (troop_type IN ('spearman', 'archer', 'rider', 'ram')),
  requested_count integer NOT NULL CHECK (requested_count BETWEEN 1 AND 40),
  completed_count integer NOT NULL DEFAULT 0 CHECK (completed_count >= 0),
  unit_minutes integer NOT NULL CHECK (unit_minutes > 0),
  status text NOT NULL CHECK (status IN ('active', 'completed', 'canceled')),
  queued_game_time_ms bigint NOT NULL CHECK (queued_game_time_ms >= 0),
  next_unit_due_game_time_ms bigint NOT NULL CHECK (next_unit_due_game_time_ms >= 0),
  settled_game_time_ms bigint CHECK (settled_game_time_ms >= 0),
  iron_cost_id uuid NOT NULL REFERENCES resource_cost_provenance(id),
  silver_cost_id uuid NOT NULL REFERENCES resource_cost_provenance(id),
  CHECK (completed_count <= requested_count),
  CHECK (status <> 'completed' OR completed_count = requested_count),
  CHECK (status <> 'active' OR completed_count < requested_count),
  CHECK (status = 'active' OR settled_game_time_ms IS NOT NULL)
);

CREATE UNIQUE INDEX training_one_active_queue ON training_batches(product_scope, kingdom_id)
  WHERE status = 'active';
CREATE INDEX training_due_idx ON training_batches(product_scope, next_unit_due_game_time_ms)
  WHERE status = 'active';

CREATE TABLE battle_eligibility_snapshots (
  product_scope text NOT NULL,
  battle_id uuid NOT NULL,
  host_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  raid_id uuid NOT NULL,
  locked_until_game_time_ms bigint NOT NULL CHECK (locked_until_game_time_ms >= 0),
  PRIMARY KEY (product_scope, battle_id)
);

CREATE TABLE battle_unit_eligibility (
  product_scope text NOT NULL,
  battle_id uuid NOT NULL,
  troop_id uuid NOT NULL REFERENCES kingdom_troops(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('attacker', 'defender')),
  host_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  locked_until_game_time_ms bigint NOT NULL CHECK (locked_until_game_time_ms >= 0),
  PRIMARY KEY (product_scope, battle_id, troop_id),
  FOREIGN KEY (product_scope, battle_id) REFERENCES battle_eligibility_snapshots(product_scope, battle_id) ON DELETE CASCADE
);

CREATE INDEX battle_unit_active_locks ON battle_unit_eligibility(product_scope, troop_id, locked_until_game_time_ms);
