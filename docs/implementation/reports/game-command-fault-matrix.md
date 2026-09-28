# PACT-051 gameplay command fault/replay matrix

Ticket: [PACT-051 / MNI-115](https://linear.app/mnim/issue/MNI-115/pact-051-run-transaction-replay-and-adversarial-rules-tests), still In Progress.
Implementation revision: `c96b293`.
Verified 28 September 2026 locally with Node 24.19.0 and PostgreSQL 17.11. All 18 dependencies were freshly read Done in Linear; the existing assignment was preserved.

## Result

The new integration matrix derives its cases directly from all 28 published `GameActionSchema` kinds. It uses the real `GameCommandHandler`, `CommandDispatcher`, world admission, and domain services. The existing rules-runtime composition supplies the ledger, construction, troops, scouting, and raids; social/supply/garrison use the same production service classes and authority ports. There is no production fault switch or new migration.

Each case creates three synthetic kingdoms with eight Home Guards and ten ordinary Spearmen, Hall III, unexpired founding allowances, ordinary funds, charges, and synthetic human sessions. Contacts, offers, signatures, construction, training, and raid nominations used as prerequisites go through the shared dispatcher. A completed scout-report prerequisite uses the real completion service and an explicit synthetic clock advance, not a claim of elapsed-time play or full tick settlement. The independent fixture clock is minute-aligned; heartbeat is refreshed between cases because worker liveness is not this matrix's subject.

## Acceptance evidence (partial ticket scope)

| Criterion | Actual observation |
| --- | --- |
| R06 command atomicity | All 28 actions first fail after the real handler returns, before receipt insertion. All then fail in a test-only PostgreSQL deferred trigger at COMMIT, after the receipt is visible inside the transaction. Both attempts restore every durable table and leave no receipt. This is 56 fault/rollback checks. |
| R06 retry/replay | Each clean retry commits; receipt lookup and same-ID retry return the identical receipt. Changed-payload retry returns `IDEMPOTENCY_CONFLICT`. Every table stays unchanged on replay/denial, including outbox, movement, limit, charge, signature, and exact-permit rows. |
| R01 conservation | Exact balances for every kingdom/resource/category match independent rulebook arithmetic after each target command: contact fee; two-party transfer; training payment and 80% fractional refund; restricted construction payment and 50% original-category refund; both supply/garrison bonds; scout fee; 21-Grain raid provisions; default compensation and mutual-release bond return. Unrelated kingdoms cannot change. All balances also reconcile separately to the movement journal and remain nonnegative. |
| R03 identity/placement | Every troop ID, type, Home Guard flag, and owner matches pre-command identity, except the exact disbanded ID or the two existing visiting IDs transferred by seizure. No new IDs appear. Current placement references resolve to the correct active scout/garrison/raid commitment; all eight guards remain per fixture kingdom. |
| R04/R06 cross-account access | Forged legitimate-owner envelopes fail under another principal for all 19 owner/party-bound action kinds, with no durable change. After all 28 commits, outsider receipt lookup returns null and replay is forbidden. Public kingdom targeting remains legal; it is not misclassified as private-object access. |

The matrix tests authenticated-human principal admission at the application layer. Existing HTTP/MCP race and approval fixtures remain the agent/authentication evidence. It does not claim every agent mandate branch, every intermediate statement inside a handler, arbitrary command permutations, or a new browser/client certification. PostgreSQL sequence values may have rollback gaps; the comparison covers every base table except the test-only fault-control table, not sequence counters.

The independent cancellation model initially exposed a fixture mismatch: the bootstrapped epoch-based world clock was paired with grants initialized at zero. The fixture now uses an explicit valid synthetic game clock. No rulebook value or production behavior was changed to make a test pass.

A repeat full regression run exposed an existing process-death fixture's fixed 150 ms wait: its first replacement found no eligible job, and the subsequent case then encountered that leftover job. `run-process-death.test.ts` now uses bounded polling of the specific persisted job's database-clock lease/availability deadline, without rewriting job state. Both cases additionally verify the reclaimed run identity and successful owner-fenced job completion. The first full run passed 216 tests; the repeat failed two recovery cases; the corrected fixture and final regression run passed. This is test-timing stabilization, not a changed production recovery policy.

## Checks

On this host, prepend `/Users/safa.safakhou/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` to `PATH`; use installed Node 24 on other hosts. Integration checks target the disposable `pact_test` database only.

- `npm run test:integration -- tests/integration/game-command-faults.test.ts` — all 28 cases passed.
- `npm run test:integration -- tests/integration/run-process-death.test.ts` — both actual process-kill cases passed after the database-deadline wait correction.
- `npm run build` — passed for all workspaces.
- `npm run typecheck` — passed.
- `npm run lint` — passed, including architecture boundaries and package build order.
- `npm test` — 130 tests passed in 47 files.
- `npm run test:integration` — 216 tests passed in 38 files.
- Planning render/check and `git diff --check` — passed.

## Documentation and handoff

[Verification instructions/matrix](../../architecture/rules-verification.md) and [handoff](../HANDOFF.md) now identify this coverage separately from the existing combined tick and generated combat fixtures. No public API, player UI, dependency, infrastructure, live provider, or VPS data changed; deployment remains `alpha-20260928-4`. No hosted CI or new physical restore was run.

PACT-051 remains In Progress pending broader mixed command/value/placement sequences, agent-specific mandate/revocation interleavings, and the consolidated R01–R06 acceptance review. PACT-048 still needs the UI-only two-player founding/play walkthrough and meaningful lock/charge-limit checks. PACT-052 and PACT-096 wait on PACT-051; PACT-053 is still the Rules gate. This matrix narrows the reliability gap without marking incomplete tickets Done.

Linear progress comment `388b9922-55f0-47e8-b652-6189feef728f` records the revision, passing checks, and remaining scope. Assignment/status were read back unchanged at 18:51 UTC; the mapping timestamp covers PACT-051 and its 18 dependency readbacks, not a fresh 98-issue audit.
