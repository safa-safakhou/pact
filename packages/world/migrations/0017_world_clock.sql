CREATE TABLE world_clocks (
  product_scope text PRIMARY KEY,
  rules_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'paused')),
  committed_game_time_ms bigint NOT NULL CHECK (committed_game_time_ms >= 0 AND committed_game_time_ms % 60000 = 0),
  tick_sequence bigint NOT NULL DEFAULT 0 CHECK (tick_sequence >= 0),
  next_tick_due_at timestamptz NOT NULL,
  last_heartbeat_at timestamptz NOT NULL,
  lease_holder text,
  lease_token uuid,
  lease_expires_at timestamptz,
  paused_at timestamptz,
  suspension_reason text,
  CHECK ((lease_holder IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL)
      OR (lease_holder IS NOT NULL AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK (status = 'active' OR lease_holder IS NULL)
);

CREATE TABLE world_ticks (
  product_scope text NOT NULL REFERENCES world_clocks(product_scope),
  tick_sequence bigint NOT NULL CHECK (tick_sequence > 0),
  game_time_ms bigint NOT NULL CHECK (game_time_ms % 60000 = 0),
  due_at timestamptz NOT NULL,
  committed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  rules_id text NOT NULL,
  PRIMARY KEY (product_scope, tick_sequence),
  UNIQUE (product_scope, game_time_ms)
);
