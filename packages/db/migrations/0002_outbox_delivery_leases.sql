ALTER TABLE outbox_deliveries
  ADD COLUMN status text NOT NULL DEFAULT 'leased' CHECK (status IN ('leased', 'delivered')),
  ADD COLUMN leased_by text NOT NULL DEFAULT 'legacy',
  ADD COLUMN lease_expires_at timestamptz,
  ADD COLUMN delivered_at timestamptz,
  ADD COLUMN attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0);

CREATE INDEX outbox_deliveries_recoverable_idx
  ON outbox_deliveries(lease_expires_at)
  WHERE status = 'leased';
