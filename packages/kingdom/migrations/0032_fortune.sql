CREATE TABLE fortune_hourly_snapshots (
  product_scope text NOT NULL,
  season_key text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  game_time_ms bigint NOT NULL CHECK (game_time_ms >= 0 AND game_time_ms % 3600000 = 0),
  tick_sequence bigint NOT NULL CHECK (tick_sequence >= 0),
  wealth_quarter_units bigint NOT NULL,
  baseline_quarter_units bigint NOT NULL,
  fortune_quarter_units bigint NOT NULL,
  hall_band text NOT NULL CHECK (hall_band IN ('I-II', 'III-IV', 'V-VI')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (product_scope, season_key, kingdom_id, game_time_ms),
  CHECK (fortune_quarter_units = wealth_quarter_units - baseline_quarter_units)
);

CREATE INDEX fortune_hourly_rank_idx ON fortune_hourly_snapshots
  (product_scope, season_key, game_time_ms, fortune_quarter_units DESC, kingdom_id);
