CREATE TABLE scout_operations (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  scout_kingdom_id uuid NOT NULL REFERENCES kingdoms(id),
  target_kingdom_id uuid NOT NULL REFERENCES kingdoms(id),
  operation_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'completed')),
  started_game_time_ms bigint NOT NULL,
  due_game_time_ms bigint NOT NULL,
  completed_game_time_ms bigint,
  completed_at timestamptz,
  authority_ref uuid,
  report jsonb,
  UNIQUE (product_scope, scout_kingdom_id, operation_key),
  CHECK (scout_kingdom_id <> target_kingdom_id),
  CHECK (due_game_time_ms > started_game_time_ms)
);

CREATE INDEX scout_operations_due_idx ON scout_operations(product_scope, due_game_time_ms, id)
  WHERE status = 'active';

CREATE TABLE scout_report_shares (
  product_scope text NOT NULL,
  operation_id uuid NOT NULL REFERENCES scout_operations(id) ON DELETE CASCADE,
  recipient_kingdom_id uuid NOT NULL REFERENCES kingdoms(id),
  shared_game_time_ms bigint NOT NULL,
  PRIMARY KEY (product_scope, operation_id, recipient_kingdom_id)
);
