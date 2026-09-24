# Game tools integration — progress record

Ticket: [PACT-049 / MNI-113](https://linear.app/mnim/issue/MNI-113/pact-049-expose-complete-game-tools-to-every-envoy-route) — **in progress**, not complete.

Implementation revisions: `7eccf06`, `75224bf`, `d1457ed`, `cdf7c89`, `804198c`, and the run tool-admission increment containing this report. Verification: 24 Sep 2026, Node 24 and local PostgreSQL 17.

## Result

The dependency graph was corrected: PACT-049's shared command/API work precedes PACT-048's UI acceptance. No scope or acceptance wording changed. Authenticated world and scout/raid report reads are shared by HTTP, SDK, and MCP. Reports remain separate from convenience kingdom summaries and are authorized by the scout/raid modules. An MCP grant lacking `game:act` can no longer list or invoke command tools; `world:read` alone permits bounded view and report reads. The dispatcher now accepts social contact, message, transfer, training queue/cancel, human disband, construction queue/cancel, versioned supply offer/counter/sign/withdraw/notice/refuse/release, scout start/share, garrison offer/sign/withdraw/exit/release/seize, and raid declare/nominate/accept/withdraw in the world-clock admission transaction, with server-derived identity, a command receipt, domain outbox effects, and replay protection. MCP `run.open` creates a 15-minute session-bound write lease, checked inside each agent game command; `game:act` alone is not sufficient. Agent messages and nonbinding offers work under the lease and shared limits; transfers/training/construction/scouting/signatures and raid contributions require mandate authority. Contract-breaking agent actions additionally check `supply.break` or `garrison.break` in that transaction. Human construction and garrison seizure get exact one-use permits; cancellation and raid nomination/withdrawal are human-only. Supply/garrison signature receipts report the caller's own bond debit, and raid commitment receipts report the caller's Grain provision debit. The API and rules worker share the existing single-VPS raid-seed secret.

## Acceptance progress

| Acceptance criterion | Current evidence | Status |
| --- | --- | --- |
| Equivalent game commands/receipts from web, adapter, and MCP | `tests/integration/game-command-social.test.ts` exercises supply, scout, garrison, and raid command admission, replay, ownership denial, and Grain-charge receipt; MCP and SDK tests cover scoped view/report reads, command admission, and `run.open` separately. A single recorded cross-route command scenario is absent. | Incomplete |
| Malicious counterpart text cannot change identity/scope/model/mandate and no hidden-state summary | The command test sends a hostile-looking message while forging actor identity; sender remains the authenticated kingdom. `tests/integration/world-views.test.ts` checks that another account's balances, buildings, terms, and account ID are absent. Model connection/mandate manipulation across all adapters is not yet exercised. | Incomplete |
| Generated SDK, model adapter, and MCP use product-scoped contracts without human privileges | Additive Zod/JSON-Schema actions and SDK preparation share one envelope; MCP token scopes are checked at listing and call, and dispatch rechecks `game:act`. Model-adapter game tool execution and full provider fixture remain absent. | Incomplete |

## Run tool-admission increment

`RunService` now hands router-validated provider calls to an injected executor with the server-owned run identity and provider request ID. A configured tool response without an executor fails the run instead of disappearing. Non-quota provider/tool errors fail even if calls remain. `assertRunWriteLease` checks the exact active run holder and owning account within the caller's transaction; an MCP holder or stopped run cannot pass. The fixture integration test covers validated call delivery, account isolation, MCP/run lease separation, stopped-run denial, and fail-closed missing-executor behavior. This is an interface and safety increment only: the production inference worker has no game tool registry/executor and does not yet execute model-produced PACT commands. Durable result/receipt handoff, bounded context, and the recorded cross-route scenario are still required before PACT-049 can be Done.

## Checks and documentation

Local Node 24 `npm run build`, `npm run typecheck`, `npm test` (107 tests), `npm run test:integration` (134 tests against PostgreSQL 17), and `npm run lint` passed after report-read integration. The domain integration fixtures recheck scout owner/share and raid participant/public separation through `GameReportReader`; HTTP/MCP/SDK tests verify scoped adapter behavior. These checks do not establish hosted CI, deployment, client certification, or a player pilot. Updated [MCP API](../../api/mcp.md), [client SDK](../../api/client-sdk.md), [raid module](../../architecture/raids.md), [world views](../../architecture/world-views.md), [social service](../../architecture/social.md), [troop training](../../architecture/troop-training.md), [building queues](../../architecture/building-queues.md), and [module boundaries](../../architecture/modules.md).

## Remaining work

For the latest run-tool increment, Node 24 `npm run build`, `npm run typecheck`, `npm test` (107 tests), `npm run test:integration` (137 PostgreSQL integration tests), targeted Biome, `npm run check:boundaries`, backlog render/check, and `git diff --check` passed. Full `npm run lint` remains red because the previously committed `tests/integration/game-command-social.test.ts` formatting does not match Biome; the two files edited for this increment pass targeted Biome. The run API documentation now states the injected executor and lease boundary. No real-provider or hosted scenario was exercised.

Wire richer receipts, approvals, bounded Envoy context, and model-provider execution. Add a single cross-route command fixture and more adversarial tests. PACT-048 remains dependent on this ticket and must not be marked Done from the current setup UI. Single-VPS MVP only; no native store, paid infrastructure, hosted CI, deployment, or real player pilot is claimed.
