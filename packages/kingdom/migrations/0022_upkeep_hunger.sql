CREATE TABLE kingdom_upkeep_state (
  product_scope text NOT NULL,
  payer_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  hungry boolean NOT NULL DEFAULT false,
  underfunded_minutes integer NOT NULL DEFAULT 0 CHECK (underfunded_minutes >= 0),
  funded_recovery_minutes integer NOT NULL DEFAULT 0 CHECK (funded_recovery_minutes >= 0),
  last_game_time_ms bigint NOT NULL DEFAULT 0 CHECK (last_game_time_ms >= 0),
  PRIMARY KEY (product_scope, payer_kingdom_id)
);

-- The garrison ticket consumes this durable, once-per-detachment default hook.
CREATE TABLE garrison_upkeep_defaults (
  product_scope text NOT NULL,
  detachment_ref uuid NOT NULL,
  host_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  owner_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  first_underfunded_game_time_ms bigint NOT NULL CHECK (first_underfunded_game_time_ms >= 0),
  PRIMARY KEY (product_scope, detachment_ref)
);
