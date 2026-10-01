CREATE TABLE season_meaningful_days (
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  season_number integer NOT NULL,
  game_day bigint NOT NULL,
  first_game_time_ms bigint NOT NULL,
  last_game_time_ms bigint NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(product_scope,kingdom_id,season_number,game_day)
);
CREATE TABLE season_activity_events (
  product_scope text NOT NULL,
  event_id uuid NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(product_scope,event_id)
);
CREATE TABLE season_honor_runs (
  product_scope text NOT NULL,
  season_number integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(product_scope,season_number)
);
CREATE TABLE season_honor_results (
  product_scope text NOT NULL,
  season_number integer NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  result jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(product_scope,season_number,kingdom_id)
);
