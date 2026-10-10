-- A full 4096-codepoint Unicode message must fit a bounded tool-result page.
ALTER TABLE envoy_run_tool_results DROP CONSTRAINT envoy_run_tool_results_summary_check;
ALTER TABLE envoy_run_tool_results ADD CONSTRAINT envoy_run_tool_results_summary_check CHECK (octet_length(summary) BETWEEN 1 AND 65536);
