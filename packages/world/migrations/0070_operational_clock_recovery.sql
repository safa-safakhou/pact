-- Old pauses are deliberately operator-owned until explicitly reviewed.
ALTER TABLE world_clocks ADD COLUMN pause_origin text NOT NULL DEFAULT 'operator';
ALTER TABLE world_clocks ADD COLUMN recovery_checks integer NOT NULL DEFAULT 0;
