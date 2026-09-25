# Game tools integration — progress record

Ticket: [PACT-049 / MNI-113](https://linear.app/mnim/issue/MNI-113/pact-049-expose-complete-game-tools-to-every-envoy-route) — **in progress**, not complete.

Implementation revisions: `7eccf06`, `75224bf`, `d1457ed`, `cdf7c89`, `804198c`, `ca94561`, `e1401b3`, `988b63e`, `e116fb8`, and `1ef8025`. Verification: 24 Sep 2026, Node 24 and local PostgreSQL 17.

## Result

The dependency graph was corrected: PACT-049's shared command/API work precedes PACT-048's UI acceptance. No scope or acceptance wording changed. Authenticated world and scout/raid report reads are shared by HTTP, SDK, and MCP. Reports remain separate from convenience kingdom summaries and are authorized by the scout/raid modules. An MCP grant lacking `game:act` can no longer list or invoke command tools; `world:read` alone permits bounded view and report reads. The dispatcher now accepts social contact, message, transfer, training queue/cancel, human disband, construction queue/cancel, versioned supply offer/counter/sign/withdraw/notice/refuse/release, scout start/share, garrison offer/sign/withdraw/exit/release/seize, and raid declare/nominate/accept/withdraw in the world-clock admission transaction, with server-derived identity, a command receipt, domain outbox effects, and replay protection. MCP `run.open` creates a 15-minute session-bound write lease, checked inside each agent game command; `game:act` alone is not sufficient. Agent messages and nonbinding offers work under the lease and shared limits; transfers/training/construction/scouting/signatures and raid contributions require mandate authority. Contract-breaking agent actions additionally check `supply.break` or `garrison.break` in that transaction. Human construction and garrison seizure get exact one-use permits; cancellation and raid nomination/withdrawal are human-only. Supply/garrison signature receipts report the caller's own bond debit, and raid commitment receipts report the caller's Grain provision debit. The API and rules worker share the existing single-VPS raid-seed secret.

## Acceptance progress

| Acceptance criterion | Current evidence | Status |
| --- | --- | --- |
| Equivalent game commands/receipts from web, adapter, and MCP | `tests/integration/game-command-social.test.ts` now records one message-send scenario through the actual web client/HTTP route, fake-provider tool bridge, and MCP transport. All three produce `COMMITTED` receipts with equal empty resource charges and three sender-owned messages; the two agent rows are marked agent-originated. The same fixture rejects an MCP write lease while the in-app run is active, then admits it after completion. The recorded-scenario criterion is met; supply, scout, garrison, and raid command admission/replay checks remain in separate fixtures, without cross-route comparison of those groups. | Met for recorded scenario; scope continues |
| Malicious counterpart text cannot change identity/scope/model/mandate and no hidden-state summary | A fake-provider fixture sends hostile-looking counterpart text with a forged human actor: the committed message belongs to the run owner, the selected model is unchanged, a human-only contact action is denied, and an added model field fails strict parsing. The new owner-context fixture inserts hostile counterpart prose but confirms it is absent from the provider input and system message; the server-selected owner snapshot is bounded to 8 KiB and does not contain another kingdom's ID. `tests/integration/world-views.test.ts` checks that another account's private balances/buildings/terms/ID are absent. Inbox/conversation selection and all-route manipulation tests remain. | Partial |
| Generated SDK, model adapter, and MCP use product-scoped contracts without human privileges | The run tool uses a generated game-action subset of the same versioned command envelope, and the fake provider executes through the shared dispatcher under a live `pact_run` lease. MCP still uses its separate holder; SDK/MCP contracts remain shared. The inference worker composes this shared handler and persists bounded tool receipt summaries for the next step; real-provider credentials and full authorized context remain missing. | Incomplete |

## Run tool-admission increment

`RunService` now hands router-validated provider calls to an injected executor with the server-owned run identity and provider request ID. A configured tool response without an executor fails the run instead of disappearing. Non-quota provider/tool errors fail even if calls remain. `assertRunWriteLease` checks the exact active run holder and owning account within the caller's transaction; an MCP holder or stopped run cannot pass. The fixture integration test covers validated call delivery, account isolation, MCP/run lease separation, stopped-run denial, and fail-closed missing-executor behavior. This is an interface and safety increment only: the production inference worker has no game tool registry/executor and does not yet execute model-produced PACT commands. Durable result/receipt handoff, bounded context, and the recorded cross-route scenario are still required before PACT-049 can be Done.

## Fake-provider command bridge increment

`@pact/application` now owns `pactRunCommandTool` and `dispatchRunCommandTools`. The tool advertises a strict game-action subset of `pact.command.v1`; sandbox and unknown model-connection fields are rejected. The bridge derives an idempotent UUIDv8 from the run/request/call IDs, constructs an agent principal from the server-owned run, and calls the same dispatcher as HTTP/MCP. Ordinary denials return typed receipts. `GameCommandHandler` now accepts the exact active MCP or PACT-run lease, still checking it inside the command transaction. A PostgreSQL fake-provider fixture proves the forged human actor cannot replace the sender, a human-only action is denied, one message/receipt survives replay, changed replay conflicts, and a new command after run completion is denied. This does not certify a real provider or mean the production inference worker has been composed with the game runtime.

## Input-allowance increment

The run service now assembles the messages and tool definitions once before reservation and uses the same values for the provider call. It estimates caller-controlled text from its UTF-8 byte length and includes serialized tool definitions instead of reserving the former fixed 50 input tokens. A PostgreSQL fixture starts a run whose objective exceeds its token allowance and proves that it finishes with no provider invocation, in-flight request, call count, or reserved tokens. This guards the admission boundary; tool-schema tokenization remains approximate, and actual usage is still reconciled from the provider response.

## Inference-worker composition increment

`GameCommandHandler` moved from the API transport package into PACT-owned `@pact/application`, so the API and inference worker now instantiate the same command implementation rather than maintaining two permission paths. `workers/inference/src/game-runtime.ts` builds the world-admitted dispatcher, domain services, exact live run-lease check, and generated `pact_command_v1` tool bridge. The single-VPS Compose service mounts the existing raid-seed secret into inference as well as API/rules. A PostgreSQL test creates this actual worker composition with a fake provider, submits a forged-actor message tool call, and verifies that the sender is the run owner and exactly one shared command receipt is committed. No paid provider was called. The deployed worker still registers only the deterministic fake provider and does not yet unwrap real model credentials.

## Durable receipt-handoff increment

Migration `0013a_run_tool_results.sql` adds a run-owned table with unique run/request/call keys and bounded server-generated summaries. The worker stores command ID, result code, charged amounts, and optional approval ID—not tool arguments or message bodies. `RunService` inserts these summaries in the same transaction as successful model-step reconciliation, selects at most the 16 latest results for the next request, and includes them in the input reservation. A PostgreSQL two-step fixture verifies the second provider request receives the committed summary, a finished-run retry does not duplicate it, and run deletion cascades it. The worker-composition fixture verifies the stored summary contains the committed receipt but not the message body. The privacy export now includes these owner-scoped rows and 30-day run retention deletes them. This is durable handoff after successful reconciliation, not proof of automatic recovery from a process kill between command commit and reconciliation.

## Inference credential and provider opt-in increment

The worker now registers the existing API adapters only under `PACT_ENABLE_LIVE_MODEL_CALLS=1`; Compose and the example environment default to `0`. OpenRouter additionally requires an operator-reviewed routing disclosure. On opt-in the worker reads the inference-only private key, creates the vault resolver with the configured wrapping key ID, and wraps the provider invocation inside the admitted vault use. The stored connection's provider must equal the run's selected provider; a selected connection with no resolver fails closed. A local PostgreSQL fixture proves cross-account and cross-provider denial and a synthetic OpenAI Responses request through an injected HTTP transport, with one completed vault-use record. A unit fixture proves the default router rejects a network provider. No live model request, paid spend, deployment, or route certification was performed.

For this increment, local Node 24 `npm run build`, `npm run typecheck`, `npm test` (110), `npm run test:integration` (146 on PostgreSQL 17), and `npm run lint` passed. Relevant run API and single-VPS operations instructions were updated. The Linear acceptance checklist remains open.

## Redelivered model-step safety increment

On a retried durable inference job, the worker now checks for a prior unresolved provider request. It marks that run failed and ambiguous, releases its token reservation and write lease, and does not invoke the provider again. A PostgreSQL fixture holds the original synthetic provider call open, runs this recovery path, then lets the original response arrive: only one invocation occurs and late reconciliation cannot restart the run. This is conservative failure, not successful recovery of an unknown provider response or a real killed-process drill.

Local Node 24 `npm run build`, `npm run typecheck`, `npm test` (110), `npm run test:integration` (147 on PostgreSQL 17), `npm run lint`, backlog check, and diff check passed for this increment.

## Cross-route and owner-context increment

One recorded social action now runs through `createWebPactClient` plus HTTP, the fake model's `pact_command_v1` bridge, and MCP `pact_command_v1` on the same worker-composed dispatcher. The actor field in the model/MCP arguments names the recipient, but both committed messages still belong to the authenticated sender. Receipts share the committed code and empty resource charge. The MCP lease conflicts with an active PACT run and succeeds only after that run finishes. The inference worker's new asynchronous context port selects a compact owner-only world snapshot from the authorized view service, capped at 8 KiB with a smaller fallback. A hostile counterpart message and another kingdom's ID do not appear in that model input. This is one action group and owner-world context, not all-game-tool equivalence or full inbox context.

Local Node 24 `npm run build`, `npm run typecheck`, `npm test` (110), `npm run test:integration` (149 on PostgreSQL 17), `npm run lint`, backlog check, and diff check passed. No hosted CI, live provider, or VPS deployment was exercised.

## Owner-inbox metadata increment

The inbox module now exposes an owner-scoped, newest-first metadata selector capped at eight events. The inference composition adds this to model input as user-role data, filtering arbitrary event types and excluding all payload fields. The PostgreSQL fixture publishes ten owner events with hostile text in each payload and a separate account event: the provider sees eight owner event types, no hostile prose, and no other-account event ID. The existing world snapshot and fixed system prompt remain unchanged. This narrows the context gap but does not implement full conversation selection or prove that a real model will resist every prompt injection. PACT-049 remains In Progress.

Local Node 24 `npm run build`, `npm run typecheck`, `npm test` (110), `npm run test:integration` (149 on PostgreSQL 17), `npm run lint`, backlog render/check, and `git diff --check` passed. No hosted CI, live provider call, VPS deployment, or player pilot was run.

## Explicit owner-inbox read increment

The shared contracts package now defines strict `pact_inbox_read_v1` arguments: optional decimal cursor and 1–5 event limit, with no account ID field. Both MCP (under `world:read`) and the in-app Envoy's fake-provider route call the same owner-scoped `InboxService.readBounded` projection. The projection selects each event's inner payload only, omits payloads over 512 UTF-8 bytes, and labels all returned content untrusted. The model result is bounded and charged to the run; unlike automatic inbox metadata, an explicit read can persist private message prose in the run's 30-day tool-result record and owner export. A PostgreSQL fixture compares owner event IDs across model and MCP, checks cursor paging, payload omission, other-account exclusion, no-write-scope behavior, and rejection of caller-supplied ownership and oversized limits. This closes a read-route gap, not the remaining command groups, approval behavior, or full PACT-049 adversarial acceptance.

## Checks and documentation

## Owner receipt and approval-status read increment

The in-app Envoy and MCP now share strict `pact_receipt_read_v1` and `pact_approval_status_v1` schemas. The receipt lookup is the shared dispatcher history, newly permitting a `world:read`-only agent for this read without relaxing game-command admission. The approval selector is a read-only owner-scoped service; it returns current status, effects summary, expiry, optional committed receipt, and the human review path, with no approve/reject capability. In-app results are capped at 3,600 UTF-8 bytes. A PostgreSQL fixture checks owner versus outsider model/MCP reads, strict rejection of a supplied viewer ID, and that the read-only MCP grant cannot list the write tool. This improves result reconciliation, but does not complete PACT-049's full cross-route command and hostile-content acceptance.

Local Node 24 build, typecheck, lint, 113 unit tests, and 154 PostgreSQL integration tests passed after stabilizing the synthetic retirement retention clock. No live provider, hosted CI, or VPS deployment was exercised.

## Explicit world and report model-read increment

The inference worker now offers the shared strict `pact_world_read_v1` and `pact_report_read_v1` definitions used by MCP. It derives the viewer from the active run and calls `WorldViewService` and the domain-owned `GameReportReader`; model arguments have no account field. Results are capped at 3,600 UTF-8 bytes with an explicit truncation marker, below the run persistence ceiling. A PostgreSQL fixture observes owner balances versus an outsider's public-only view, the owner's completed scout report versus an outsider's `NOT_FOUND`, and MCP rejection of a caller-supplied account ID. The API remains a compatibility re-export of the moved reader. This closes the explicit read-path gap but not full PACT-049 acceptance: broader command-route equivalence, selected conversation content, and adversarial model-route coverage remain.

Local Node 24 build, typecheck, lint, 112 unit tests, and 153 PostgreSQL integration tests passed. No live provider, hosted CI, or VPS deployment was exercised.

Local Node 24 `npm run build`, `npm run typecheck`, `npm test` (107 tests), `npm run test:integration` (134 tests against PostgreSQL 17), and `npm run lint` passed after report-read integration. The domain integration fixtures recheck scout owner/share and raid participant/public separation through `GameReportReader`; HTTP/MCP/SDK tests verify scoped adapter behavior. These checks do not establish hosted CI, deployment, client certification, or a player pilot. Updated [MCP API](../../api/mcp.md), [client SDK](../../api/client-sdk.md), [raid module](../../architecture/raids.md), [world views](../../architecture/world-views.md), [social service](../../architecture/social.md), [troop training](../../architecture/troop-training.md), [building queues](../../architecture/building-queues.md), and [module boundaries](../../architecture/modules.md).

## Versioned command-result handoff increment — 25 Sep 2026

The inference worker now persists bounded, server-issued `recordVersions` and `committedEventIds` alongside each command outcome. This lets an in-app Envoy identify the exact offer ID and version needed for a subsequent supply counter or signature; oversized summaries explicitly say `truncated` and retain the command ID for the owner-scoped full receipt read. A fake-provider PostgreSQL fixture submits a supply offer with a forged actor, verifies the proposer is the authenticated run owner, and checks that the stored tool result contains the offer's version 1 reference. This is not a live-provider certification or complete cross-route equivalence. PACT-049 remains In Progress.

Local Node 24 build, typecheck, lint, all 114 unit and 155 PostgreSQL integration tests, backlog render/check, and diff check passed. No hosted CI, VPS deployment, or live model call was exercised.

## Remaining work

For the latest fake-provider bridge increment, Node 24 `npm run build`, `npm run typecheck`, `npm test` (108 tests), `npm run test:integration` (139 PostgreSQL integration tests), `npm run lint`, and `git diff --check` passed. The run/provider API documentation now states the generated game-tool subset and lease boundary. No real-provider or hosted scenario was exercised.

For the input-allowance increment, Node 24 `npm run build`, `npm run typecheck`, `npm test` (108), `npm run test:integration` (141 against local PostgreSQL 17), and `npm run lint` passed. The new fixture verifies a low-budget run never invokes the provider. This remains local evidence only.

For the worker-composition increment, Node 24 `npm run build`, `npm run typecheck`, `npm test` (108), `npm run test:integration` (143 against local PostgreSQL 17), and `npm run lint` passed. This verifies the local fake-provider route through the worker's product wiring, not a live model or deployed VPS behavior.

For the receipt-handoff increment, Node 24 `npm run build`, `npm run typecheck`, `npm test` (108), `npm run test:integration` (144 against local PostgreSQL 17), and `npm run lint` passed after updating the hard-coded migration smoke list. `git diff --check` and backlog render/check passed before commit. No hosted CI or live provider was exercised.

Automatic context still lacks selected conversation prose; only an explicit, bounded inbox read exposes it. Compare additional command groups across routes, add richer approval/record-read behavior and adversarial route checks, and run a process-kill drill after a committed game tool. Verify any explicitly enabled real API route separately before claiming provider compatibility. PACT-048 remains dependent on this ticket and must not be marked Done from the current setup UI. Single-VPS MVP only; no native store, paid infrastructure, hosted CI, deployment, or real player pilot is claimed.
