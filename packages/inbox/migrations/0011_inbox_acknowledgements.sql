CREATE TABLE inbox_acknowledgements (
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  last_sequence bigint NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(product_scope, account_id)
);

CREATE INDEX inbox_events_account_sequence_idx ON inbox_events(product_scope, account_id, sequence);
