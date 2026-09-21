# Shared dispatcher and sandbox receipts

Tickets: [PACT-018 / MNI-78](https://linear.app/mnim/issue/MNI-78/pact-018-implement-the-shared-dispatcher-and-sandbox-receipts)

Implementation revision/PR: uncommitted local work on `master` (not pushed; no PR).

Verification environment: 20 September 2026; macOS arm64; Node.js 24.21.0; npm 11.19.0; PostgreSQL 17 in local Colima Compose.

## Result

`@pact/application` now owns `CommandDispatcher`: authenticated principals overwrite wire actor fields, commands validate against shared schemas, idempotent receipts commit with outbox events, and sandbox-only draft/counter fixtures mutate private per-account state. HTTP exposes `POST /v1/commands` and owner-scoped `GET /v1/receipts/:commandId` with `Cache-Control: no-store`. Economic handlers remain deferred.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-018 | Same ID and payload produce one mutation and the original receipt; changed payload with reused ID returns conflict | `tests/integration/dispatcher.test.ts` — “commits once…” | Pass. Replay returned the identical `COMMITTED` receipt; altered note returned `IDEMPOTENCY_CONFLICT`; sandbox draft remained a single write. |
| PACT-018 | Timed-out write reconciled through receipt lookup without re-execution or exposing another account’s result | Same file — “reconciles a timed-out write…” | Pass. Owner lookup matched the committed receipt; other account lookup returned `null`; other account dispatch with the same ID was `FORBIDDEN`; counter value stayed 3 after replay. |

Supporting verification (all passed locally): `npm run lint`, `npm run typecheck`, `npm test` (18), `npm run test:integration` (14 after smoke update), `npm run build`, `npm run db:migrate` applied `0006_sandbox_dispatcher.sql`.

## Documentation

- [Shared API contracts](../../api/contracts.md) — command gateway, sandbox actions, receipt lookup
- [Module boundaries](../../architecture/modules.md) — dispatcher ownership
- [Database operations](../../operations/database.md) — migration 0006 and receipt reconciliation
- [README](../../../README.md) — command/receipt routes

## Decisions and limitations

Canonical idempotency hash covers schema version, command ID, expected version, and action; server-derived actor identity is excluded. Sandbox draft notes are fixture state, not kingdom activation. MCP and provider adapters still need to call the same dispatcher in later tickets. Hosted CI was not run.

Post-completion audit: the cookie-authenticated command route now calls the shared origin/CSRF write guard. `tests/integration/client-sdk.test.ts` verifies a session cookie alone receives HTTP 403.

## Related tracker note

PACT-004 / MNI-64 remains an external deployment gate. Version 1.2 replaces AWS with the project single-VPS contract; deploy/restore acceptance requires VPS access, DNS, encrypted off-host backup storage, and SMTP sender credentials, but no longer blocks local credential-vault implementation.

## Handoff

Dependency-ready unassigned work after this ticket includes PACT-016 (OAuth), PACT-019 (mandates; depends on 018), PACT-021, and PACT-022. PACT-009 remains blocked on PACT-004.
