CREATE TABLE seal_signing_keys (
  kid text PRIMARY KEY,
  product_scope text NOT NULL,
  public_jwk jsonb NOT NULL,
  encrypted_private_key bytea NOT NULL,
  created_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  compromised boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX seal_active_key ON seal_signing_keys(product_scope) WHERE active;
CREATE TABLE evidence_seals (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  creator_kingdom_id uuid REFERENCES kingdoms(id) ON DELETE SET NULL,
  record_type text NOT NULL CHECK(record_type IN ('message','scout','battle')),
  record_id uuid NOT NULL,
  preview_payload jsonb NOT NULL,
  signed_payload jsonb,
  signature text,
  kid text REFERENCES seal_signing_keys(kid),
  status text NOT NULL CHECK(status IN ('pending','published','removed')),
  created_at timestamptz NOT NULL,
  published_at timestamptz,
  command_id uuid NOT NULL UNIQUE,
  CHECK((signed_payload IS NOT NULL AND signature IS NOT NULL AND kid IS NOT NULL) OR status <> 'published')
);
CREATE INDEX seal_pending ON evidence_seals(product_scope,created_at,id) WHERE status='pending';
CREATE TABLE seal_source_removals (
  product_scope text NOT NULL,
  record_type text NOT NULL,
  record_id uuid NOT NULL,
  removed_at timestamptz NOT NULL,
  PRIMARY KEY(product_scope,record_type,record_id)
);
