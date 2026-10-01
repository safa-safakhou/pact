CREATE TABLE chronicle_posts (
 id uuid PRIMARY KEY,
 product_scope text NOT NULL,
 author_kingdom_id uuid REFERENCES kingdoms(id) ON DELETE SET NULL,
 court_id uuid REFERENCES courts(id) ON DELETE SET NULL,
 type text NOT NULL CHECK(type IN ('notice','story')),
 version integer NOT NULL CHECK(version>0),
 title text NOT NULL CHECK(char_length(title)<=60),
 commentary text NOT NULL CHECK(char_length(commentary)<=1200),
 fact jsonb,
 seal_ids uuid[] NOT NULL DEFAULT '{}',
 expires_game_time_ms bigint,
 status text NOT NULL CHECK(status IN ('published','removed')),
 published_at timestamptz NOT NULL,
 command_id uuid NOT NULL UNIQUE,
 CHECK((type='notice')=(expires_game_time_ms IS NOT NULL)),
 CHECK(status='removed' OR (type='story')=(fact IS NOT NULL))
);
CREATE INDEX chronicle_feed ON chronicle_posts(product_scope,status,published_at DESC,id DESC);
