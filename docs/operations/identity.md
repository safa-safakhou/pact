# Identity and onboarding operations

`@pact/identity` implements the canonical email/password account. Emails are trimmed, the domain is converted to ASCII, and comparison uses the normalized lowercase login identifier without removing plus tags or dots. Passwords are 15–128 Unicode code points and at most 1,024 UTF-8 bytes. Argon2id uses 64 MiB, three passes, parallelism one, a unique 16-byte salt, and a 32-byte tag.

The production process requires three secrets/configurations beyond the database:

- `IDENTITY_TOKEN_PEPPER`: at least 32 random bytes encoded as base64url, used to HMAC opaque session, CSRF, verification, reset, and recovery values.
- `IDENTITY_ENCRYPTION_KEY`: exactly 32 random bytes encoded as base64url, used for AES-256-GCM encryption of TOTP seeds and security-email delivery tokens.
- `COMPROMISED_PASSWORD_SHA256_FILE`: a local newline-delimited SHA-256 digest corpus. Passwords are checked in process and are never sent to another service. Development uses a deliberately small fixture set; production startup rejects a missing corpus.

Generate each application secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. Store production values through the deployment secret manager; never commit them. The values in `.env.example` are public development fixtures and production startup rejects them.

Verification tokens contain 256 random bits and last 24 hours. Reset and email-change tokens last 15 minutes. Token tables store HMACs only. The transactional email outbox stores an authenticated encrypted delivery token, never the plaintext token; only the authorized security-email delivery process receives the identity encryption key. Remove the outbox payload after the normal delivery/audit lifecycle.

Human sessions have seven-day sliding idle expiry and 30-day absolute expiry. Authentication rotates the session ID. Sensitive operations call `requireRecentHumanSession`, which requires the `human` audience and authentication within five minutes. Agent/game credentials cannot approve, raise authority, replace model credentials, export, delete, or change account security. Staff rows require MFA before login succeeds.

Login failures use durable 15-minute buckets: five per normalized account and 30 per direct connection IP. Verification and reset email requests allow three per normalized address per hour. Rate-limit subjects are HMACed. API responses do not reveal whether an email exists.

Password reset and sign-out-everywhere atomically revoke active sessions and OAuth grants, append `access.revoked.v1` with `cancelActiveRuns: true`, record a security event, and queue required email. The run service consumes that outbox event when implemented. Security events use the 90-day class; any attached IP is removed after seven days under the privacy policy.

`@pact/onboarding` preserves one private draft and its typed invitation destination for seven days. Repeated setup, logout, recovery, or redirect handling reads the same server record. Expired unused drafts are removed by `purgeExpiredDrafts`; unverified registrations and expired credentials are removed by `IdentityService.purgeExpired`. Schedule both at least daily when the durable scheduler arrives.

## Real-registration operator preflight

The API fails closed for `POST /v1/auth/signup`. A deployment can accept a signup only when `PACT_OPERATOR_REGISTER_FILE` points to a readable, valid JSON register and that register explicitly sets `realRegistrationEnabled` to `true`. Login, recovery, privacy operations, and existing synthetic accounts remain available while registration is closed.

Copy `infra/production/operator-register.example.json` to the host-only state directory and replace every placeholder with reviewed facts. Never enable the example itself. The register requires:

- the controller legal name and contact address, public privacy/support contacts, and accountable owners;
- HTTPS terms, privacy, and privacy-request routes, with a terms version exactly matching `CURRENT_TERMS_VERSION`;
- purposes/lawful bases plus every relevant processor's purpose, data location, agreement record, and transfer position;
- explicit Telegram, device-session, and model-provider disclosures;
- the SMTP sender/mode and evidence references for delivery, staff MFA, restore, and deletion checks.

Validate the host copy without printing its full contents:

```sh
CURRENT_TERMS_VERSION=connection-test-v1 \
  npm run preflight:operator -- /srv/pact/state/operator/operator-register.json
```

The command emits only readiness, registration state, and field-level validation errors. It exits non-zero unless real registration is both valid and enabled. `GET /v1/legal/registration-status` exposes only the boolean gate. `GET /v1/legal/notices` exposes the reviewed public controller, document, processor, and channel disclosures; it deliberately omits agreement references, accountable-owner names, and operational evidence.
