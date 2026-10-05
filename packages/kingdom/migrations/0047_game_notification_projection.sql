CREATE TABLE game_notification_cursor (product_scope text PRIMARY KEY, sequence bigint NOT NULL DEFAULT 0);
CREATE TABLE game_notification_expiry_notices (
 product_scope text NOT NULL, kind text NOT NULL, contract_id uuid NOT NULL, end_game_time_ms bigint NOT NULL,
 created_at timestamptz NOT NULL, PRIMARY KEY(product_scope,kind,contract_id,end_game_time_ms)
);
