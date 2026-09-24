# Game tools integration — progress record

Ticket: [PACT-049 / MNI-113](https://linear.app/mnim/issue/MNI-113/pact-049-expose-complete-game-tools-to-every-envoy-route) — **in progress**, not complete.

Implementation revisions: `7eccf06`, `75224bf`, plus this follow-up commit. Verification: 24 Sep 2026, Node 24 and local PostgreSQL 17.

## Result

The dependency graph was corrected: PACT-049's shared command/API work precedes PACT-048's UI acceptance. No scope or acceptance wording changed. The first authenticated world-view read is shared by HTTP, SDK, and MCP. An MCP grant lacking `game:act` can no longer list or invoke command tools; `world:read` alone permits only the bounded view tool. The dispatcher now accepts social contact, message, transfer, training queue/cancel, human disband, construction queue/cancel, versioned supply offer/counter/sign/withdraw/notice/refuse/release, scout start/share, garrison offer/sign/withdraw/exit/release/seize, and raid declare/nominate/accept/withdraw in the world-clock admission transaction, with server-derived identity, a command receipt, domain outbox effects, and replay protection. MCP `run.open` creates a 15-minute session-bound write lease, checked inside each agent game command; `game:act` alone is not sufficient. Agent messages and nonbinding offers work under the lease and shared limits; transfers/training/construction/scouting/signatures and raid contributions require mandate authority. Contract-breaking agent actions additionally check `supply.break` or `garrison.break` in that transaction. Human construction and garrison seizure get exact one-use permits; cancellation and raid nomination/withdrawal are human-only. Supply/garrison signature receipts report the caller's own bond debit, and raid commitment receipts report the caller's Grain provision debit. The API and rules worker now share the existing single-VPS raid-seed secret.

## Acceptance progress

| Acceptance criterion | Current evidence | Status |
| --- | --- | --- |
| Equivalent game commands/receipts from web, adapter, and MCP | `tests/integration/game-command-social.test.ts` exercises supply, scout, garrison, and raid command admission, replay, ownership denial, and Grain-charge receipt; MCP and SDK tests cover scoped read, command admission, and `run.open` separately. A single recorded cross-route scenario is absent. | Incomplete |
| Malicious counterpart text cannot change identity/scope/model/mandate and no hidden-state summary | The command test sends a hostile-looking message while forging actor identity; sender remains the authenticated kingdom. `tests/integration/world-views.test.ts` checks that another account's balances, buildings, terms, and account ID are absent. Model connection/mandate manipulation across all adapters is not yet exercised. | Incomplete |
| Generated SDK, model adapter, and MCP use product-scoped contracts without human privileges | Additive Zod/JSON-Schema actions and SDK preparation share one envelope; MCP token scopes are checked at listing and call, and dispatch rechecks `game:act`. Model-adapter game tool execution and full provider fixture remain absent. | Incomplete |

## Checks and documentation

Local Node 24 `npm run build`, `npm run typecheck`, `npm test` (105 tests), `npm run test:integration` (134 tests against PostgreSQL 17), and `npm run lint` passed after the seizure extension. These checks do not establish hosted CI, deployment, client certification, or a player pilot. Updated [MCP API](../../api/mcp.md), [raid module](../../architecture/raids.md), [world views](../../architecture/world-views.md), [social service](../../architecture/social.md), [troop training](../../architecture/troop-training.md), [building queues](../../architecture/building-queues.md), and [module boundaries](../../architecture/modules.md).

## Remaining work

Wire report reads, richer receipts, approvals, bounded Envoy context, and model-provider execution. Add a single cross-route fixture and more adversarial tests. PACT-048 remains dependent on this ticket and must not be marked Done from the current setup UI. Single-VPS MVP only; no native store, paid infrastructure, hosted CI, deployment, or real player pilot is claimed.
