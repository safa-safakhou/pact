CREATE TABLE season_clock (
  product_scope text PRIMARY KEY,
  opening_game_time_ms bigint NOT NULL CHECK (opening_game_time_ms >= 0 AND opening_game_time_ms % 60000 = 0),
  current_number integer NOT NULL DEFAULT 1 CHECK (current_number > 0),
  rules_id text NOT NULL,
  last_processed_game_time_ms bigint NOT NULL
);
CREATE TABLE season_entries (
  product_scope text NOT NULL,
  season_number integer NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  baseline_quarter_units bigint NOT NULL,
  highest_hall integer NOT NULL CHECK (highest_hall BETWEEN 1 AND 6),
  closing_wealth_quarter_units bigint,
  closing_fortune_quarter_units bigint,
  closed_game_time_ms bigint,
  first_final_sample_game_time_ms bigint,
  closed_at timestamptz,
  PRIMARY KEY(product_scope, season_number, kingdom_id)
);
CREATE TABLE newcomer_snapshots (
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  cohort_start_game_time_ms bigint NOT NULL,
  due_game_time_ms bigint NOT NULL,
  activation_baseline_quarter_units bigint NOT NULL,
  fortune_quarter_units bigint,
  captured_game_time_ms bigint,
  captured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(product_scope, kingdom_id)
);
CREATE INDEX newcomer_due_idx ON newcomer_snapshots(product_scope, due_game_time_ms) WHERE captured_game_time_ms IS NULL;
