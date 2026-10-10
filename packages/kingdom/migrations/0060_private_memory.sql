CREATE TABLE private_memory_entries (
  product_scope text NOT NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  current_version integer NOT NULL CHECK(current_version>0),
  kind text NOT NULL CHECK(kind IN ('assessment','strategy','goal','milestone','question')),
  topic text NOT NULL CHECK(char_length(topic) BETWEEN 1 AND 80),
  peer_kingdom_id uuid REFERENCES kingdoms(id) ON DELETE SET NULL,
  updated_game_time_ms bigint NOT NULL CHECK(updated_game_time_ms>=0),
  deleted boolean NOT NULL DEFAULT false,
  PRIMARY KEY(product_scope,account_id,id)
);
CREATE INDEX private_memory_owner_cursor_idx ON private_memory_entries(product_scope,account_id,updated_game_time_ms DESC,id DESC);
CREATE TABLE private_memory_revisions (
  product_scope text NOT NULL,
  account_id uuid NOT NULL,
  entry_id uuid NOT NULL,
  version integer NOT NULL CHECK(version>0),
  command_id uuid NOT NULL,
  request_hash text NOT NULL,
  author_kind text NOT NULL CHECK(author_kind IN ('human','agent')),
  kind text NOT NULL,
  topic text NOT NULL,
  text text NOT NULL CHECK(char_length(text)<=8000),
  source_refs jsonb NOT NULL,
  observed_game_time_ms bigint NOT NULL,
  rules_id text NOT NULL,
  deleted boolean NOT NULL,
  recorded_at timestamptz NOT NULL,
  content_pruned boolean NOT NULL DEFAULT false,
  CHECK(octet_length(to_json(text)::text)+octet_length(source_refs::text)<=30000),
  PRIMARY KEY(product_scope,account_id,entry_id,version),
  UNIQUE(product_scope,account_id,command_id),
  FOREIGN KEY(product_scope,account_id,entry_id) REFERENCES private_memory_entries(product_scope,account_id,id) ON DELETE CASCADE
);
