CREATE TABLE kingdom_articles (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  author_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK(version > 0),
  title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 60),
  body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 1200),
  created_at timestamptz NOT NULL,
  published_at timestamptz NOT NULL,
  supersedes_id uuid REFERENCES kingdom_articles(id) ON DELETE SET NULL,
  status text NOT NULL CHECK(status IN ('active','withdrawn','replaced','moderated')),
  closed_at timestamptz,
  signed_command_id uuid NOT NULL UNIQUE,
  content_digest text NOT NULL,
  CHECK((status='active')=(closed_at IS NULL))
);
CREATE INDEX articles_author ON kingdom_articles(product_scope,author_kingdom_id,status);
CREATE TABLE allegiance_proposals (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  proposer_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  subject_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  patron_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK(version > 0),
  status text NOT NULL CHECK(status IN ('pending','accepted','declined','canceled')),
  expires_game_time_ms bigint NOT NULL,
  created_at timestamptz NOT NULL,
  signed_command_id uuid NOT NULL,
  accepted_command_id uuid,
  CHECK(subject_kingdom_id <> patron_kingdom_id),
  CHECK(proposer_kingdom_id IN (subject_kingdom_id,patron_kingdom_id))
);
CREATE INDEX allegiance_pending ON allegiance_proposals(product_scope,status,subject_kingdom_id,patron_kingdom_id);
CREATE TABLE allegiance_edges (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  subject_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  patron_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  proposal_id uuid NOT NULL UNIQUE REFERENCES allegiance_proposals(id),
  version integer NOT NULL CHECK(version > 0),
  status text NOT NULL CHECK(status IN ('active','ended')),
  created_at timestamptz NOT NULL,
  ended_at timestamptz,
  CHECK(subject_kingdom_id <> patron_kingdom_id),
  CHECK((status='active')=(ended_at IS NULL))
);
CREATE UNIQUE INDEX allegiance_one_patron ON allegiance_edges(product_scope,subject_kingdom_id) WHERE status='active';
CREATE TABLE politics_events (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  kingdom_id uuid REFERENCES kingdoms(id) ON DELETE SET NULL,
  kind text NOT NULL,
  record_id uuid NOT NULL,
  created_at timestamptz NOT NULL
);
