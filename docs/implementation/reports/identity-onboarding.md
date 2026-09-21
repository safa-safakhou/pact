# Human identity, account security, and private onboarding

Tickets: PACT-006 / [MNI-66](https://linear.app/mnim/issue/MNI-66/pact-006-implement-signup-verification-and-human-sessions), PACT-007 / [MNI-67](https://linear.app/mnim/issue/MNI-67/pact-007-implement-recovery-reauthentication-and-account-security), PACT-008 / [MNI-68](https://linear.app/mnim/issue/MNI-68/pact-008-implement-private-kingdom-drafts-and-resumable-setup)
Implementation revision/PR: `f8eabe5`, based on tracker revision `4228a6e`; no PR.
Verification date/environment: 2026-09-20; macOS, Node 24.21.0, npm 11.19.0, PostgreSQL 17.11 in Docker/Colima.

## Result

PACT now has canonical human email/password accounts, verification, hardened server sessions, durable authentication throttles, recovery, recent-auth gates, optional TOTP/recovery codes, staff MFA enforcement, connection inventory, account-wide revocation, and private resumable setup drafts. Identity and onboarding own separate packages and migrations. The HTTP adapter derives account ownership from the session cookie and protects writes with CSRF and exact-origin checks.

Security email requests commit through the outbox with the account mutation. Token tables contain HMACs only; the email delivery value is AES-256-GCM sealed in the outbox. Password reset and sign-out-everywhere revoke human sessions and OAuth grants and emit active-run cancellation. The setup activation is an idempotent sandbox receipt and cannot create real gameplay state.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-006 | Duplicate concurrent signup/verification cannot create two accounts or reuse an expired token. | `tests/integration/identity-onboarding.test.ts`; `npm run test:integration` | Pass: normalized concurrent signup creates one account and one email request; concurrent verification has one success; used and 24-hour-expired tokens fail. Persisted token/outbox data contains no plaintext token. |
| PACT-006 | Password and session expiry, CSRF, cross-account access, throttling, and email enumeration fixtures pass. | Identity integration and HTTP boundary fixtures; `npm run test:integration` | Pass: compromised/invalid passwords fail, idle and absolute expiry pass, origin/CSRF failures are rejected, ownership comes from the cookie, login/email limits persist, and recovery responses match for existing/missing accounts. |
| PACT-007 | A reset token is single-use and expires after 15 minutes; resetting revokes old cookies and OAuth grants. | Recovery integration fixture; `npm run test:integration` | Pass: replay/expiry fail; sessions and OAuth grants are revoked atomically; an `access.revoked.v1` event requests active-run cancellation. |
| PACT-007 | An Envoy cannot raise authority, replace a credential, export, delete, or approve using a game token; TOTP recovery codes cannot be reused. | Audience/recent-auth/MFA fixture; `npm run test:integration` | Pass: every listed sensitive action rejects an agent session, recent auth expires after five minutes, staff login requires MFA, and a used recovery code fails on replay. |
| PACT-008 | A draft has no stocks, troops, score, or targetable public kingdom identity. | Draft fixture and schema inspection; `npm run test:integration` | Pass: only private setup fields exist, no `kingdoms` table is created, and the activation fixture records only an opaque receipt. |
| PACT-008 | OAuth redirect, logout/recovery, and repeated setup submissions preserve the same permitted destination; stale checks and unverified accounts fail activation validation. | Resumable setup fixture; `npm run test:integration` | Pass: the server-side typed destination survives repeated draft acquisition, concurrent activation returns one receipt, and unverified, expired, and stale-check paths fail. Daily purge methods retain verified accounts while removing expired drafts/unverified registrations. |

Supporting checks: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` (7 files, 18 tests), `npm run test:integration` (3 files, 12 tests), two idempotent `npm run db:migrate` executions, backlog render/check, and `git diff --check` pass locally.

## Documentation

- `docs/api/identity.md` documents the HTTP boundary and ownership rules.
- `docs/operations/identity.md` documents password parameters, required production configuration, token storage, expiry, throttling, revocation, and purge jobs.
- `docs/architecture/modules.md` records identity/onboarding ownership and trust boundaries.
- `docs/operations/database.md` records module-owned migration discovery.
- `README.md` lists the new packages and operations guide.

## Decisions and limitations

The compromised-password checker consumes an offline SHA-256 digest corpus; production refuses to start without its configured file and never sends passwords to a third party. Development includes only a small synthetic fixture set. Production secret injection and centralized retention enforcement remain part of PACT-004.

Security-email delivery is queued and durable, but an external sender is intentionally absent until the environment/provider work. The authorized delivery process must decrypt the sealed delivery token, send it, and never log it. `access.revoked.v1` truthfully requests run cancellation; the inference runtime consumes it in its later ticket. Real kingdom founding remains PACT-031.

## Handoff

PACT-006 through PACT-008 are complete. Version 1.2 later removed the hosted-deployment dependency from PACT-009 and replaced KMS with an injected wrapping-key port suitable for the single-VPS design. PACT-009 is therefore dependency-ready from PACT-007 without claiming that the VPS deployment has passed.
