CREATE TABLE collection_incidents (
 product_scope text NOT NULL,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 id uuid NOT NULL,kind text NOT NULL,source_kind text NOT NULL,source_id uuid,
 game_time_ms bigint NOT NULL,facts jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(product_scope,account_id,id)
);
CREATE INDEX collection_incident_page ON collection_incidents(product_scope,account_id,game_time_ms DESC,id DESC);
CREATE TABLE collection_campaign_instances (
 product_scope text NOT NULL,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 id uuid NOT NULL,item_id text NOT NULL DEFAULT 'campaign.medallion',pattern text NOT NULL,
 incident_id uuid,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(product_scope,account_id,id),
 FOREIGN KEY(product_scope,account_id,incident_id) REFERENCES collection_incidents(product_scope,account_id,id) ON DELETE SET NULL (incident_id)
);
CREATE TABLE collection_display (
 product_scope text NOT NULL,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 version int NOT NULL DEFAULT 0,display jsonb NOT NULL,
 PRIMARY KEY(product_scope,account_id)
);
CREATE TABLE collection_stories (
 product_scope text NOT NULL,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 id uuid NOT NULL,version int NOT NULL,title text NOT NULL,annotation text NOT NULL,
 incident_ids uuid[] NOT NULL DEFAULT '{}',deleted boolean NOT NULL DEFAULT false,
 PRIMARY KEY(product_scope,account_id,id),CHECK(length(title)<=120),CHECK(length(annotation)<=4000),CHECK(cardinality(incident_ids)<=8)
);
CREATE TABLE collection_command_receipts (
 product_scope text NOT NULL,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 command_id uuid NOT NULL,request_hash text NOT NULL,receipt jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(product_scope,account_id,command_id)
);
-- Only new cosmetic projection is replayed; old grants/combat/economy stay committed.
DELETE FROM collection_processed_events WHERE event_type='raid.resolved.v1';
