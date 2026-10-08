-- A consumer host may initialize a fresh HTTP transport for each tool call.
-- Resume its logical session only within the same authenticated OAuth grant.
ALTER TABLE mcp_sessions
  ADD COLUMN oauth_grant_id uuid REFERENCES oauth_grants(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX mcp_sessions_open_grant_uidx
  ON mcp_sessions(product_scope, oauth_grant_id)
  WHERE oauth_grant_id IS NOT NULL AND closed_at IS NULL;
