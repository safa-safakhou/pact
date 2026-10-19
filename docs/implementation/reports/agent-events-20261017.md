# P1 — scoped agent events, 17 October 2026

Founder authorized the next Fleet/PACT architecture phase, with isolated local testing and server Fleet excluded. P1 is source-verified after Fleet F2 (`aba5630`) and F3 (`3b07b67`); F4 consumes the versioned feed. No runtime was installed, server contacted, accounts enrolled, real models called or operational recovery gates changed. Work was sequential without delegation. P1 is a local work-package ID, not an invented Linear issue; historical PACT-171–181 remain completed. P2/F5 remain future scope.

The additive dated product correction covers runtime/architecture/access/privacy, with affected existing acceptance annotations (PACT-021/022/055/060/082) and only those four source hashes refreshed. Historical statuses and assignments remain preserved. The separate local status register records this assignment.

## Delivered

- Inbox-owned, scoped metadata projection with strict shared contracts, owner-locked publication sequence and stable owner/event deduplication. Outbox delivery completion commits with publication, and a late lower source ID is still processed.
- Kingdom-owned explicit audience/source selector and retained-source authorization. New transition emitters record their existing transaction game time; historical missing time is reported as uncovered rather than guessed.
- Shared authenticated API/MCP read service: `GET /v1/agent-events` and `pact_agent_events_v1`, default-off exposure/projection, existing `world:read`, active owner checks, current grant introspection and opaque visibility-bound cursors. Capabilities disclose source types, incomplete-world coverage, polling and no parallel reasoning.
- Twenty-card default, fifty-card maximum and32,768 serialized-byte ceiling, whole-card cursor advancement, explicit retention/deletion resync and safe resume tokens.
- Seven-real-day maximum/source-aligned metadata retention, privacy export/deletion/pruning independent of the exposure flag. Account erasure covers previous world namespaces. No peer bodies or hidden world details are copied.
- Independent notification-worker projection, including actual no-SMTP worker startup. No inference/run/provider port is invoked by this feed. Existing enabled notification behavior and the exclusive write lease remain intact.

[API, source coverage and operations](../../api/agent-events.md) include flags, omissions, cursor semantics and rollback. Migration0071 is additive and enrolls nobody. No game rules, resources, approvals or live schedules changed.

## Verification

Node24.12.0; dedicated loopback PostgreSQL17 fixture at5438/pact_test with per-suite isolated schemas. No installed Fleet/database credentials were used by tests. The new suite honors the repository's `TEST_DATABASE_URL` and standard5432/pact_test default, accepting only a loopback `pact_test` database.

For this machine's separate fixture: `docker run -d --name pact-phase2-test-db -e POSTGRES_USER=pact -e POSTGRES_PASSWORD=pact -e POSTGRES_DB=pact_test -p 127.0.0.1:5438:5432 postgres:17-alpine`. Build first (`npm run build`), then set `TEST_DATABASE_URL=postgres://pact:pact@127.0.0.1:5438/pact_test` for the commands below. The credentials are synthetic test-only values. If the owned fixture already exists, use `docker start pact-phase2-test-db`; stop that fixture after checks. Installed Fleet uses a different database and was never a test target.

| Command | Result |
| --- | --- |
| `npm test -- --maxWorkers=2` |386 passed /123 files |
| `npm run test:integration -- --maxWorkers=2` |447 passed,1 existing skip /64 files |
| `npm run build` | passed all packages/workers/clients; existing web/Telegram chunk-size warnings |
| `npm run typecheck` | passed |
| `npm run lint` | passed type/style, contracts, build-order and boundary checks; warnings retained |
| `python3 docs/implementation/backlog.py render` / `check` |181 unique tickets, acyclic dependencies,37 criteria and matching source snapshots |

Eleven focused database/HTTP/shared-operation/process cases cover defaults/caps/actual byte splitting, cross-account/session cursor denial, delivery dedup/restart, two-transaction late commit, rollback/expired lease retry, retention/source deletion/resume, active-owner denial, current grant revocation, quiet metadata, actual sources/deadlines, all-world account erasure and the compiled no-SMTP worker. The unit contract checks reject caller-supplied identity and unbounded/private metadata.

Initial red tests found absent contract/service modules; initial integration setup needed built workspace packages. The first full integration run found the expected new migration-list fixture plus two missing compiled-worker process checks. After updating the fixture and performing the full build, the final full run above passed. The retained skip is the pre-existing real-model route in `script-baseline.test.ts`; no model experiment was started. Author review (repository forbids delegation) corrected retention across old namespaces and kept reusable inbox account authorization behind an injected port. No independent-review or hosted-CI claim is made.

## Practical limits and next work

This proves deterministic source/plumbing behavior, not real-provider strategy, live latency, hosted-client certification or production-scale feed throughput. Reads revalidate retained owner history to enforce deletion; large-history query cost remains part of release/load qualification. Native push delivery is not claimed. Invitation-only contacts, unsupported event types, absent/deleted sources and historical transitions missing authoritative time are explicitly uncovered.

Next dependency-ready package in this assignment is Fleet F4; the following architecture phase is PACT P2 then Fleet F5. Installation and any concrete new run remain separately scoped. Original local/server release pointers, histories, pending receipts and unknown allocations remain preserved.
