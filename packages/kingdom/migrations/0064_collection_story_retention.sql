ALTER TABLE collection_stories ADD COLUMN unavailable_incident_count int NOT NULL DEFAULT 0 CHECK(unavailable_incident_count>=0);
ALTER TABLE collection_stories ADD COLUMN updated_at timestamptz NOT NULL DEFAULT clock_timestamp();
