CREATE TABLE kingdom_mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  allowed_actions text[] NOT NULL DEFAULT '{}',
  target_restrictions text[] NOT NULL DEFAULT '{}',
  resource_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  reserve_floors jsonb NOT NULL DEFAULT '{}'::jsonb,
  troop_limit integer NOT NULL DEFAULT 0 CHECK (troop_limit >= 0),
  session_limit integer NOT NULL DEFAULT 0 CHECK (session_limit >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_scope, account_id)
);

CREATE TABLE authority_ledger (
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  asset text NOT NULL,
  spent_units bigint NOT NULL DEFAULT 0 CHECK (spent_units >= 0),
  reserved_units bigint NOT NULL DEFAULT 0 CHECK (reserved_units >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(product_scope, account_id, asset)
);
