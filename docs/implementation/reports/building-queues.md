# Building upgrades and builder queues

Ticket: [PACT-032 / MNI-96](https://linear.app/mnim/issue/MNI-96/pact-032-implement-building-upgrades-and-the-two-builder-queues)

Implementation revision/PR: `4e2e11b` plus final verification edits on local `master`; no PR or push.

Verification environment: 23 September 2026; macOS arm64; Node.js 24; PostgreSQL 17 test database.

## Result

`@pact/kingdom` now owns exact target-level prerequisites/costs/deadlines and two builder queues with one active and one waiting instruction per slot. The engine retains ledger cost provenance, installs completed levels once, reconfigures production/storage, and uses transaction-bound authority callbacks on queue, start, waiting cancellation, and active cancellation. The rules worker processes completion and waiting retries after grant expiry and before production. No client-facing build command is exposed yet.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Hall and dependent upgrades reach every level without illegal bypass; no building occupies both slots | `packages/kingdom/src/building-rules.test.ts`, `tests/integration/buildings.test.ts`, `0020_building_queues.sql` | Pure rules reject skipped levels and unmet Hall/Farm/Barracks/Storehouse dependencies. PostgreSQL executes all 35 legal upgrades through level VI. Unique live-building and per-slot indexes reject double occupancy. |
| Waiting starts in slot order only when funded and authorized | `tests/integration/buildings.test.ts` | Two active builds complete first; two waiting instructions are rechecked in slot order. Missing funds or denied authority leaves them waiting, and later funding/authorization starts them once. |
| Completion/cancellation retries do not duplicate gains, refunds, or spend | Same integration test and ledger provenance | Replayed completion leaves one installed level and one completion event. Waiting cancellation releases its authority callback without stock movement. Active cancellation returns the exact 50% original-category Iron/Silver once; a duplicate returns the same canceled instruction. An injected completion failure rolls back level, provenance, and instruction state. |

Supporting checks: `npm run build`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run lint`, backlog render/check, and `git diff --check` after final edits. No hosted CI, VPS deployment, or external approval certification is claimed.

## Documentation

[Building queue contract](../../architecture/building-queues.md) explains instruction state, tick order, authority port, migration, and deployment boundary. [Module boundaries](../../architecture/modules.md) names the owner.

## Decisions and limitations

The authority interface is deliberately injected and transaction-bound; integration tests provide a deterministic authorized/denied port. The production worker uses a fail-closed port, so it may complete already-active work but cannot authorize a waiting start until the real adapter is composed. Exact human permit and agent mandate/reservation persistence, shared command receipts, and API/MCP exposure are the later economic-integration scope; do not interpret this ticket as a playable build UI. Restricted grants remain non-tradeable and cancellations retain category provenance.

## Handoff

PACT-039 must compose the real authority adapter with receipts and command admission before client access to the build queue. PACT-033 may build troop training against the same world-tick/ledger conventions. Apply migration `0020_building_queues.sql` before running the updated rules worker on the single VPS.
