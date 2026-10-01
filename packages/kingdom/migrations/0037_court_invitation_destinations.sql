-- Minimal Court destination storage required by PACT-055. Management commands belong to PACT-056.
CREATE TABLE courts (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  handle text NOT NULL CHECK (handle ~ '^[a-z][a-z0-9_]{2,23}$'),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1200),
  owner_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  join_mode text NOT NULL CHECK (join_mode IN ('open', 'request', 'invitation_only')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  archived_at timestamptz,
  UNIQUE(product_scope, handle),
  CHECK ((status = 'archived') = (archived_at IS NOT NULL))
);
CREATE UNIQUE INDEX courts_one_owned_idx ON courts(product_scope, owner_kingdom_id) WHERE status = 'active';
CREATE TABLE court_memberships (
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'moderator', 'member')),
  joined_game_time_ms bigint NOT NULL CHECK (joined_game_time_ms >= 0),
  PRIMARY KEY(court_id, kingdom_id)
);
CREATE INDEX court_memberships_kingdom_idx ON court_memberships(kingdom_id, court_id);
