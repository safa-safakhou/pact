# Foundation batch

Tickets: [PACT-001 / MNI-60](https://linear.app/mnim/issue/MNI-60), [PACT-082 / MNI-61](https://linear.app/mnim/issue/MNI-61), [PACT-002 / MNI-62](https://linear.app/mnim/issue/MNI-62), [PACT-003 / MNI-63](https://linear.app/mnim/issue/MNI-63)

Implementation revision/PR: this foundation commit, based on `626802c53a4dd246fce4c799f12a1614e1889689`; no PR.

Verification environment: 20 September 2026; macOS arm64; Node.js 24.21.0; npm 11.19.0; PostgreSQL 17.11 in the local Compose environment.

## Result

The repository now has a locked TypeScript workspace, React web shell, Fastify API, PostgreSQL migrations, and separately runnable rules, inference, notification, and channel workers. The implementation establishes product-neutral platform boundaries, PACT domain ownership, shared wire schemas, transaction infrastructure, recoverable leases, and durable outbox idempotency. No provider, account, gameplay, native, or Telegram feature is represented as complete.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-001 | Fresh checkout starts web/API/database without provider credentials | `npm ci`; `npm run db:up`; `npm run db:migrate`; live `npm run dev:api`; live `npm run dev:web`; `curl /health`; `curl /ready` | Pass. PostgreSQL became healthy, both migrations applied, API returned `ok`/`ready`, and Vite served the PACT page. No provider credentials were used. |
| PACT-001 | CI builds every process and runs migrations plus API/database smoke | `npm run lint`; `npm run typecheck`; `npm run build`; `npm test`; `npm run test:integration`; `.github/workflows/ci.yml` | Pass locally: all packages/processes and web built; 12 unit tests and 4 integration/smoke tests passed. Hosted GitHub Actions has not run because this local commit has not been pushed. |
| PACT-082 | Forbidden platform-to-PACT import fails CI; exports are scoped | `npm run check:boundaries`; package manifests; `tests/fixtures/forbidden-platform/import.ts` | Pass. Real tree accepted; the deliberately forbidden import was rejected. Public package exports are explicit and platform types carry product scope. |
| PACT-082 | Atomic stock/authority unit-of-work fixture with outbox effect | `packages/platform/src/unit-of-work.test.ts` | Pass, 2/2. Successful operation grouped stock, reservation, receipt, and outbox; failure committed nothing. Delivery remained an outbox effect. |
| PACT-002 | Web/MCP/provider validators agree | `packages/contracts/src/schemas.test.ts` | Pass. The same valid command passed all three validators; every malformed fixture failed all three. |
| PACT-002 | Reject dangerous and human-only tool shapes | Five negative contract fixtures plus strict generated JSON Schema | Pass. Code execution, actor impersonation fields, database query, credential read, and account deletion were rejected. HTTP and MCP reference the same schema object. |
| PACT-003 | Exclusive job lease and abandoned-lease recovery | `tests/integration/persistence.test.ts` against PostgreSQL 17 | Pass. A second worker could not acquire a live lease; after expiry it recovered the same job with incremented attempt count. |
| PACT-003 | Atomic receipt/outbox, restart durability, duplicate handling | `tests/integration/persistence.test.ts` against isolated migrated schema | Pass. Forced rollback left neither row. Successful rows survived pool restart. Consumer leases rejected concurrent/finished duplicates and support recovery after expiry. |

Final verification commands all passed: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` (12 tests), `npm run test:integration` (4 tests), and an idempotent `npm run db:migrate` returning “Database is current.”

## Documentation

- [Repository setup](../../../README.md)
- [Module and transaction boundaries](../../architecture/modules.md)
- [Shared API contracts](../../api/contracts.md)
- [Database migration and recovery](../../operations/database.md)
- [Native boundary](../../../apps/native/README.md) and [Telegram boundary](../../../apps/telegram/README.md)

## Decisions and limitations

The workspace uses npm workspaces and a committed npm lockfile. Zod owns TypeScript/runtime/JSON Schema contracts. PostgreSQL migrations are ordered SQL executed under an advisory lock. Transactions use stable row-lock order and bounded serialization/deadlock retries. Job and outbox leases are recoverable; delivered outbox claims are durable per consumer.

The machine initially lacked the required runtime, so Node 24 was installed alongside the existing Node version and the existing Colima environment was started for verification. The project pins Node/npm independently of that machine setup.

Hosted CI, deployment, backup restore, security review, and real-provider certification were not run and are not claimed.

## Handoff

PACT-004 and PACT-005 become dependency-ready after this batch. They can proceed as separate environment and telemetry assignments with one owner for shared CI/configuration edits. Before either starts, reconcile Linear and the local backlog and build from this committed foundation.
