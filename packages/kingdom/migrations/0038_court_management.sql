CREATE TABLE court_requests (
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL,
  PRIMARY KEY(court_id, kingdom_id)
);
CREATE TABLE court_transfers (
  id uuid PRIMARY KEY,
  court_id uuid NOT NULL UNIQUE REFERENCES courts(id) ON DELETE CASCADE,
  from_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  to_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  proposed_at timestamptz NOT NULL,
  CHECK(from_kingdom_id <> to_kingdom_id)
);
CREATE TABLE court_pins (
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  slot integer NOT NULL CHECK(slot BETWEEN 1 AND 3),
  author_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 1200),
  created_at timestamptz NOT NULL,
  PRIMARY KEY(court_id, slot)
);
CREATE TABLE court_audit (
  id uuid PRIMARY KEY,
  court_id uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  actor_kingdom_id uuid REFERENCES kingdoms(id) ON DELETE SET NULL,
  kind text NOT NULL,
  details jsonb NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX court_audit_page ON court_audit(court_id, created_at, id);
