# PACT-051 rules verification acceptance

Ticket: [PACT-051 / MNI-115](https://linear.app/mnim/issue/MNI-115/pact-051-run-transaction-replay-and-adversarial-rules-tests).
Review date: 28 September 2026. Node 24.19.0, PostgreSQL 17.11, disposable local test schemas.
Revision: `e6e55cd`. All 18 prerequisites were freshly read Done; the existing assignee was retained.

## Result and acceptance decision

The Phase 1 implemented rules have reproducible R01–R06 evidence. This review consolidates the earlier [runtime](rules-runtime-batch.md), [command-boundary](game-command-fault-matrix.md), [mixed gameplay/authority](mixed-gameplay-authority.md) and [recovery progress](rules-verification-progress.md) records. Two final checks were added rather than closing from test counts alone: uncertain caller completion and explicit post-restore marked wealth. Harvest input transitions also now have boundary/replay assertions.

| Criterion | Reviewed assertions and reproducible fixture |
| --- | --- |
| R01 conservation | `resource-ledger.test.ts`: ordinary/restricted/locked journals, overflow, seven-day grants, provenance and expired-refund exclusion; `buildings.test.ts`: 50% original-category refunds; `troops.test.ts`: 80% remaining-cost refunds; `supply-settlement.test.ts`: independent funded/defaulted legs, shortage remainder by contract ID and bond transfers; `fortune.test.ts`: grants/guards excluded and wealth persists through installed work/training/bonds but not losses. The 120 seeded ledger operations and 85 connected commands check independent balances after each transition. |
| R02 time | `world-clock.test.ts`: exact due-boundary command admission, pause/resume without catch-up, fencing and transactional publication; `resource-ledger.test.ts`: all five harvest transitions at the final pre-boundary minute and exact boundary, changing only newly produced Grain; `supply-settlement.test.ts`: exactly 360 installments for six hours, no 361st, exact notice/release/end boundaries; `action-limits.test.ts`: regeneration at the exact instant and no banked capped time. `rules-runtime.test.ts` and `world-domain-order.test.ts` cover completion → production → upkeep → obligation capture → delivery/default → battle → scout → Fortune/awards in the actual handler composition. |
| R03 units | `troops.test.ts`: zero-refund Home Guard disband, guard assignment denial, unique IDs, owned/visitor capacity races and lock-bound returns; `upkeep.test.ts`: owner-group starvation at 180/240, warning 120, locks do not prevent desertion and 60 funded minutes recover hunger; `garrison-admission.test.ts` and `retirement.test.ts`: pending locked returns/default/seizure/closing; `raids.test.ts`: overlapping defenses use surviving IDs, not copies. Combat split/reorder compares 32 seeded rosters × 36 dice pairs (1,152 cases); same-owner opposite-side losses remain distinct. Mixed command tapes track all IDs and placements. |
| R04 authority | `authority-exposure.test.ts`: shared spend/reservation races, no incoming/refund netting, retained prior reservations after lowering, exact human exceptions with limit zero, one-use permits and waiting-build rechecks. `game-command-social.test.ts`: authenticated cookie/CSRF HTTP versus hash-introspected OAuth MCP signature races/retries, one bond/future exposure, exhausted-limit denial. `game-command-faults.test.ts`: confirmed PostgreSQL lock contention for revocation-first; committed-signature-first preservation; competing garrison troop-cap reservations; exact 1,300-unit host upkeep-extension budget rejects 1,299. Changed floor/grant-expiry defaults are explicit in supply settlement. |
| R05 combat | `combat.test.ts`: worked battle (7 attacker / 14 defender casualties, 144 capacity, 100 Silver + 44 Iron loot), 26 wins in all 36 die pairs, ties hold, zero-power branches, hungry/Ram effects and overflow; `raid-randomness.test.ts`: commitment/reveal rollback and once-only audit; `raids.test.ts`: no provision/charge refund on withdrawal, lock-time rejection, declaration-order overlapping resolution and retry, actual ordinary-only loot; `retirement.test.ts`: already-declared raids resolve after account deletion, including paused-world privacy erasure. |
| R06 reliability | All 28 published commands fault after gameplay writes and at post-receipt COMMIT (56 rollback checks), then commit/replay once; 19 private object kinds reject outsiders and all 28 receipts reject outsider/changed-payload replay. The 85-command tapes include 29 rollbacks. All nine tick phase positions roll back every durable table; a fresh runtime reconstructs and retries, a separate reader sees only pre-publication state, and rewards/ticks/outbox cannot duplicate. Real ledger/inference process SIGKILL fixtures cover both sides of commit and conservative provider ambiguity. Caller timeout while blocked on PostgreSQL then receipt lookup/same-ID retry produces one contact, receipt and two-Silver debit. |

Ticket acceptance 1 (all R01–R06 including overlapping raids and multi-client authority races): passed for the Phase 1 prototype profile above. Ticket acceptance 2 (no negative stock, duplicate troop/reward, partial tick or lost receipt in generated scenarios): passed by independent stock/identity models, full-table rollback/replay, journals, unique casualty IDs and once-only entitlement/tick/receipt assertions.

## Recovery evidence

`node scripts/rehearse-rules-restore.mjs` now dumps/restores a synthetic schema with all three ordinary resources, locked Silver, ordinary-plus-grant-funded installed construction, active training cost, an ordinary Spearman, a Home Guard, receipt and outbox. Before and after restore, the real `FortuneService.wealth` matches independent quarter-unit components: stock 76,800; active cost 9,600; installed 24,000; troops 43,200; total **153,600 / 2,400 = 64 marked units**. Grant-funded value and the guard contribute zero. All stock categories and exact ID/type/guard/owner/host/placement/reference rows survive; the Iron journal reconciles and replayed outbox delivery deduplicates.

This is a fresh local schema restore, not a new VPS outage/drill. The earlier encrypted single-VPS base/WAL snapshot `86734927` was booted in a network-isolated PostgreSQL 17 container on 28 September and checked journals, Home Guard placement, build/receipt and outbox replay. Its recorded observation remains in the progress report/runbook. Same-server backups do not survive server loss.

## Reproduction and checks

Use Node 24 on PATH. Run `npm run build` **before**, not concurrently with, tests that spawn children importing `dist` packages. Use a disposable `TEST_DATABASE_URL`; the restore script refuses names without `test` and drops only its generated schema. PostgreSQL-compatible `pg_dump`/`psql` must be on PATH.

- `npm run build`: passed.
- `npm run typecheck`, `npm run lint`, `npm test`: passed (130 unit tests / 47 files).
- Focused uncertain-completion test: passed; focused ledger suite with harvest transitions: 6 passed.
- Fresh restore rehearsal: passed, 64 marked units and exact placements/receipt/outbox retained.
- Final full `npm run test:integration`: 224 tests / 38 files passed after the build finished, including both new boundary cases and both actual inference process-kill cases.

Planning render/check and revision/Linear readback are recorded in the tracker follow-up below.

Planning render/check and diff check passed. Linear completion comment `36a1d2d5-2171-46a8-a50a-9ed12e98677f` records the evidence; readback confirmed Done on 28 September at 19:23 UTC.

## Scope and next work

This is an acceptance decision on the implemented transactional-rules test profile, not a proof over all possible states or a production/pilot certification. Caller timeout is an application-level abandoned wait while the actual dispatcher blocks/commits; no real socket loss was claimed. Harvest transitions use explicit week inputs; automatic season rollover, final seasonal awards and low-harvest scheduling remain PACT-069/070 work, consistent with the Phase 1 worker's documented season no-op. Live model quality, external-host costs, full UI play and browser accessibility are not certified by synthetic tests.

No production behavior, migration, dependency or deployment changed. PACT-053 stays open: PACT-048's UI-only two-player/lock/charge checks, PACT-052's permitted baseline and PACT-096's non-game reuse proof are separate gates. The next unassigned dependency-ready ticket after PACT-051 closes is PACT-052.
