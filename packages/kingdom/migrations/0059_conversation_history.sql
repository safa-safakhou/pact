CREATE TABLE supply_offer_versions (
  product_scope text NOT NULL,
  offer_id uuid NOT NULL REFERENCES supply_offers(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK(version > 0),
  terms jsonb NOT NULL,
  expires_game_time_ms bigint NOT NULL,
  observed_game_time_ms bigint NOT NULL,
  proposed_by uuid REFERENCES kingdoms(id) ON DELETE SET NULL,
  historical_baseline boolean NOT NULL DEFAULT false,
  PRIMARY KEY(product_scope,offer_id,version)
);
-- Earlier overwritten terms cannot be reconstructed. Preserve only the retained version.
INSERT INTO supply_offer_versions
  SELECT product_scope,id,version,terms,expires_game_time_ms,updated_game_time_ms,NULL,true FROM supply_offers;

CREATE TABLE conversation_observation_consents (
  product_scope text NOT NULL,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  peer_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  observer_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  enabled boolean NOT NULL,
  version integer NOT NULL CHECK(version > 0),
  changed_game_time_ms bigint NOT NULL,
  PRIMARY KEY(product_scope,kingdom_id,peer_kingdom_id,observer_kingdom_id),
  CHECK(kingdom_id<>peer_kingdom_id AND kingdom_id<>observer_kingdom_id AND peer_kingdom_id<>observer_kingdom_id)
);
CREATE INDEX conversation_observer_idx ON conversation_observation_consents(product_scope,observer_kingdom_id) WHERE enabled;
