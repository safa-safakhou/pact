CREATE TABLE collection_projection_state (
 product_scope text PRIMARY KEY,
 started_game_time_ms bigint NOT NULL,
 last_outbox_id bigint NOT NULL DEFAULT 0,
 processed_game_time_ms bigint NOT NULL
);
INSERT INTO collection_projection_state
 SELECT product_scope,committed_game_time_ms,0,committed_game_time_ms FROM world_clocks;
CREATE TABLE collection_processed_events (
 product_scope text NOT NULL,event_id uuid NOT NULL,event_type text NOT NULL,
 outbox_id bigint NOT NULL,failure_code text,processed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(product_scope,event_id)
);
CREATE TABLE collection_award_sources (
 product_scope text NOT NULL,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 achievement_id text NOT NULL,source_kind text NOT NULL,source_id uuid,
 peer_kingdom_id uuid REFERENCES kingdoms(id) ON DELETE SET NULL,
 game_time_ms bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(product_scope,account_id,achievement_id)
);
CREATE TABLE collection_partner_keys (
 product_scope text NOT NULL,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 peer_kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
 first_game_time_ms bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(product_scope,account_id,peer_kingdom_id)
);
CREATE TABLE collection_resource_keys (
 product_scope text NOT NULL,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 resource text NOT NULL CHECK(resource IN ('grain','iron','silver')),
 PRIMARY KEY(product_scope,account_id,resource)
);
CREATE TABLE collection_court_intervals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_scope text NOT NULL,
 court_id uuid NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
 kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
 start_game_time_ms bigint NOT NULL,end_game_time_ms bigint,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),closed_at timestamptz,
 CHECK(end_game_time_ms IS NULL OR end_game_time_ms>=start_game_time_ms)
);
CREATE UNIQUE INDEX collection_court_open ON collection_court_intervals(product_scope,court_id,kingdom_id) WHERE end_game_time_ms IS NULL;
-- Current membership proves presence only from this recorded deployment watermark onward.
INSERT INTO collection_court_intervals(product_scope,court_id,kingdom_id,start_game_time_ms)
 SELECT c.product_scope,c.id,m.kingdom_id,GREATEST(m.joined_game_time_ms,w.committed_game_time_ms)
 FROM courts c JOIN court_memberships m ON m.court_id=c.id
 JOIN kingdoms k ON k.id=m.kingdom_id AND k.status='ranked' JOIN world_clocks w ON w.product_scope=c.product_scope
 WHERE c.status='active' AND (SELECT count(DISTINCT k2.account_id) FROM court_memberships m2
  JOIN kingdoms k2 ON k2.id=m2.kingdom_id AND k2.status='ranked' WHERE m2.court_id=c.id)>=2;

-- Retained recipient acknowledgements are real evidence; copy IDs only, never message prose.
INSERT INTO outbox_events(product_scope,event_id,type,payload)
 SELECT proof.product_scope,gen_random_uuid(),'message.acknowledged.v2',jsonb_build_object('messageId',proof.id)
 FROM (SELECT DISTINCT ON(sc.product_scope,sc.kingdom_a,sc.kingdom_b) m.product_scope,m.id
 FROM social_contacts sc JOIN direct_messages m ON m.product_scope=sc.product_scope
  AND LEAST(m.sender_kingdom_id,m.recipient_kingdom_id)=sc.kingdom_a
  AND GREATEST(m.sender_kingdom_id,m.recipient_kingdom_id)=sc.kingdom_b
 JOIN kingdoms a ON a.id=sc.kingdom_a JOIN kingdoms b ON b.id=sc.kingdom_b
 WHERE a.account_id<>b.account_id AND m.read_game_time_ms IS NOT NULL
  AND m.sent_game_time_ms>=sc.accepted_game_time_ms AND m.created_at>=clock_timestamp()-interval '90 days'
  AND EXISTS(SELECT 1 FROM direct_messages r WHERE r.product_scope=m.product_scope
    AND r.sender_kingdom_id=m.recipient_kingdom_id AND r.recipient_kingdom_id=m.sender_kingdom_id
    AND r.sent_game_time_ms>=sc.accepted_game_time_ms AND r.read_game_time_ms IS NOT NULL
    AND r.created_at>=clock_timestamp()-interval '90 days')
 ORDER BY sc.product_scope,sc.kingdom_a,sc.kingdom_b,m.sent_game_time_ms,m.id) proof;
INSERT INTO outbox_events(product_scope,event_id,type,payload)
 SELECT product_scope,gen_random_uuid(),'season.participation.awarded.v2',
 jsonb_build_object('accountId',account_id,'seasonNumber',substring(item_id from '[0-9]+$')::int)
 FROM cosmetic_entitlements WHERE item_id ~ '^banner\.season\.[0-9]+$'
 AND source_achievement_id='season:'||substring(item_id from '[0-9]+$')||':participation';
