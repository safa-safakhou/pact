-- PACT-049: bounded, trusted tool receipts for the next model step.
-- Deleting a retained run or its account also deletes these summaries.
CREATE TABLE envoy_run_tool_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_scope text NOT NULL,
  run_id uuid NOT NULL REFERENCES envoy_runs(run_id) ON DELETE CASCADE,
  request_id text NOT NULL,
  call_id text NOT NULL CHECK (octet_length(call_id) BETWEEN 1 AND 256),
  summary text NOT NULL CHECK (octet_length(summary) BETWEEN 1 AND 4096),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, request_id, call_id)
);

CREATE INDEX envoy_run_tool_results_recent_idx
  ON envoy_run_tool_results (product_scope, run_id, id DESC);
