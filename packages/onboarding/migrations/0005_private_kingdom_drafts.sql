ALTER TABLE kingdom_drafts
  ADD COLUMN display_name text,
  ADD COLUMN proposed_handle text,
  ADD COLUMN portrait text,
  ADD COLUMN invitation_destination_type text CHECK (
    invitation_destination_type IS NULL OR invitation_destination_type IN ('contact', 'court', 'notice', 'story')
  ),
  ADD COLUMN invitation_destination_id uuid,
  ADD COLUMN connection_checked_at timestamptz,
  ADD COLUMN expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  ADD COLUMN activated_at timestamptz;

CREATE TABLE sandbox_activation_fixtures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL UNIQUE REFERENCES kingdom_drafts(id) ON DELETE CASCADE,
  receipt_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_scope, account_id)
);

CREATE INDEX kingdom_drafts_expiry_idx ON kingdom_drafts(expires_at) WHERE activated_at IS NULL;
