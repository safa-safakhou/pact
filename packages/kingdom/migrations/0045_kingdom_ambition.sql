ALTER TABLE kingdoms ADD COLUMN ambition text DEFAULT 'neutral' CHECK (ambition IS NULL OR ambition IN ('neutral','farmer','trader','defender'));
