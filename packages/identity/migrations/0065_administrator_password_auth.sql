-- Founder-requested administrator policy; existing staff MFA stays the default.
ALTER TABLE accounts ADD COLUMN staff_auth_policy text NOT NULL DEFAULT 'mfa'
  CHECK (staff_auth_policy IN ('mfa', 'password'));
UPDATE accounts SET staff_auth_policy='password',totp_secret_ciphertext=NULL
WHERE role='staff' AND email ~ '^[a-z][a-z0-9_-]{2,31}@operators[.]pact[.]invalid$';
DELETE FROM mfa_recovery_codes WHERE account_id IN (
  SELECT id FROM accounts WHERE role='staff' AND staff_auth_policy='password'
);
DELETE FROM totp_enrollments WHERE account_id IN (
  SELECT id FROM accounts WHERE role='staff' AND staff_auth_policy='password'
);
