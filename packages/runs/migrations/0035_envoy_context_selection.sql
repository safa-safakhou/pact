ALTER TABLE envoy_runs
  ADD COLUMN selected_context_ids text[] NOT NULL DEFAULT '{}';

ALTER TABLE envoy_runs
  ADD CONSTRAINT envoy_runs_selected_context_limit
  CHECK (cardinality(selected_context_ids) = used_conversations
    AND cardinality(selected_context_ids) <= max_conversations);
