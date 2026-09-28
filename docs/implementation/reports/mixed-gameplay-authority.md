# PACT-051 connected gameplay and agent authority

Ticket: [PACT-051 / MNI-115](https://linear.app/mnim/issue/MNI-115/pact-051-run-transaction-replay-and-adversarial-rules-tests), In Progress.
Implementation revision: `5a748a2`.
Verification: 28 September 2026, local Node 24.19.0 / PostgreSQL 17.11, disposable test schemas.

## Result

`tests/integration/game-command-faults.test.ts` now includes three seeded connected gameplay tapes and three agent garrison cases. The harness admits agents using the real `RunService.assertAgentWriteLease`; synthetic MCP leases do not call a provider. No production code, schemas, dependencies, UI or deployment changed.

## Acceptance evidence (partial ticket scope)

- R01/R03: seeds `0x51a17e`, `0xc0ffee`, `0xdecaf` produce 29, 29 and 27 committed commands respectively (85 total). Training and construction payments/cancellations interleave with transfers; lending leads to seizure, explicit raid selection including the seized IDs, withdrawal, another lending contract with mutual release or compensated exit, and disband. Countered supply terms activate and receive notice. Every step compares all kingdoms' ordinary/restricted/locked balances and every troop ID/type/guard/owner/host/placement/reference to an independent mutable model. Effects use explicit rulebook BigInt deltas, not receipts or movement-derived expectations; receipts supply generated contract IDs only. Journal reconciliation and eight-guard checks are additional invariants.
- R06: each of the 85 commits replays its identical receipt with every durable table unchanged. Every third command first fails after the handler (29 rollback checks); the same command then commits. Former-owner disband and attacking-unit disband attempts fail without mutation in each tape. The existing 28-action matrix still covers both handler and post-receipt COMMIT failures.
- R04: revocation holds the account lock; bounded polling of PostgreSQL blocking PIDs confirms the first agent signature is actually queued. After revocation commits, signing is forbidden with no signature, exposure or receipt.
- R04: when the first signature commits before mandate lowering/revocation, its prior reservation remains valid. Replaying the signature does not reserve twice; the human counterparty activates once, consuming the existing Iron bond reservation into spent authority. New agent signatures fail. Human exit closes the obligation normally.
- R04: two different offers race for a two-troop agent cap; exactly one signature succeeds and one is forbidden, with no stock debit. The host needs exactly 1,300 internal Grain for two Spearmen over one hour plus five-minute defensive extension; 1,299 fails atomically. Activation retains one lender troop reservation and one host future-upkeep reservation; replay changes no table.

These are bounded reproducible tapes, not exhaustive random permutations. Randomized counts/transfers and exit branches are seeded; synthetic UUIDs are fresh each run. Game time remains fixed so unrelated active matrix fixtures do not settle. Supply installments, training completion, combat, charge regeneration and defensive return locks remain in the separate clock/domain/runtime suites; no elapsed-time behavior is inferred from these tapes. Agent cases use authenticated application principals, not a new HTTP consent or live external-host certification. The signature-first case is a committed ordering, not a second simultaneous transaction race.

## Checks

Use Node 24 on PATH and the disposable PostgreSQL test database, as described in [verification instructions](../../architecture/rules-verification.md).

- Focused new gameplay cases: 3 passed; focused authority cases: 3 passed.
- Full command-fault file before final assertion strengthening: 34 passed. Final assertions also run in the full regression below.
- `npm run build`, `npm run typecheck`, `npm run lint`: passed.
- `npm test`: 130 tests / 47 files passed.
- Initial full integration run: 221 passed, one existing process-kill test failed when its child exited before the game command committed. Build and tests were running concurrently; cause was not established. The isolated recovery rerun and final integration result are recorded below; do not treat the initial run as a pass.
- `npm run test:integration -- tests/integration/run-process-death.test.ts`: both recovery cases passed in isolation.
- Final `npm run test:integration`, after the build finished: 222 tests / 38 files passed, including all 34 command-fault cases with the final strengthened assertions.
- Planning render/check and `git diff --check`: passed.

## Handoff

The [verification matrix](../../architecture/rules-verification.md) and [current handoff](../HANDOFF.md) now distinguish this coverage from the previous per-command boundary matrix. Consolidated R01–R06 acceptance review remains before closing PACT-051; there is no new credential or infrastructure blocker. PACT-048 retains its UI-only two-player and lock/charge-limit observations. PACT-052 and PACT-096 are still dependency-blocked on PACT-051, and PACT-053 remains the Rules gate.

Deployment remains `alpha-20260928-4`; no provider call, new physical restore, hosted CI or browser playtest ran in this batch.

Linear progress comment `6b92ed91-9b75-464d-ac96-3f594f65fd4f` records this revision, evidence and remaining scope. Readback retained In Progress and the existing Mohammad Safakhou assignment.
