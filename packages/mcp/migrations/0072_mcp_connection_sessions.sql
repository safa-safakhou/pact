-- Stateless hosts keep their grant-scoped reconnect behavior. Concurrent
-- controllers can explicitly own an independent transport lifetime.
ALTER TABLE mcp_sessions ADD COLUMN connection_scoped boolean NOT NULL DEFAULT false;
DROP INDEX mcp_sessions_open_grant_uidx;
CREATE UNIQUE INDEX mcp_sessions_open_grant_uidx
  ON mcp_sessions(product_scope, oauth_grant_id)
  WHERE oauth_grant_id IS NOT NULL AND closed_at IS NULL AND NOT connection_scoped;
