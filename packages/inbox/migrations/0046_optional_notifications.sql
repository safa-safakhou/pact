CREATE TABLE notification_preferences (
 product_scope text NOT NULL, account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 category text NOT NULL, channel text NOT NULL CHECK(channel IN ('email','webpush','native','telegram')),
 enabled boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL,
 PRIMARY KEY(product_scope,account_id,category,channel)
);
CREATE TABLE notification_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_scope text NOT NULL,
 account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 endpoint_hash text NOT NULL, sealed_subscription text, created_at timestamptz NOT NULL,
 revoked_at timestamptz, UNIQUE(product_scope,endpoint_hash)
);
CREATE TABLE notification_windows (
 product_scope text NOT NULL, account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 subject_id text NOT NULL, category text NOT NULL, window_id uuid NOT NULL, opened_at timestamptz NOT NULL,
 PRIMARY KEY(product_scope,account_id,subject_id,category)
);
CREATE TABLE notification_seen_events (
 product_scope text NOT NULL, account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 event_id uuid NOT NULL, processed_at timestamptz NOT NULL,
 PRIMARY KEY(product_scope,account_id,event_id)
);
CREATE TABLE notification_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_scope text NOT NULL,
 account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, subject_id text NOT NULL,
 category text NOT NULL, channel text NOT NULL, endpoint_id uuid REFERENCES notification_subscriptions(id) ON DELETE CASCADE,
 dedup_key text NOT NULL, event_count integer NOT NULL DEFAULT 1,
 status text NOT NULL DEFAULT 'ready' CHECK(status IN ('ready','delivered','cancelled')),
 available_at timestamptz NOT NULL, created_at timestamptz NOT NULL, delivered_at timestamptz,
 leased_by text, lease_expires_at timestamptz, attempts integer NOT NULL DEFAULT 0,
 UNIQUE(product_scope,dedup_key)
);
CREATE INDEX notification_delivery_ready ON notification_deliveries(available_at) WHERE status='ready';
