CREATE TABLE destination_invitations (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  issuer_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  destination_type text NOT NULL CHECK (destination_type IN ('contact', 'court', 'notice', 'story')),
  destination_id uuid NOT NULL,
  token_hash bytea NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  issued_game_time_ms bigint NOT NULL CHECK (issued_game_time_ms >= 0),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz,
  expires_game_time_ms bigint,
  redemption_limit integer NOT NULL CHECK (redemption_limit BETWEEN 1 AND 10000),
  redemption_count integer NOT NULL DEFAULT 0 CHECK (redemption_count >= 0 AND redemption_count <= redemption_limit),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  revoked_at timestamptz,
  CHECK (expires_at IS NULL OR expires_at > issued_at),
  CHECK ((destination_type = 'notice') = (expires_at IS NULL)),
  CHECK ((destination_type = 'notice') = (expires_game_time_ms IS NOT NULL))
);
CREATE INDEX destination_invitations_issuer_idx ON destination_invitations(product_scope, issuer_kingdom_id, issued_game_time_ms);
CREATE TABLE invitation_redemptions (
  invitation_id uuid NOT NULL REFERENCES destination_invitations(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL,
  PRIMARY KEY(invitation_id, account_id)
);
CREATE TABLE account_invitation_destinations (
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invitation_id uuid NOT NULL REFERENCES destination_invitations(id) ON DELETE CASCADE,
  remembered_at timestamptz NOT NULL,
  PRIMARY KEY(product_scope, account_id)
);
