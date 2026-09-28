# PACT-096 — non-game platform reuse

Ticket: [PACT-096 / MNI-117](https://linear.app/mnim/issue/MNI-117)
Implementation revision: accompanying commit `PACT-096 prove database-free platform reuse and freeze published contracts` (uncommitted when this report was prepared).
Verification: 28 September 2026; local Node 24.19.0, PostgreSQL 17.11 for the separate game regressions. No deployment, provider API calls or new infrastructure.

## Result and acceptance

| Acceptance | Actual evidence |
| --- | --- |
| Independently compile/run a bounded action/approval cycle with no kingdoms or production services | `npm run check:non-game` PASS: isolated tsconfig builds a notice-board app through public identity/model/runtime/approval/notification exports, with no domain/database types. Emitted JavaScript runs with database configuration unset, and a transitive import hook rejects forbidden dependencies. The cycle issues/authenticates a synthetic identity, starts one bounded fake-provider call, stores the exact proposal, commits only after human approval, publishes a deduplicated notice and revokes the credential. A deliberate `@pact/application` import fails. |
| Credentials/events isolated across products | Unit fixture uses the same account ID, shared in-memory storage objects and synthetic crypto keys in two product scopes. Cross-product tokens, private credential reads, approvals, notifications and foreign run use fail; independent product leases coexist; revoking one token preserves the other product. PASS. |
| Exact authority, bounds and failures | Agent approval/start denied; owner and exact terms checked; replay produces one effect/receipt/event; changed command-ID reuse denied; expiry/deadline and single in-flight request enforced; failed/unknown calls retain reservation without automatic retry; stopped results cannot become proposals; post-effect injected failure restores the document and exact retry succeeds. Notifications trigger zero inference. Seven reuse tests PASS. |
| Integrated PACT stock-plus-authority atomicity still holds | Full PostgreSQL integration suite **225 tests / 39 files PASS**, including authority exposure, integrated supply/construction approval, shared-command fault rollback/replay and scope tests. Portable extraction changes only shared hashing/default/limit helpers in those production adapters; no alternate game path or schema migration. |
| CI rejects prohibited imports/unversioned breaking changes | Expanded direction guard rejects domain/kingdom/world/ledger/application imports from existing reusable roots; existing forbidden fixture still fails. Independent transitive closure guard runs after build in CI. Fourteen published v1 schema fingerprints pass; removed/narrowed/changed schema unit checks fail as expected, while a separate versioned export is allowed. Guards are configured in CI; no hosted CI run was observed. |

## Checks performed

- `npm run build`: pass (all packages/processes/web/native/Telegram build/type checks).
- `npm run typecheck`: pass, including source mappings for new portable exports so the global check does not depend on prior built declarations.
- `npm run lint`: pass, including boundaries, deliberate forbidden fixture, build order and fourteen published-schema checks.
- `npm run check:non-game`: pass; separate compile and runtime cycle, no database/provider/deployment service.
- `npm test`: **147 tests / 50 files**, including seven reuse tests and one schema-evolution guard test.
- `npm run test:integration`: **225 tests / 39 files**, all pass after rebuilding production package output.
- Planning render/check and diff checks recorded with final tracker synchronization.

## Documentation and boundaries

[Portable module guide](../../architecture/portable-platform.md) records public entry points, injected ports, independent commands, adapter obligations and contract evolution. The fixture is deliberately test-only and non-durable; it is not a new user-facing application or production authentication replacement. Root exports retain existing PostgreSQL services. In-memory transaction rollback covers the synthetic document and receipt; PACT's stronger durable transaction/outbox semantics remain verified separately.

No secrets, personal data, game economy changes, arbitrary plugin system, database migrations or infrastructure purchases were introduced. The lockfile adds only the two declared identity dependencies, preserving existing platform-specific metadata. Existing v1 hashes are not refreshed by the verification command.

## Handoff

All seven dependencies were freshly read Done before claiming MNI-117. With this ticket complete, PACT-048's UI-only observations and PACT-052's matched real-model comparison remain open before the PACT-053 gate. Do not close that gate from reuse evidence alone. PACT's current VPS deployment is unchanged.
