ALTER TABLE accounts ADD COLUMN is_guest boolean NOT NULL DEFAULT false;
ALTER TABLE accounts ADD COLUMN guest_entry_hash text;
ALTER TABLE accounts ALTER COLUMN email DROP NOT NULL;
CREATE UNIQUE INDEX accounts_guest_entry_idx ON accounts(product_scope, guest_entry_hash) WHERE guest_entry_hash IS NOT NULL;
ALTER TABLE accounts ADD CONSTRAINT guest_identity_shape CHECK (
  (is_guest AND email IS NULL AND email_verified_at IS NULL AND guest_entry_hash IS NOT NULL AND role='player')
  OR (NOT is_guest AND email IS NOT NULL AND guest_entry_hash IS NULL)
);
