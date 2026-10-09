-- Pending guest conversion shares verification-token retention and account erasure.
ALTER TABLE email_verification_tokens
  ADD COLUMN pending_email text,
  ADD COLUMN pending_password_hash text,
  ADD COLUMN pending_terms_version text;
ALTER TABLE email_verification_tokens ADD CONSTRAINT guest_claim_shape CHECK (
  (pending_email IS NULL AND pending_password_hash IS NULL AND pending_terms_version IS NULL)
  OR (pending_email IS NOT NULL AND pending_password_hash IS NOT NULL AND pending_terms_version IS NOT NULL)
);
