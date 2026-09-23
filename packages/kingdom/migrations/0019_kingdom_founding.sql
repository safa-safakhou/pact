CREATE TABLE kingdoms (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  draft_id uuid UNIQUE REFERENCES kingdom_drafts(id) ON DELETE SET NULL,
  handle text NOT NULL CHECK (handle = lower(handle) AND handle ~ '^[a-z][a-z0-9_]{2,23}$'),
  display_name text NOT NULL,
  portrait text NOT NULL,
  activated_at timestamptz NOT NULL,
  activated_game_time_ms bigint NOT NULL CHECK (activated_game_time_ms >= 0),
  activated_tick_sequence bigint NOT NULL CHECK (activated_tick_sequence >= 0),
  first_tick_game_time_ms bigint NOT NULL CHECK (first_tick_game_time_ms > activated_game_time_ms),
  activation_event_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ranked' CHECK (status IN ('ranked', 'closed')),
  CONSTRAINT kingdoms_account_unique UNIQUE(product_scope, account_id),
  CONSTRAINT kingdoms_handle_unique UNIQUE(product_scope, handle)
);

CREATE TABLE kingdom_buildings (
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('hall', 'farm', 'mine', 'market', 'storehouse', 'barracks', 'wall')),
  level integer NOT NULL CHECK (level BETWEEN 1 AND 6),
  PRIMARY KEY (product_scope, kingdom_id, kind)
);

CREATE TABLE kingdom_builder_slots (
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  slot integer NOT NULL CHECK (slot BETWEEN 1 AND 2),
  PRIMARY KEY (product_scope, kingdom_id, slot)
);

CREATE TABLE kingdom_training_queue (
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  slot integer NOT NULL DEFAULT 1 CHECK (slot = 1),
  PRIMARY KEY (product_scope, kingdom_id, slot)
);

CREATE TABLE kingdom_troops (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  owner_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  host_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('spearman', 'archer', 'rider', 'ram')),
  home_guard boolean NOT NULL DEFAULT false,
  placement text NOT NULL CHECK (placement IN ('home', 'visiting', 'scouting', 'attacking')),
  placement_ref uuid,
  created_game_time_ms bigint NOT NULL CHECK (created_game_time_ms >= 0),
  created_at timestamptz NOT NULL,
  CHECK ((placement = 'home' AND placement_ref IS NULL AND owner_kingdom_id = host_kingdom_id)
      OR (placement <> 'home' AND placement_ref IS NOT NULL)),
  CHECK (NOT home_guard OR (type = 'spearman' AND placement = 'home'))
);

CREATE INDEX kingdom_troops_owner_idx ON kingdom_troops(product_scope, owner_kingdom_id, id);
CREATE INDEX kingdom_troops_host_idx ON kingdom_troops(product_scope, host_kingdom_id, id);

CREATE TABLE kingdom_charges (
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('raid', 'scout')),
  available integer NOT NULL CHECK (available >= 0),
  capacity integer NOT NULL CHECK (capacity > 0),
  last_regenerated_game_time_ms bigint NOT NULL CHECK (last_regenerated_game_time_ms >= 0),
  PRIMARY KEY (product_scope, kingdom_id, kind),
  CHECK (available <= capacity)
);

CREATE TABLE kingdom_score_baselines (
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  game_time_ms bigint NOT NULL CHECK (game_time_ms >= 0),
  marked_value_numerator bigint NOT NULL DEFAULT 0,
  marked_value_denominator bigint NOT NULL DEFAULT 1 CHECK (marked_value_denominator > 0),
  PRIMARY KEY (product_scope, kingdom_id)
);

-- Ledger fixtures can exist independently, but ranked kingdom erasure must clean their state.
CREATE FUNCTION delete_kingdom_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM ledger_kingdoms WHERE product_scope = OLD.product_scope AND kingdom_id = OLD.id;
  RETURN OLD;
END $$;

CREATE TRIGGER kingdoms_delete_ledger BEFORE DELETE ON kingdoms
  FOR EACH ROW EXECUTE FUNCTION delete_kingdom_ledger();
