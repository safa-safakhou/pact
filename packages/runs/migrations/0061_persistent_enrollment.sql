CREATE TABLE persistent_enrollments (
 product_scope text NOT NULL,
 account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 id uuid NOT NULL,
 version integer NOT NULL CHECK(version>0),
 status text NOT NULL CHECK(status IN ('active','needs_owner','revoked','expired','exhausted')),
 settings jsonb NOT NULL,
 deadline_at timestamptz NOT NULL,
 next_eligible_at timestamptz NOT NULL,
 work_cursor bigint NOT NULL DEFAULT 0,
 pending_sequence bigint NOT NULL DEFAULT 0,
 pending_work boolean NOT NULL DEFAULT true,
 allocated_calls integer NOT NULL DEFAULT 0 CHECK(allocated_calls>=0),
 allocated_tokens bigint NOT NULL DEFAULT 0 CHECK(allocated_tokens>=0),
 slice_sequence integer NOT NULL DEFAULT 0,
 active_run_id uuid REFERENCES envoy_runs(run_id) ON DELETE SET NULL,
 last_success_at timestamptz,
 objective_pruned boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL,
 PRIMARY KEY(product_scope,account_id,id)
);
CREATE UNIQUE INDEX persistent_enrollment_one_active_owner ON persistent_enrollments(product_scope,account_id) WHERE status IN ('active','needs_owner');
CREATE INDEX persistent_enrollment_eligible_idx ON persistent_enrollments(product_scope,status,next_eligible_at);
CREATE TABLE persistent_enrollment_receipts (
 product_scope text NOT NULL,
 account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 command_id uuid NOT NULL,
 request_hash text NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY(product_scope,account_id,command_id)
);
CREATE TABLE persistent_work_slices (
 product_scope text NOT NULL,
 account_id uuid NOT NULL,
 enrollment_id uuid NOT NULL,
 sequence integer NOT NULL,
 run_id uuid REFERENCES envoy_runs(run_id) ON DELETE SET NULL,
 event_sequence bigint NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY(product_scope,account_id,enrollment_id,sequence),
 FOREIGN KEY(product_scope,account_id,enrollment_id) REFERENCES persistent_enrollments(product_scope,account_id,id) ON DELETE CASCADE
);
CREATE TABLE persistent_execution_hosts (
 product_scope text NOT NULL,
 host_id text NOT NULL,
 last_heartbeat_at timestamptz NOT NULL,
 available boolean NOT NULL,
 next_available_at timestamptz NOT NULL,
 PRIMARY KEY(product_scope,host_id)
);
CREATE INDEX IF NOT EXISTS inbox_events_owner_sequence_idx ON inbox_events(product_scope,account_id,sequence);
