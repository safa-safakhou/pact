ALTER TABLE envoy_runs ADD COLUMN request_deadline_at timestamptz;
CREATE TABLE envoy_model_attempts (
 request_id uuid PRIMARY KEY, product_scope text NOT NULL, run_id uuid NOT NULL REFERENCES envoy_runs(run_id) ON DELETE CASCADE,
 phase text NOT NULL, status text NOT NULL, allocation_tokens integer NOT NULL,
 actual_tokens integer, code text, started_at timestamptz NOT NULL, deadline_at timestamptz NOT NULL,
 updated_at timestamptz NOT NULL
);
CREATE INDEX envoy_model_attempts_run ON envoy_model_attempts(run_id,started_at);
