# Encrypted model credential storage

Tickets: [PACT-009 / MNI-69](https://linear.app/mnim/issue/MNI-69/pact-009-build-encrypted-model-credential-storage)

Implementation revision/PR: uncommitted local work on `master`, based on `8ca3911`; no PR.

Verification environment: 21 September 2026; macOS arm64; Node.js 24.21.0; npm 11.19.0; PostgreSQL 17 via Colima Compose.

## Result

`@pact/credential-vault` now stores five supported model-provider connection types using a fresh AES-256-GCM data key per save or replacement. The data key is wrapped with RSA-OAEP-SHA256 through an injected capability. API composition receives public wrapping material only; private unwrapping is composed under the inference worker and a repository boundary check rejects that capability elsewhere.

Human routes save, list, replace, and revoke credentials while deriving ownership from the authenticated session. Reads expose only label, four-character suffix, version, lifecycle dates, and status. Replacement requires Origin/CSRF proof plus authentication within five minutes. Revocation immediately clears all live encrypted fields and blocks new inference admission while recording audit, use, and secret-free outbox evidence.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-009 | Key substitution across accounts fails; the API-facing adapter can wrap but cannot unwrap; no key is returned by read/MCP endpoints or included in prompts. | `packages/credential-vault/src/crypto.test.ts`; `tests/integration/credential-vault.test.ts`; `npm run check:boundaries` | Pass. Authenticated encryption rejected copied encrypted columns under a different account context. The public wrapper has no unwrap method; private resolver symbols are rejected outside inference. API list/create bodies, audit/outbox payloads, and documented MCP surface contain no credential. |
| PACT-009 | Revocation immediately prevents a new call; a credential already submitted to a provider is reported truthfully rather than claimed recalled. | `tests/integration/credential-vault.test.ts` — revoke-during-admitted-use case | Pass. A new resolver admission returned `REVOKED`, all encrypted columns were null in the revoke transaction, and the use admitted beforehand completed with the explicit may-complete notice and a `completed` ledger status. |

Supporting checks: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` (21), and `npm run test:integration` (26) passed under Node.js 24 after updating the smoke migration inventory for `0012_credential_vault.sql`.

## Documentation

- [Model credential API and single-VPS key operations](../../api/model-credentials.md)
- [Module boundaries](../../architecture/modules.md)
- [Database migration and recovery](../../operations/database.md)
- [Repository setup and package map](../../../README.md)
- [Account and connection specification](../../pact/access.md)

## Decisions and limitations

The single-VPS implementation deliberately uses asymmetric wrapping so the API needs no private wrapping material. VPS root remains trusted, consistent with Version 1.2. RSA key generation and process-specific read-only mounts are documented, but no production key was generated or committed.

The inference resolver accepts an operation callback only after committing an admission ledger row; provider network work therefore stays outside the database transaction. A provider adapter has not yet been implemented, so the integration fixture simulates the provider call boundary. Provider connection validation belongs to PACT-010 through PACT-014.

No VPS deployment, off-host backup, or hosted restore was claimed. Those remain PACT-004 and later operations-gate work.

## Handoff

PACT-009 is complete. The tracker should select the next dependency-ready backlog ticket after reconciling Linear; provider adapters remain dependency-bound to their own tickets, and PACT-004 remains the separate single-VPS connection-test environment gate.
