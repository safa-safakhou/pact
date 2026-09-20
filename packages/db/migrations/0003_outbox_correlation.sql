ALTER TABLE outbox_events
  ADD COLUMN request_id uuid,
  ADD COLUMN command_id uuid,
  ADD COLUMN run_id uuid,
  ADD COLUMN job_id uuid;

CREATE INDEX outbox_events_command_id_idx ON outbox_events(command_id) WHERE command_id IS NOT NULL;
CREATE INDEX outbox_events_request_id_idx ON outbox_events(request_id) WHERE request_id IS NOT NULL;
