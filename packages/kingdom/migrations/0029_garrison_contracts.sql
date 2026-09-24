CREATE TABLE garrison_offers (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  lender_kingdom_id uuid NOT NULL REFERENCES kingdoms(id),
  host_kingdom_id uuid NOT NULL REFERENCES kingdoms(id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  terms jsonb NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'active', 'withdrawn', 'expired')),
  expires_game_time_ms bigint NOT NULL CHECK (expires_game_time_ms >= 0),
  created_game_time_ms bigint NOT NULL CHECK (created_game_time_ms >= 0),
  closed_at timestamptz,
  CHECK (lender_kingdom_id <> host_kingdom_id)
);

CREATE TABLE garrison_offer_signatures (
  product_scope text NOT NULL,
  offer_id uuid NOT NULL REFERENCES garrison_offers(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id),
  actor_kind text NOT NULL CHECK (actor_kind IN ('human', 'agent')),
  authority_ref uuid,
  signed_game_time_ms bigint NOT NULL,
  PRIMARY KEY (product_scope, offer_id, version, kingdom_id),
  CHECK (actor_kind <> 'agent' OR authority_ref IS NOT NULL)
);

CREATE TABLE garrison_contracts (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  offer_id uuid NOT NULL UNIQUE REFERENCES garrison_offers(id),
  lender_kingdom_id uuid NOT NULL REFERENCES kingdoms(id),
  host_kingdom_id uuid NOT NULL REFERENCES kingdoms(id),
  terms jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'exit_pending', 'closed')),
  start_game_time_ms bigint NOT NULL,
  end_game_time_ms bigint NOT NULL,
  exit_requested_game_time_ms bigint,
  close_reason text,
  closed_game_time_ms bigint,
  closed_at timestamptz,
  lender_default boolean NOT NULL DEFAULT false,
  host_default boolean NOT NULL DEFAULT false,
  lender_bond_units bigint NOT NULL DEFAULT 0 CHECK (lender_bond_units >= 0),
  host_bond_units bigint NOT NULL DEFAULT 0 CHECK (host_bond_units >= 0),
  lender_authority_ref uuid,
  host_authority_ref uuid,
  CHECK (lender_kingdom_id <> host_kingdom_id),
  CHECK (end_game_time_ms > start_game_time_ms)
);

CREATE INDEX garrison_contracts_active_lender_idx ON garrison_contracts(product_scope, lender_kingdom_id)
  WHERE status <> 'closed';
CREATE INDEX garrison_contracts_active_host_idx ON garrison_contracts(product_scope, host_kingdom_id)
  WHERE status <> 'closed';

CREATE TABLE garrison_release_signatures (
  product_scope text NOT NULL,
  contract_id uuid NOT NULL REFERENCES garrison_contracts(id) ON DELETE CASCADE,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id),
  signed_game_time_ms bigint NOT NULL,
  PRIMARY KEY (product_scope, contract_id, kingdom_id)
);
