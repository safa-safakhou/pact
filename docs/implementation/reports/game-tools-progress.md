# Game tools integration — progress record

Ticket: [PACT-049 / MNI-113](https://linear.app/mnim/issue/MNI-113/pact-049-expose-complete-game-tools-to-every-envoy-route) — **in progress**, not complete.

## Human-only route matrix and schema coverage — 26 September 2026

A new PostgreSQL fixture submits all seven human-only game actions through both the in-app fake-provider command tool and MCP after `run.open`, forging a human actor and another account in every envelope. The model receives seven `FORBIDDEN` results; MCP denies the same seven; no command receipt or exact human permit appears for either path. A unit contract fixture locks all 28 game action kinds to the shared web, MCP, and model schemas and confirms the model tool omits sandbox actions. Node 24 build, typecheck, lint, 119 unit tests, and 174 PostgreSQL 17 integration tests pass. These tests prevent a missing guard or schema drift from silently widening authority, but do not prove every permitted action has web/model/MCP behavioral equivalence. PACT-049 remains In Progress.

## Owner-context boundary fixture — 26 September 2026

`workers/inference/src/run-context.test.ts` now checks that hostile counterpart prose enters only a user-role, explicitly untrusted selected-conversation excerpt; arbitrary inbox payload is not included in the metadata convenience summary. A non-owner world projection fails closed before inbox or conversation reads, and an oversized selected excerpt is replaced with IDs and a truncation marker rather than leaking its text. Node 24 build, typecheck, lint, 118 unit tests, and 173 PostgreSQL 17 integration tests passed for the batch. These are deterministic construction-boundary checks, not evidence that a live model obeys the warning or that every game command has cross-route parity. PACT-049 remains In Progress.

## Single-VPS gameplay deployment — 26 September 2026

Release `mvp-20260926-1` is running the current game-command backend on the existing VPS, with public deployment verification passing. A clean Docker build initially failed because `build:packages` built kingdom/application before identity/authority; revision `99cf2fa` corrected the topological order and added a lint guard. The host-only synthetic account activated a kingdom and received a COMMITTED Farm II construction receipt through the public gateway. The web/Telegram clients still lack the plain gameplay surface of PACT-048, and PACT-049 cross-route/adversarial acceptance remains open. No live model provider was invoked.

## Scouting approval increment — 26 September 2026

The shared proposal contract now admits `game.scout.start` without a parallel scout implementation. The review summary includes the target, catalog fees, charge, ordinary troop commitment, duration, and either exact selected troop IDs or the server-selection rule. A PostgreSQL MCP fixture checks no scout or troop placement before review, changed troop-ID order and outsider denial, one human-approved scout with exact charges and placements, and stable duplicate receipt. The shared proposal service now reads an optional mandate version only from actions that carry one; scouting has none. This is a focused path, not complete PACT-049 acceptance. See [approval API](../../api/approvals.md).

Local Node 24 `npm run build`, `npm run typecheck`, `npm test` (115), `npm run test:integration` (172 on PostgreSQL 17), and `npm run lint` passed. Backlog render/check and `git diff --check` passed. No hosted CI, VPS deploy, provider call, or player pilot is claimed.

## Construction approval increment — 26 September 2026

The generated shared proposal contract now admits exact `game.building.queue` terms. PACT's application layer quotes the catalog cost and explains the founding-allowance/waiting-instruction distinction; the reusable approval service still performs only owner/lease admission and immutable request storage. The human-approved command goes through the existing dispatcher and receives the same exact one-use session permit as direct human construction. A PostgreSQL fixture covers the MCP proposal, no instruction or permit before review, changed slot denial, failed approval without a live human session, one active build and consumed permit after approval, and stable duplicate receipt. This is not complete PACT-049 approval or route coverage. See [approval API](../../api/approvals.md).

Local Node 24 `npm run build`, `npm run typecheck`, `npm test` (115), `npm run test:integration` (171 on PostgreSQL 17), and `npm run lint` passed. Backlog render/check and `git diff --check` passed. No hosted CI, VPS deploy, provider call, or player pilot is claimed.

## Troop-training approval increment — 25 September 2026

The shared `pact_approval_propose_v1` contract now admits exact `game.training.queue` terms. The PACT application layer derives the review summary from the authoritative unit catalog, including count and conditional Iron/Silver debit; the reusable approval service does not maintain a second cost table. MCP and in-app Envoy use that same proposal schema and lease-bound service, while only a first-party human approval dispatches the stored command. A PostgreSQL fixture covers no pre-approval training row, missing lease, changed terms, disallowed cancel proposal, outsider rejection, exact human commit, same-receipt replay, and a later unaffordable proposal that remains pending without a batch. This is one additional action group, not complete approval coverage or full PACT-049 certification. See [approval API](../../api/approvals.md).

Local Node 24 `npm run build`, `npm run typecheck`, `npm test` (115), `npm run test:integration` (170 on PostgreSQL 17), and `npm run lint` passed. Backlog render/check and `git diff --check` passed. No hosted CI, deployment, live provider, or player pilot is claimed.

Implementation revisions: `7eccf06`, `75224bf`, `d1457ed`, `cdf7c89`, `804198c`, `ca94561`, `e1401b3`, `988b63e`, `e116fb8`, and `1ef8025`. Verification: 24 Sep 2026, Node 24 and local PostgreSQL 17.

## Result

The dependency graph was corrected: PACT-049's shared command/API work precedes PACT-048's UI acceptance. No scope or acceptance wording changed. Authenticated world and scout/raid report reads are shared by HTTP, SDK, and MCP. Reports remain separate from convenience kingdom summaries and are authorized by the scout/raid modules. An MCP grant lacking `game:act` can no longer list or invoke command tools; `world:read` alone permits bounded view and report reads. The dispatcher now accepts social contact, message, transfer, training queue/cancel, human disband, construction queue/cancel, versioned supply offer/counter/sign/withdraw/notice/refuse/release, scout start/share, garrison offer/sign/withdraw/exit/release/seize, and raid declare/nominate/accept/withdraw in the world-clock admission transaction, with server-derived identity, a command receipt, domain outbox effects, and replay protection. MCP `run.open` creates a 15-minute session-bound write lease, checked inside each agent game command; `game:act` alone is not sufficient. Agent messages and nonbinding offers work under the lease and shared limits; cold-contact requests, transfers, training, construction, scouting, signatures, and raid contributions require mandate authority. Contract-breaking agent actions additionally check `supply.break` or `garrison.break` in that transaction. Human construction and garrison seizure get exact one-use permits; contact answers, cancellation, and raid nomination/withdrawal are human-only. Supply/garrison signature receipts report the caller's own bond debit, and raid commitment receipts report the caller's Grain provision debit. The API and rules worker share the existing single-VPS raid-seed secret.

## Acceptance progress

| Acceptance criterion | Current evidence | Status |
| --- | --- | --- |
| Equivalent game commands/receipts from web, adapter, and MCP | `tests/integration/game-command-social.test.ts` records message-send and versioned supply-offer scenarios through the actual web client/HTTP route, fake-provider bridge, and MCP transport. Each route produces a `COMMITTED` receipt with equal empty resource charges and sender-owned effects; each supply offer carries version 1. The message fixture also checks MCP/Pact-run lease exclusion. Scout, garrison, and raid have separate admission/replay fixtures but not cross-route comparisons. | Met for recorded scenarios; scope continues |
| Malicious counterpart text cannot change identity/scope/model/mandate and no hidden-state summary | A fake-provider fixture sends hostile-looking counterpart text with a forged human actor: the committed message belongs to the run owner, the selected model is unchanged, an unmandated contact request is denied, and an added model field fails strict parsing. Owner context keeps selected hostile conversation prose in user-role data; an in-app read outside the human-selected threads returns `NOT_FOUND` and contributes no prose to the next request. The owner snapshot is bounded to 8 KiB and excludes another kingdom's hidden state. `tests/integration/world-views.test.ts` checks private-state exclusion. Broader all-route manipulation tests remain. | Partial |
| Generated SDK, model adapter, and MCP use product-scoped contracts without human privileges | The run tool uses a generated game-action subset of the same versioned command envelope, and the fake provider executes through the shared dispatcher under a live `pact_run` lease. MCP uses a separate holder; SDK/MCP contracts remain shared. Model and MCP now both make mandate-bound cold-contact requests with equal charges despite forged human actor fields, while MCP cannot answer a request. The inference worker persists bounded tool receipt summaries; a post-command process-kill fixture leaves one durable receipt/message and no duplicate provider call. Live API routes are operator-gated and not certified; broader route privilege checks remain. | Partial |

## Run tool-admission increment

`RunService` now hands router-validated provider calls to an injected executor with the server-owned run identity and provider request ID. A configured tool response without an executor fails the run instead of disappearing. Non-quota provider/tool errors fail even if calls remain. `assertRunWriteLease` checks the exact active run holder and owning account within the caller's transaction; an MCP holder or stopped run cannot pass. The fixture integration test covers validated call delivery, account isolation, MCP/run lease separation, stopped-run denial, and fail-closed missing-executor behavior. This is an interface and safety increment only: the production inference worker has no game tool registry/executor and does not yet execute model-produced PACT commands. Durable result/receipt handoff, bounded context, and the recorded cross-route scenario are still required before PACT-049 can be Done.

## Fake-provider command bridge increment

`@pact/application` now owns `pactRunCommandTool` and `dispatchRunCommandTools`. The tool advertises a strict game-action subset of `pact.command.v1`; sandbox and unknown model-connection fields are rejected. The bridge derives an idempotent UUIDv8 from the run/request/call IDs, constructs an agent principal from the server-owned run, and calls the same dispatcher as HTTP/MCP. Ordinary denials return typed receipts. `GameCommandHandler` now accepts the exact active MCP or PACT-run lease, still checking it inside the command transaction. A PostgreSQL fake-provider fixture proves the forged human actor cannot replace the sender, an unmandated contact request is denied, one message/receipt survives replay, changed replay conflicts, and a new command after run completion is denied. This does not certify a real provider or mean the production inference worker has been composed with the game runtime.

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

## Owner direct-conversation read increment — 25 Sep 2026

`pact_conversation_read_v1` now uses one strict schema in MCP and the in-app fake-provider route. The domain-owned reader derives the owner kingdom from the authenticated account, selects at most five messages involving that kingdom and the named counterparty, omits bodies over 512 UTF-8 bytes, and labels the result untrusted. Model results are capped at 3,600 bytes with message IDs retained if truncation is needed. A PostgreSQL fixture compares model and read-only MCP results, checks a different account sees no messages, rejects caller-supplied account IDs and excessive limits, and confirms hostile counterpart prose appears only in user-role result data on the next provider step. Automatic context still excludes message bodies. Run-start conversation selection and its cap remain open; this does not complete PACT-049 or certify a live provider.

Local Node 24 build, typecheck, lint, 115 unit tests, 156 PostgreSQL integration tests, backlog render/check, and diff check passed. No hosted CI, VPS deployment, or paid model call was exercised.

## Atomic in-app message allowance increment — 25 Sep 2026

The default 12-message (maximum 24-message) in-app Envoy allowance now applies to `game.message.send` in the same transaction as the shared command and domain message. The authenticated run lease selects the counter; an MCP holder has no in-app run counter. A PostgreSQL fixture starts a one-message run: a failed noncontact send leaves `used_messages` at zero, a valid send commits once, a same-command replay returns the receipt without another count, and a new send is `RATE_LIMITED`. `POST /v1/runs` accepts `maxMessages`, and the owner run view exposes `maxMessages`/`usedMessages`. This covers outgoing-message count, not selected-conversation count or every concurrent sender interleaving. PACT-049 remains In Progress.

Local Node 24 build, typecheck, lint, 115 unit tests, 157 PostgreSQL integration tests, backlog render/check, and diff check passed. No hosted CI, VPS deployment, or paid model call was exercised.

## Human-selected conversation context increment — 25 Sep 2026

The human run-start API now accepts distinct, owner-involved direct-message counterpart IDs within a six-conversation default and twelve-conversation maximum. The selection is validated before the write lease, persisted for resume, and reflected in owner-only run status. The inference worker sends at most three newest messages per selected thread, omits bodies over 512 UTF-8 bytes, and caps the combined selection at 12 KiB. It labels the excerpts untrusted user-role data; the fixed system message never includes them. The PostgreSQL fake-provider fixture rejects an unrelated thread, duplicate or over-cap selection, then confirms only selected owner-involved prose reaches the provider. This is local fake-provider evidence, not proof a live model cannot be manipulated. PACT-049 stays In Progress pending broader adversarial and cross-route acceptance.

The migration, run API, and database runbook are documented in `docs/api/runs.md` and `docs/operations/database.md`. Local Node 24 `npm run build`, `npm run typecheck`, `npm test` (115), `npm run test:integration` (158 against PostgreSQL 17), and `npm run lint` pass. Backlog render/check and diff check are recorded with this batch. No hosted CI, live provider, VPS deployment, or player pilot was exercised.

## Selected-read and versioned cross-route increment — 25 Sep 2026

The in-app conversation tool now rejects any thread outside the immutable human selection with a non-revealing `NOT_FOUND`, even when the owner has another valid thread. A two-tool fake-provider fixture confirms the selected thread is returned, the unselected thread is not included in the subsequent model input, and a separate read-only MCP grant can still read that owner-involved thread. This closes an allowance bypass without changing external-host grants.

A second recorded scenario creates equivalent version-1 supply offers through the authenticated web SDK/HTTP route, the fake-provider in-app command bridge, and MCP. All three receive `COMMITTED`, empty resource charges, and a version-1 offer reference; all persisted offers have the authenticated sender's kingdom, despite forged account fields in the model and MCP envelopes. This extends the prior message-only cross-route scenario to a versioned contract primitive. Full multi-command and adversarial acceptance is still open; PACT-049 remains In Progress.

Local Node 24 `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (115), and `npm run test:integration` (159 against PostgreSQL 17) pass. Backlog render/check and diff check are recorded with the batch. No live provider or VPS deployment was exercised.

## Fixed Version 1 run-ceiling increment — 25 Sep 2026

The human API and shared run service now enforce the execution contract's immutable maximum of 15 minutes, 20 model calls, and 40 000 tokens. Optional human limits can reduce call/token budgets; they cannot raise them. The service also rejects invalid conversation/message limits rather than silently clamping them. A PostgreSQL fixture proves over-ceiling requests create no run, lease, or inference job, while the exact maxima remain valid. This is a PACT-021 bounded-run regression correction supporting PACT-049 safety, not evidence that all game-tool acceptance is complete.

Local Node 24 build/typecheck/lint, 115 unit tests, and 160 PostgreSQL integration tests pass. Backlog render/check and diff check are recorded with the batch. No live provider or VPS deployment was exercised.

A selected-thread adversarial fixture passes counterpart prose instructing an Envoy to impersonate another account, alter its model and transfer mandate, send Silver, and take an unmandated cold-contact action. The fake provider receives the prose only in a user-role message and deliberately submits forged transfer and contact tool calls. The run stays bound to its original owner/provider/model; neither tool call commits and the database has no transfer, mandate, or contact-request effect. The advertised game tools do not include model connection or mandate update. This verifies server authority for this scenario, not a real model's resistance to prompt injection or every command group. PACT-049 remains In Progress.

Local Node 24 `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (115), and `npm run test:integration` (161 against PostgreSQL 17) pass for this increment. No live provider or VPS deployment was exercised.

## Post-command process-death increment — 25 Sep 2026

A separate inference process claims the durable job, runs a fake provider, and commits a real game message through the production-composed dispatcher. It then pauses before run-step reconciliation and is killed with `SIGKILL`. Replacement claim finds one owner-authored message, one durable command receipt, and one charged outgoing-message allowance; the run is failed ambiguously and the provider is not invoked again. No model tool-result summary is fabricated. This closes the specific process-kill drill left open below, not all command-group equivalence or a full VPS restart. PACT-049 remains In Progress.

Local Node 24 build/typecheck/lint, 115 unit tests, and 162 PostgreSQL integration tests pass. No live provider, hosted CI, or VPS deployment was exercised.

## Mandated cold-contact increment — 25 Sep 2026

The shared `game.contact.request` envelope now accepts an optional `mandateVersion`. An agent with the current `contact.request` action and enough Silver allowance can make a cold request under its active run lease. The authority spend, two-Silver stock debit, rolling action count, request, receipt, and outbox event remain in one world-admitted transaction; a human request still needs no agent mandate. `game.contact.answer` remains human-only. A fake-provider run and a separate MCP lease each commit a request despite forged human actor fields. The fixture checks equal two-Silver receipt charges, owner-derived sender, exact same-command MCP replay, stale mandate denial, allowance exhaustion without a third request/spend, and contact-answer denial. This corrects the earlier blanket agent denial, which conflicted with the execution contract. It does not certify a live model or all command groups. PACT-049 remains In Progress.

Local Node 24 `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (115), and `npm run test:integration` (163 against PostgreSQL 17) pass. No hosted CI, live provider, or VPS deployment was exercised.

## Human-only contact acceptance across routes — 25 Sep 2026

An authenticated web SDK session accepts a pending cold-contact request and receives a replay-stable `COMMITTED` receipt. The same recipient's in-app fake-provider run and MCP agent lease each submit the exact `game.contact.answer` action with a forged human actor; both receive `FORBIDDEN`, and the request stays pending until the human acts. The fixture then verifies the accepted contact pair. This extends the product-scoped privilege boundary to a state-changing social command across all three routes; it does not prove every command group or live-model prompt-injection resistance.

At this checkpoint an approval-flow audit found that `ApprovalService.createRequest` had no production caller, so an unmandated agent command was denied rather than producing an approval request/deep link. The later cold-contact proposal increment below closes that narrow gap only; do not confuse a human-only contact answer with an approvable agent action.

The existing request-creation primitive now validates product/account ownership and rejects a reused command ID with changed canonical terms or a different owner. Its PostgreSQL fixture checks exact replay, changed-term denial, and cross-account denial. Full local Node 24 build/typecheck/lint, 115 unit, and 164 PostgreSQL integration tests pass after this correction. This hardens the future proposal route but does not wire it.

Local Node 24 `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (115), and `npm run test:integration` (164 against PostgreSQL 17) pass. No hosted CI, live provider, or VPS deployment was exercised. PACT-049 remains In Progress.

## Exact cold-contact proposal increment — 25 Sep 2026

The shared `pact_approval_propose_v1` schema accepts one command ID and typed `game.contact.request` action, never an actor/account field. The in-app fake-provider route and MCP `game:act` route both use `ApprovalService.proposeAgent`; it derives the owner from the active run or grant and checks that exact write lease inside the request-creation transaction. The server renders the conditional two-Silver/one-action effects summary. The pending approval, owner inbox event, and outbox event commit together without touching stock or creating a contact request. MCP returns an HTTPS human-review link; the model records a bounded review-path result. Only human approval dispatches the stored command, and owner inbox resolution is recorded once.

The PostgreSQL fixture covers missing lease and read-only MCP denial, a human-only `contact.answer` proposal rejected by the strict schema, same-command MCP replay yielding one request/event, changed terms rejected, no contact or Silver debit before human approval, and one committed request with exactly 1,200 internal Silver units charged. The approval HTTP route returns 403 without a human session, commits with the authenticated human cookie/Origin/CSRF, and returns the same receipt on duplicate POST. A separate paused-world fixture verifies that a noncommitting dispatcher receipt leaves the approval pending. The fixture also exposed JSONB key reordering in the prior hash comparison; the service now normalizes actions through the versioned schema before hashing both submitted and stored terms.

This is not automatic approval fallback for every blocked command. Other game groups still require accurate server-rendered effects, preconditions, earlier deadlines, and relevant exact human permits before exposing proposal entry points. PACT-049 remains In Progress; PACT-048 is not unblocked. No paid provider, hosted client, or VPS gameplay deployment was exercised.

Local Node 24 `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (115), and `npm run test:integration` (166 against PostgreSQL 17) pass for this increment. The tests use fake providers and a disposable schema; no hosted CI or live provider was exercised.

## Exact direct-transfer proposal increment — 25 Sep 2026

The shared proposal contract now also accepts the same strict `game.transfer` action used by gameplay commands. Under a live Envoy write lease, the server creates an owner-bound pending request and summarizes the recipient, resource, and exact whole amount. It does not require an Envoy spending mandate merely to ask for review, nor does it debit stock. The human approval path dispatches those stored terms under the human principal and rechecks contact, stock, action limits, and current game state. Recipient capacity may limit the amount credited, so the review summary calls that out rather than promising a full credit.

A PostgreSQL fixture establishes an accepted contact, proposes a two-Iron transfer without an agent transfer mandate, verifies no transfer or Iron debit before approval, denies another account's approval and changed-term replay, and then verifies one 1,200-unit debit/credit and one transfer after owner human approval. Duplicate approval returns the same receipt. This extends the existing model/MCP proposal transport fixture through a second economic action; it does not certify every game action or an actual deployed human UI. PACT-049 remains In Progress.

Local Node 24 build/typecheck/lint, 115 unit tests, and 167 PostgreSQL 17 integration tests pass. No live provider, hosted CI, VPS deployment, or player pilot was exercised.

The next fixture exercises this transfer proposal through the actual MCP `game:act` tool under `run.open`, then checks exact replay and the same owner-only human commit. This verifies the generated transfer proposal reaches the shared service through MCP, rather than only calling the service directly. Local Node 24 build/typecheck/lint, 115 unit tests, and 167 PostgreSQL 17 integration tests pass after this addition. It still does not prove every command group or a live external client. PACT-049 remains In Progress.

## Approval resolution race and expiry increment — 25 Sep 2026

The approval resolution path now keeps the approval row locked while its exact command dispatches and records the result. Concurrent rejection cannot turn a committed command into a rejected approval, and a duplicate approval returns the same receipt. Expired approve/reject requests now persist their terminal state rather than rolling it back when returning `EXPIRED`. A PostgreSQL fixture holds dispatch open, races rejection and duplicate approval, and checks one command receipt plus one approved inbox/outbox event. Local Node 24 build/typecheck/lint, 115 unit tests, and 168 PostgreSQL 17 integration tests pass. This hardens the existing proposal route; it does not add new action groups. PACT-049 remains In Progress.

The published `pact_approval_propose_v1` tool description now names both supported actions—cold contact and direct transfer—matching its shared JSON schema. This removes a misleading cold-contact-only hint from both in-app Envoy and MCP tool listings. The new PACT-051 seeded transfer fixture also exercises the same command dispatcher and replay semantics across 30 varying direct transfers, but it is not a fresh web/model/MCP equivalence claim. Local Node 24 build/typecheck/lint, 115 unit tests, and 169 PostgreSQL 17 integration tests pass. PACT-049 remains In Progress.

## Remaining work

For the latest fake-provider bridge increment, Node 24 `npm run build`, `npm run typecheck`, `npm test` (108 tests), `npm run test:integration` (139 PostgreSQL integration tests), `npm run lint`, and `git diff --check` passed. The run/provider API documentation now states the generated game-tool subset and lease boundary. No real-provider or hosted scenario was exercised.

For the input-allowance increment, Node 24 `npm run build`, `npm run typecheck`, `npm test` (108), `npm run test:integration` (141 against local PostgreSQL 17), and `npm run lint` passed. The new fixture verifies a low-budget run never invokes the provider. This remains local evidence only.

For the worker-composition increment, Node 24 `npm run build`, `npm run typecheck`, `npm test` (108), `npm run test:integration` (143 against local PostgreSQL 17), and `npm run lint` passed. This verifies the local fake-provider route through the worker's product wiring, not a live model or deployed VPS behavior.

For the receipt-handoff increment, Node 24 `npm run build`, `npm run typecheck`, `npm test` (108), `npm run test:integration` (144 against local PostgreSQL 17), and `npm run lint` passed after updating the hard-coded migration smoke list. `git diff --check` and backlog render/check passed before commit. No hosted CI or live provider was exercised.

Compare additional command groups across routes and complete adversarial route checks. The post-command process-kill drill is recorded above. Verify any explicitly enabled real API route separately before claiming provider compatibility. PACT-048 remains dependent on this ticket and must not be marked Done from the current setup UI. Single-VPS MVP only; no native store, paid infrastructure, hosted CI, deployment, or real player pilot is claimed.
