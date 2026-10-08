-- Public visual identity, separate from private strategy/authority.
ALTER TABLE kingdoms ADD COLUMN envoy_character jsonb;
ALTER TABLE kingdoms ADD COLUMN envoy_character_version integer NOT NULL DEFAULT 1;
ALTER TABLE kingdoms ADD COLUMN ruler_observed_at timestamptz;
ALTER TABLE kingdoms ADD CONSTRAINT envoy_character_size CHECK (envoy_character IS NULL OR octet_length(envoy_character::text) <= 2048);
