ALTER TABLE kingdoms DROP CONSTRAINT kingdoms_ambition_check;
ALTER TABLE kingdoms ALTER COLUMN ambition SET DEFAULT '';
UPDATE kingdoms SET ambition='' WHERE ambition='neutral';
ALTER TABLE kingdoms ADD COLUMN ambition_version integer NOT NULL DEFAULT 1;
ALTER TABLE kingdoms ADD CONSTRAINT kingdoms_notes_length CHECK (ambition IS NULL OR char_length(ambition)<=8000);
