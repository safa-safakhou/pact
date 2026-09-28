# PACT-051 combined rules-runtime verification batch

Ticket: [PACT-051 / MNI-115](https://linear.app/mnim/issue/MNI-115/pact-051-run-transaction-replay-and-adversarial-rules-tests), still In Progress.
Implementation revision: `ae5c534`.
Verified 28 September 2026 with Node 24.19.0 and PostgreSQL 17.11 in a disposable local database. All 18 dependencies were rechecked Done in Linear.

## Result

The rules worker and integration fixture now use the same `createRulesRuntime` composition in `workers/rules/src/runtime.ts`. Polling, environment validation, and lease handling remain in `main.ts`; the handler order and week-one behavior are unchanged. The extracted composition has no startup side effects and accepts explicit scope and raid entropy.

The combined fixture places three synthetic kingdoms at the minute before an hourly boundary. A Farm II completion, waiting Mine II start, training completion, production, upkeep, supply capture/delivery, insufficient-stock default with bond compensation, locked raid, completed scout, Fortune sample, and cosmetic achievements occur in one clock transaction. It wraps the actual handlers, not replacement economy/combat implementations. The trace includes nine clock phase positions; `season_rollover` remains a no-op until PACT-069.

Faults after each position roll back every durable table to its pre-tick rows. Each attempt uses a fresh runtime, so a stale in-memory obligation capture cannot substitute for reconstruction after restart. Before publication a separate database connection still sees only the old state. Clean retry publishes exactly one tick and resolution event; immediate replay leaves all tables unchanged. Final ordinary/restricted/locked balances reconcile independently with movement sums. Synthetic setup inserts founded rosters and already-active supply contracts; this is not a live elapsed-time playthrough or signature-admission proof for those setup rows.

## Acceptance evidence (partial ticket scope)

| Criterion | Fixture | Observed result |
| --- | --- | --- |
| R01/R02/R06 integrated ordering, conservation, and rollback | `tests/integration/rules-runtime.test.ts` | Farm II's rate applies before production; production funds that minute's delivery; outgoing obligations capture before incoming credit; partial default preserves delivery and transfers the bond; battle precedes scout sampling; Fortune samples the resulting state. Nine phase faults leave no durable effects, then one retry commits. |
| R03/R05 detachment split invariance | `packages/domain/src/combat.test.ts`, seed `0x51de7ac` | 32 generated mixed-owner/type/hunger rosters × all 36 die pairs = 1,152 comparisons. Splitting/reordering leaves the full result identical; lost IDs are unique and belong to the stated owner/side; loot/overflow respect stock and capacity. |
| R04/R06 authenticated cross-client race | `game-command-social.test.ts`, “authenticated HTTP/MCP signatures” | Cookie/Origin/CSRF web and hash-introspected OAuth MCP signatures race with duplicate requests. One active contract, two owner-derived signatures/receipts, one 600-unit bond debit, and one authority commitment survive. Its 1,200-unit exposure becomes 600 spent + 600 reserved. A later signature cannot exceed the mandate. Invalid CSRF/bearer and revoked OAuth are rejected. |

The HTTP/MCP fixture seeds synthetic credentials, then exercises the actual HTTP authentication and shared dispatcher; it does not repeat OAuth consent or use a live external client. Its first draft correctly failed the rulebook's bond-to-flow cap; the fixture was corrected to a one-Silver bond, without changing game rules. Typecheck also caught and removed an unsupported signature field.

## Checks

On this host, prepend `/Users/safa.safakhou/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` to `PATH` for these commands; the system Node 20 is not the supported runtime. Other hosts should use their own installed Node 24. Integration tests target the disposable `pact_test` database, not the VPS.

- `npm run build` — passed, all workspaces.
- `npm run typecheck` — passed.
- `npm run lint` — passed, including module boundaries and build order.
- `npm test` — 130 tests passed in 47 files.
- `npm run test:integration` — 188 tests passed in 37 files on PostgreSQL 17.11.
- Focused combat, runtime, and HTTP/MCP race fixtures — passed before the full suite.
- Planning render/check and `git diff --check` — passed in the documentation follow-up.

## Documentation and handoff

[Verification matrix](../../architecture/rules-verification.md) maps these fixtures and remaining gaps; [current handoff](../HANDOFF.md) points to this batch. No schema migration, public tool/API change, UI change, provider call, paid service, deployment, or new VPS restore was needed. The live release remains `alpha-20260928-4`; this batch's composition refactor is local/committed, not deployed. Hosted CI was not run.

Linear progress comment `a90206f4-08cd-4481-b29a-f3efaf22d95a` records this batch; the stale “no execution evidence” issue-description text was corrected without changing scope or status. Public `/pact/health` returned `{"status":"ok"}` at 15:55 UTC; that health response alone is not a new gameplay or clock certification.

PACT-051 still needs generated mixed-command/value/placement sequences and broad command-specific failure/revocation coverage. This batch does not certify every durable transition or close R01–R06. PACT-048's UI-only two-player walkthrough and lock/charge-limit checks are also open. PACT-052/096 continue waiting on PACT-051; PACT-053 remains the acceptance gate. No ticket was marked Done from these partial results.
