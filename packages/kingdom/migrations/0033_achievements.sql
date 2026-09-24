CREATE TABLE achievement_processed_events (
  product_scope text NOT NULL,
  event_id uuid NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (product_scope, event_id)
);

CREATE TABLE achievement_battle_losses (
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  raid_id uuid NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
  loss_game_time_ms bigint NOT NULL,
  lost_ordinary_count integer NOT NULL CHECK (lost_ordinary_count > 0),
  PRIMARY KEY (product_scope, account_id, raid_id)
);

CREATE TABLE achievement_upkeep_checks (
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  game_time_ms bigint NOT NULL,
  fully_funded boolean NOT NULL,
  PRIMARY KEY (product_scope, kingdom_id, game_time_ms)
);

CREATE TABLE achievement_awards (
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  source_event_id uuid NOT NULL,
  awarded_game_time_ms bigint NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (product_scope, account_id, achievement_id)
);

CREATE TABLE cosmetic_entitlements (
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  source_achievement_id text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (product_scope, account_id, item_id)
);

CREATE TABLE cosmetic_wallet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source_kind text NOT NULL CHECK (source_kind = 'achievement'),
  source_ref text NOT NULL,
  earned_gems_delta integer NOT NULL CHECK (earned_gems_delta = 25),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (product_scope, account_id, source_kind, source_ref)
);
