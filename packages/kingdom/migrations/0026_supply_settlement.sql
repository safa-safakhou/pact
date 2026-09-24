ALTER TABLE supply_contracts
  ADD COLUMN notice_by uuid REFERENCES kingdoms(id),
  ADD COLUMN notice_end_game_time_ms bigint,
  ADD COLUMN close_reason text,
  ADD COLUMN closed_game_time_ms bigint;

CREATE TABLE supply_refusals (
  product_scope text NOT NULL,
  contract_id uuid NOT NULL REFERENCES supply_contracts(id) ON DELETE CASCADE,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  effective_game_time_ms bigint NOT NULL,
  PRIMARY KEY (product_scope, contract_id, kingdom_id)
);

CREATE TABLE supply_release_signatures (
  product_scope text NOT NULL,
  contract_id uuid NOT NULL REFERENCES supply_contracts(id) ON DELETE CASCADE,
  kingdom_id uuid NOT NULL REFERENCES kingdoms(id) ON DELETE CASCADE,
  signed_game_time_ms bigint NOT NULL,
  PRIMARY KEY (product_scope, contract_id, kingdom_id)
);

CREATE TABLE supply_installments (
  product_scope text NOT NULL,
  contract_id uuid NOT NULL REFERENCES supply_contracts(id) ON DELETE CASCADE,
  game_time_ms bigint NOT NULL,
  payer_kingdom_id uuid NOT NULL REFERENCES kingdoms(id),
  recipient_kingdom_id uuid NOT NULL REFERENCES kingdoms(id),
  resource text NOT NULL CHECK (resource IN ('iron', 'silver', 'grain')),
  due_units bigint NOT NULL CHECK (due_units > 0),
  delivered_units bigint NOT NULL CHECK (delivered_units >= 0 AND delivered_units <= due_units),
  overflow_units bigint NOT NULL DEFAULT 0 CHECK (overflow_units >= 0),
  failure_reason text,
  PRIMARY KEY (product_scope, contract_id, game_time_ms, payer_kingdom_id)
);
CREATE INDEX supply_installments_payer_idx ON supply_installments(product_scope, payer_kingdom_id, game_time_ms);
