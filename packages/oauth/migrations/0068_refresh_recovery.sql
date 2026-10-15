-- Independent 256-bit client-held proof; never store reusable tokens in plaintext.
CREATE TABLE oauth_refresh_recoveries (
 product_scope text NOT NULL, parent_hash text NOT NULL, client_id text NOT NULL,
 grant_id uuid NOT NULL REFERENCES oauth_grants(id) ON DELETE CASCADE, proof_hash text NOT NULL,
 response_cipher text NOT NULL, issued_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 PRIMARY KEY(product_scope,parent_hash)
);
CREATE INDEX oauth_refresh_recoveries_expiry ON oauth_refresh_recoveries(expires_at);
