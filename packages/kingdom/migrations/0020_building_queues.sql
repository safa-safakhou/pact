CREATE TABLE building_instructions (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  builder_slot integer NOT NULL CHECK (builder_slot BETWEEN 1 AND 2),
  building_kind text NOT NULL CHECK (building_kind IN ('hall', 'farm', 'mine', 'market', 'storehouse', 'barracks', 'wall')),
  target_level integer NOT NULL CHECK (target_level BETWEEN 2 AND 6),
  actor_kind text NOT NULL CHECK (actor_kind IN ('human', 'agent')),
  authority_ref text NOT NULL,
  mandate_version integer,
  state text NOT NULL CHECK (state IN ('waiting', 'active', 'completed', 'canceled')),
  queued_game_time_ms bigint NOT NULL CHECK (queued_game_time_ms >= 0),
  started_game_time_ms bigint CHECK (started_game_time_ms >= 0),
  due_game_time_ms bigint CHECK (due_game_time_ms >= 0),
  settled_game_time_ms bigint CHECK (settled_game_time_ms >= 0),
  iron_cost_id uuid REFERENCES resource_cost_provenance(id),
  silver_cost_id uuid REFERENCES resource_cost_provenance(id),
  CHECK ((state = 'active' AND started_game_time_ms IS NOT NULL AND due_game_time_ms IS NOT NULL
    AND iron_cost_id IS NOT NULL AND silver_cost_id IS NOT NULL)
    OR state <> 'active'),
  CHECK (state <> 'completed' OR settled_game_time_ms IS NOT NULL),
  CHECK (state <> 'canceled' OR settled_game_time_ms IS NOT NULL)
);

CREATE UNIQUE INDEX building_active_slot_unique ON building_instructions(product_scope, kingdom_id, builder_slot)
  WHERE state = 'active';
CREATE UNIQUE INDEX building_waiting_slot_unique ON building_instructions(product_scope, kingdom_id, builder_slot)
  WHERE state = 'waiting';
CREATE UNIQUE INDEX building_live_kind_unique ON building_instructions(product_scope, kingdom_id, building_kind)
  WHERE state IN ('waiting', 'active');
CREATE INDEX building_due_idx ON building_instructions(product_scope, due_game_time_ms)
  WHERE state = 'active';
