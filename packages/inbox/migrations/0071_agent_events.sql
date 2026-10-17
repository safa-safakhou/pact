CREATE TABLE agent_event_owners (
 product_scope text NOT NULL, world_scope text NOT NULL, account_id uuid NOT NULL,
 sequence bigint NOT NULL DEFAULT 0, floor_sequence bigint NOT NULL DEFAULT 0,
 PRIMARY KEY(product_scope,world_scope,account_id)
);
CREATE TABLE agent_events (
 product_scope text NOT NULL,world_scope text NOT NULL,account_id uuid NOT NULL,
 sequence bigint NOT NULL,event_id uuid NOT NULL,type text NOT NULL,source_ref text NOT NULL,
 occurred_at timestamptz NOT NULL,published_at timestamptz NOT NULL,game_time text NOT NULL,
 deadline jsonb,metadata jsonb NOT NULL,
 PRIMARY KEY(product_scope,world_scope,account_id,sequence),
 UNIQUE(product_scope,world_scope,account_id,event_id)
);
CREATE INDEX agent_events_expiry ON agent_events(product_scope,occurred_at);
