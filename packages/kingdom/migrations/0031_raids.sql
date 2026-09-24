CREATE TABLE raids (
  id uuid PRIMARY KEY,
  product_scope text NOT NULL,
  leader_kingdom_id uuid NOT NULL REFERENCES kingdoms(id),
  target_kingdom_id uuid NOT NULL REFERENCES kingdoms(id),
  rules_version text NOT NULL,
  declaration_sequence bigint GENERATED ALWAYS AS IDENTITY,
  declared_game_time_ms bigint NOT NULL CHECK (declared_game_time_ms >= 0),
  lock_game_time_ms bigint NOT NULL,
  resolution_game_time_ms bigint NOT NULL,
  status text NOT NULL CHECK (status IN ('declared', 'locked', 'resolved', 'canceled')),
  loot_priority text[] NOT NULL,
  declaration_terms jsonb NOT NULL,
  locked_wall_level integer,
  resolved_game_time_ms bigint,
  closed_at timestamptz,
  participant_report jsonb,
  public_report jsonb,
  CHECK (leader_kingdom_id <> target_kingdom_id),
  CHECK (lock_game_time_ms > declared_game_time_ms),
  CHECK (resolution_game_time_ms > lock_game_time_ms)
);

CREATE INDEX raids_due_lock_idx ON raids(product_scope, lock_game_time_ms, declaration_sequence)
  WHERE status = 'declared';
CREATE INDEX raids_due_resolution_idx ON raids(product_scope, resolution_game_time_ms, declaration_sequence)
  WHERE status = 'locked';

CREATE TABLE raid_nominations (
  product_scope text NOT NULL,
  raid_id uuid NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
  slot smallint NOT NULL CHECK (slot IN (1, 2)),
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id),
  nominated_game_time_ms bigint NOT NULL,
  PRIMARY KEY (product_scope, raid_id, slot),
  UNIQUE (product_scope, raid_id, kingdom_id)
);

CREATE TABLE raid_contributions (
  product_scope text NOT NULL,
  raid_id uuid NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id),
  role text NOT NULL CHECK (role IN ('leader', 'contributor')),
  status text NOT NULL CHECK (status IN ('committed', 'withdrawn')),
  committed_game_time_ms bigint NOT NULL,
  withdrawn_game_time_ms bigint,
  authority_ref uuid,
  provision_units bigint NOT NULL CHECK (provision_units >= 0),
  selection jsonb NOT NULL,
  PRIMARY KEY (product_scope, raid_id, kingdom_id)
);

CREATE INDEX raid_contributions_active_kingdom_idx ON raid_contributions(product_scope, kingdom_id)
  WHERE status = 'committed';
