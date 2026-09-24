-- Successful gameplay actions are scoped to the kingdom, never to a client, model, or run.
CREATE TABLE kingdom_action_events (
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'outgoing_message', 'offer_action', 'cold_contact', 'transfer', 'public_post', 'state_read'
  )),
  operation_key text NOT NULL,
  game_time_ms bigint NOT NULL CHECK (game_time_ms >= 0),
  PRIMARY KEY (product_scope, kingdom_id, kind, operation_key)
);

CREATE INDEX kingdom_action_events_window_idx
  ON kingdom_action_events(product_scope, kingdom_id, kind, game_time_ms);

CREATE TABLE kingdom_charge_spends (
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('raid', 'scout')),
  operation_key text NOT NULL,
  game_time_ms bigint NOT NULL CHECK (game_time_ms >= 0),
  available_after integer NOT NULL CHECK (available_after >= 0),
  capacity integer NOT NULL CHECK (capacity > 0),
  next_regeneration_game_time_ms bigint,
  PRIMARY KEY (product_scope, kingdom_id, kind, operation_key)
);
