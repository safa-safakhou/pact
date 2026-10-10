CREATE TABLE revoked_guest_keys (
  product_scope text NOT NULL,
  key_hash text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY(product_scope,key_hash)
);
