-- Gameplay can outlive a real-time account erasure deadline during a world pause.
-- Preserve the pseudonymous kingdom and its accepted engagements when identity is removed.
ALTER TABLE kingdoms DROP CONSTRAINT kingdoms_account_id_fkey;
ALTER TABLE kingdoms ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE kingdoms ADD CONSTRAINT kingdoms_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE building_instructions DROP CONSTRAINT building_instructions_account_id_fkey;
ALTER TABLE building_instructions ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE building_instructions ADD CONSTRAINT building_instructions_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE training_batches DROP CONSTRAINT training_batches_account_id_fkey;
ALTER TABLE training_batches ALTER COLUMN account_id DROP NOT NULL;
ALTER TABLE training_batches ADD CONSTRAINT training_batches_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE kingdoms DROP CONSTRAINT kingdoms_status_check;
ALTER TABLE kingdoms ADD CONSTRAINT kingdoms_status_check
  CHECK (status IN ('ranked', 'closing', 'retired'));
ALTER TABLE kingdoms ADD COLUMN retired_at timestamptz;

CREATE INDEX kingdoms_closing_idx ON kingdoms(product_scope, id) WHERE status = 'closing';

CREATE FUNCTION reject_ranked_account_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM kingdoms WHERE account_id = OLD.id AND status = 'ranked') THEN
    RAISE EXCEPTION 'ACCOUNT_DELETION_REQUIRES_RETIREMENT';
  END IF;
  RETURN OLD;
END $$;

CREATE TRIGGER accounts_delete_requires_retirement BEFORE DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION reject_ranked_account_deletion();
