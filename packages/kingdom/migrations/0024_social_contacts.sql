CREATE TABLE social_contacts (
  product_scope text NOT NULL,
  kingdom_a uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  kingdom_b uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  accepted_game_time_ms bigint NOT NULL CHECK (accepted_game_time_ms >= 0),
  PRIMARY KEY (product_scope, kingdom_a, kingdom_b),
  CHECK (kingdom_a < kingdom_b)
);

CREATE TABLE social_blocks (
  product_scope text NOT NULL,
  blocker_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  blocked_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  created_game_time_ms bigint NOT NULL CHECK (created_game_time_ms >= 0),
  PRIMARY KEY (product_scope, blocker_kingdom_id, blocked_kingdom_id),
  CHECK (blocker_kingdom_id <> blocked_kingdom_id)
);

CREATE TABLE social_mutes (
  product_scope text NOT NULL,
  muter_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  muted_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  PRIMARY KEY (product_scope, muter_kingdom_id, muted_kingdom_id),
  CHECK (muter_kingdom_id <> muted_kingdom_id)
);

CREATE TABLE cold_contact_requests (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  sender_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  recipient_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  note text NOT NULL,
  operation_key text NOT NULL,
  created_game_time_ms bigint NOT NULL CHECK (created_game_time_ms >= 0),
  expires_game_time_ms bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  status text NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'canceled', 'expired')),
  UNIQUE (product_scope, sender_kingdom_id, operation_key),
  CHECK (sender_kingdom_id <> recipient_kingdom_id),
  CHECK (expires_game_time_ms > created_game_time_ms)
);

CREATE INDEX cold_request_recipient_idx ON cold_contact_requests(product_scope, recipient_kingdom_id, expires_game_time_ms)
  WHERE status = 'pending';

CREATE TABLE direct_messages (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  sender_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  recipient_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  body text NOT NULL,
  agent_originated boolean NOT NULL,
  operation_key text NOT NULL,
  sent_game_time_ms bigint NOT NULL CHECK (sent_game_time_ms >= 0),
  read_game_time_ms bigint,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (product_scope, sender_kingdom_id, operation_key),
  CHECK (sender_kingdom_id <> recipient_kingdom_id)
);

CREATE INDEX direct_messages_unread_idx ON direct_messages(product_scope, recipient_kingdom_id, sender_kingdom_id)
  WHERE read_game_time_ms IS NULL;

CREATE TABLE direct_transfers (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  sender_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  recipient_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  resource text NOT NULL CHECK (resource IN ('iron', 'silver', 'grain')),
  requested_units bigint NOT NULL CHECK (requested_units > 0),
  credited_units bigint NOT NULL CHECK (credited_units >= 0),
  overflow_units bigint NOT NULL CHECK (overflow_units >= 0),
  operation_key text NOT NULL,
  game_time_ms bigint NOT NULL CHECK (game_time_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (product_scope, sender_kingdom_id, operation_key),
  CHECK (sender_kingdom_id <> recipient_kingdom_id),
  CHECK (requested_units = credited_units + overflow_units)
);

CREATE TABLE direct_contact_invitations (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  issuer_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  issued_game_time_ms bigint NOT NULL CHECK (issued_game_time_ms >= 0),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  redeemed_by_kingdom_id uuid REFERENCES kingdoms(id) ON DELETE CASCADE,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  CHECK (expires_at > issued_at)
);
