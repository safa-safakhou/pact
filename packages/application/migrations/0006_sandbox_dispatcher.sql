ALTER TABLE command_receipts
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS command_receipts_account_command_idx
  ON command_receipts(product_scope, account_id, command_id);

CREATE TABLE sandbox_counters (
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  counter_id text NOT NULL,
  value integer NOT NULL DEFAULT 0 CHECK (value >= 0),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_scope, account_id, counter_id)
);

CREATE TABLE sandbox_drafts (
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_scope, account_id)
);
