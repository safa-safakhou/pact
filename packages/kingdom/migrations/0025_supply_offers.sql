CREATE TABLE supply_offers (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  kingdom_a uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  kingdom_b uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  terms jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'active', 'withdrawn', 'expired')),
  expires_game_time_ms bigint NOT NULL CHECK (expires_game_time_ms >= 0),
  created_game_time_ms bigint NOT NULL CHECK (created_game_time_ms >= 0),
  updated_game_time_ms bigint NOT NULL CHECK (updated_game_time_ms >= 0),
  closed_at timestamptz,
  CHECK (kingdom_a <> kingdom_b)
);

CREATE TABLE supply_offer_signatures (
  product_scope text NOT NULL,
  offer_id uuid NOT NULL REFERENCES supply_offers(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  actor_kind text NOT NULL CHECK (actor_kind IN ('human', 'agent')),
  authority_ref text,
  signed_game_time_ms bigint NOT NULL CHECK (signed_game_time_ms >= 0),
  PRIMARY KEY (product_scope, offer_id, version, kingdom_id),
  CHECK ((actor_kind = 'agent') = (authority_ref IS NOT NULL))
);

CREATE TABLE supply_contracts (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  offer_id uuid NOT NULL UNIQUE REFERENCES supply_offers(id),
  offer_version integer NOT NULL,
  kingdom_a uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  kingdom_b uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  terms jsonb NOT NULL,
  start_game_time_ms bigint NOT NULL,
  end_game_time_ms bigint NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'expired', 'released', 'defaulted')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  closed_at timestamptz,
  CHECK (end_game_time_ms > start_game_time_ms)
);

CREATE INDEX supply_contracts_active_party_idx ON supply_contracts(product_scope, status, kingdom_a, kingdom_b);
