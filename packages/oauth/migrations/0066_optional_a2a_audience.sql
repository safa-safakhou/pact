-- Add a separately resource-bound agent interface without modifying existing grants.
ALTER TABLE oauth_clients DROP CONSTRAINT oauth_clients_audience_check;
ALTER TABLE oauth_clients ADD CONSTRAINT oauth_clients_audience_check CHECK(audience IN ('human','mcp','a2a'));
ALTER TABLE oauth_grants DROP CONSTRAINT oauth_grants_audience_check;
ALTER TABLE oauth_grants ADD CONSTRAINT oauth_grants_audience_check CHECK(audience IN ('human','mcp','a2a'));
