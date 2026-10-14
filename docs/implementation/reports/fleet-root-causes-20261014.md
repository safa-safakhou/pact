# Fifty server Luna agents: causal investigation

Investigation date: 14 October 2026. Scope: the original fifty-account cohort on fleet.tinyagenttools.com. This is a read-only causal follow-up to the [gameplay census](fleet-gameplay-investigation-20261014.md), [all-fifty roster](fleet-agent-roster-20261014.md) and [investigation plan](../fleet-agent-investigation-plan-20261013.md). No fixes, new experiments or runtime interventions were performed.

## Result and latest state

The infrastructure recovery did not resolve the dominant gameplay failures. The strongest demonstrated mechanisms are loss of requested forecast data, opaque spending-authority refusals, and weak transfer of outcomes into the next turn. The latter can preserve obsolete waits and unnecessary reconciliation. Communication works, but attention, action validation and the early economy prevent it from becoming reliable cooperation. These are different failure classes, not one engine-wide prohibition on agency.

At **19:24:01 Berlin /17:24:01 UTC**, both databases were queried in separate repeatable-read, read-only transactions, 0.054 seconds apart. All fifty account/kingdom bindings still match the original cohort. Fleet was running, with **49 ready agents and Agent 17 requiring reconnection**, one running turn, zero pending cohort commands and the two preserved historical unknown allocations. The world clock was active.

| Measure | Earlier behavioral cutoff, 17:17 Berlin | Latest check, 19:24 Berlin |
| --- | ---: | ---: |
| Hall I /II /III | 13 /37 /0 | **11 /38 /1** |
| Completed upgrades | 369 | **378** |
| Messages sent by this cohort | 74 | **76** |
| Contact relationships touching the cohort | 18 | **19** |
| Supply contracts touching the cohort | 0 | **0** |

Agent **42 reached Hall III**, establishing entry into the III–IV band. Agent 32 now has Hall III actively building. Agents 12 and 23 have other active upgrades; Agents 02, 05 and 25 have waiting Farm IV instructions. The earlier Agent 32 Silver wait is a dated condition, not its current status. The current route to Hall III therefore works, although almost everybody remains in the first band.

Between the 17:17 behavioral cutoff and the latest check, **416 finished turns produced fourteen commitments; 405 turns committed nothing (97.4%)**. Several commitments occurred within the same turn, so fourteen commitments are not fourteen productive turns. Of 5,099 finished turns in the earlier 13 October 11:30–14 October 14:00 Berlin window, well before the disk incident, **4,905 committed nothing (96.2%)**. The outage explains interruptions and gaps; it cannot explain these earlier loops or the overall absence of cooperation.

Runtime inspection confirms Fleet worker **b4ad9db3c1010490f19b4aec2f644ce1b8c82c92**, Luna medium, fifteen-minute stagger, serial inference, two model decisions/two actions per turn and a 24,000-byte input envelope. This server uses the basic notes/read-cache controller. The optional structured cognition/Laya controller in newer local source is not enabled here. PACT rules remain `fleet-p1-20261013-1`. The separately authorized shared API deployment `worldwide-discovery-20261014-1` started at **18:10:45 Berlin**; behavioral evidence before that boundary must not be described as exercising that release.

## How a turn can look healthy while making no progress

The deployed controller first reads current owner facts, retrieves dated read memory and notes, and automatically reads one rotating contact. It packs those observations, permissions and schemas into a model input. The model chooses a read, wait or action. A read consumes a model decision; an action must also pass local contract validation and server authority. Committed construction then progresses with the game clock, independently of subsequent model decisions.

The scheduler's ready/finished states establish eligibility and completion of an execution cycle. Known refusals and read errors can finish normally. A WAIT resets the failure counter. Neither state means the agent advanced a plan, understood its observations, or responded to a peer. In the earlier last-day window, median start lateness was 1.13 seconds and median turn duration 7.86 seconds; p95 lateness was 85.86 seconds, with an outage-related maximum of 6,201.69 seconds. Serialization is a friction and incident recovery causes gaps, but ordinary capacity alone does not explain the repeated one-call waits or missing actions.

## Demonstrated mechanisms and causal episodes

### 1. Forecast exists at the API, but packing removes it

Agent 08 had 164 finished turns and zero lifetime actions at the earlier cutoff despite two free builders and six feasible level-II upgrades. Of its retained requested-world deliveries, **143 were partial and all 143 explicitly omitted `forecast`**. It spent both decisions reading in 133 of those 164 turns. The most recent supplementary traces still end in READ.

The deployed fresh-environment projection does not include the forecast. A requested world read is therefore the relevant route to that information. When the full input does not fit, Fleet first evicts cache/descriptions, then reduces optional environment fields, then narrows the requested result. The world projection iterates response fields in their object order and keeps whole fields/records until its byte allowance is used. Earlier metadata and duplicated state consume the allowance before forecast is reached. The world-read schema offers a horizon and target, but no forecast-only section filter. Generic advice to request a narrower section does not provide an executable escape here.

A zero-inference full-envelope reconstruction used actual deployed packing modules, saved owner projections, original notes/memory and actual read schemas. For Agent 08, full requested feedback with a reduced 5,946-byte environment required **24,903 bytes**, exceeding 24,000. The selected narrowed packet required **23,098 bytes** and omitted forecast. Intermediate environment allowances were also tested; the 6,000-to-4,000 step size alone does not explain this case because intermediate packets still failed to fit.

The decision schema appears both inside the user context and separately in envelope accounting. In a diagnostic input ablation, omitting only the inside-context copy allowed full forecast feedback to fit at **23,757 bytes**. Omitting the small notes alone still selected feedback without forecast. This establishes a budget/field-priority mechanism; it does not establish that notes caused forecast loss. No production schema, permission or packet was changed. A separate first-decision reconstruction also carried the requested marker across turns while delivering no forecast.

**Confidence:** reproduced controller defect, corroborated by historical delivered-field telemetry. Reconstructed packets are not byte-exact historical prompts; optional public observations and timestamps differ. Source: Fleet b4ad9db `src/context.ts`, `src/games/pact/context.ts`, `adapter.ts` and `environment.ts`.

### 2. Stock affordability is presented without remaining permission

The verified mandates each have a 1,000-Iron spending ceiling. Admission includes legacy exposure, spending in the rolling **24 game hours**, outstanding reservations and the new quote. The guide exposes stock checks and the ceiling; Fleet's capability matrix establishes action-family permission, not remaining spending headroom. The API maps `INSUFFICIENT_ALLOWANCE` to generic `FORBIDDEN`.

All **106 retained building FORBIDDEN resolutions** at the earlier cutoff, across thirteen accounts, reproduce an Iron-authority shortfall against the retained spend/reservation history and committed tick at rejection. This is sufficient to explain each refusal; it does not certify every proposal's other prerequisites or stock. For example, Agents 35/40 had 780 Iron counted as spent, leaving 220 against a 540-Iron Hall III quote. Agent 32 had 360 spent plus 540 reserved, leaving 100 against a 180-Iron Storehouse III quote. Agent 02's waiting Farm IV reserved 280 Iron while requiring Hall III, whose 540-Iron quote could not fit its remaining 180 headroom.

The opacity matters causally: an affordable stock quote can repeatedly fail without a model-visible remaining allowance or release boundary. Game-clock pauses also pause rolling-window relief. A reservation can keep authority occupied while its prerequisite remains missing. This is distinct from an engine deadlock occupying both builder slots; the earlier two-slot deadlocks remain cleared. Supplementary traces contain further generic refusals, but the numerical replay above is explicitly scoped to the original 106.

**Confidence:** reproduced admission cause and source-confirmed observation/error-fidelity defect. Correct enforcement of an owner ceiling is not itself a bug. Sources: [authority exposure](../../../packages/authority/src/exposure.ts), [command error mapping](../../../packages/application/src/game-command-handler.ts), [agent guide](../../../packages/application/src/agent-guide.ts), Fleet b4ad9db capability matrix.

### 3. Detailed correction expires while the preceding intention persists

Every new deployed turn starts with an empty `decisionFeedback` array. `commandResults` is built from the current turn's local reads/results, not the last turn's durable command-resolution history. After a known denied submission, the result is recorded for operators, but the loop breaks. That final result is not subsequently persisted into read memory by this path. The next turn receives a generic outcome code, the last finished summary and coalesced notes rather than that full receipt/rejection context.

Read-name/argument refusals can inform a second decision in the same turn. At the earlier cutoff, Agent 38 had fourteen first-decision and nine second-decision read refusals; Agent 43 had three and four. Every first-decision refusal in these two accounts was followed by a different selection, although a different selection is not necessarily a successful correction. Second-decision refusals had no remaining model decision. Thus immediate correction sometimes works; the deficient boundary is durable continuation after the turn ends.

Notes persist until replaced, and last intent is the previous finished summary, with no structured expiry or dependency completion condition. Dated read memory has a 24-wall-hour TTL. Persistence therefore favors continuation prose more than structured final error context. This mechanism can amplify both excessive caution and retries. **Confidence:** confirmed controller behavior; its contribution to individual model choices is supported by episodes, not an estimate of hidden reasoning.

### 4. Agent 50's obsolete Farm wait is not explained by lost core building state

At the earlier cutoff, Farm III had completed **26.77 game hours** earlier; both builders were free. Agent 50 nevertheless produced 85 WAIT turns in the previous wall day, with recent continuations referring to Farm progress. It also had fourteen pending incoming introductions. The supplementary latest five turns remain WAIT.

A first-decision reconstruction at the original budget retained **Farm III, both empty builder slots, construction recovery, notes and last intent**, fitting in 22,915 bytes. None of its saved reads passed the actual per-entry 24-hour freshness filter. Authoritative building/builder fields are protected whole by this projection. This makes “the packer removed the completed Farm level” an unsupported explanation for this episode. The supported failure is stale continuation and poor replanning despite packable fresh contradictory facts.

**Confidence:** stale external decision behavior is observed; persistence is confirmed; anchoring on old notes is a supported inference. Actual historical prompts were not captured, and a wait summary can be an inadequate explanation rather than proof of the model's internal belief.

### 5. Conversation tools are available, but the model invents a hybrid name

Agents 38/43 select nonexistent `pact_conversation_read_v2`; supported tools include `pact_conversation_history_v2` and `pact_conversation_read_v1`. The wrong literal occurs in none of the nine inspected deployed controller modules or fifty saved owner guides. The model's read-tool field is an unrestricted string in the decision schema, so provider-valid JSON can name a nonexistent tool. The controller then safely rejects it and supplies actual names.

Correct names are advertised. Initial supplied read schemas cover world, inbox and conversation-read v1; history-v2 requires schema lookup if needed. This is a selection/validation/continuation failure, not evidence that conversation is unavailable. The current traces include further read-name errors, while these accounts also complete valid reads.

**Confidence:** observed invalid selections and confirmed permissive decision schema. Why the model selects the hybrid name is unresolved. Source: Fleet b4ad9db `src/domain.ts`, `engine.ts`, `games/pact/adapter.ts`.

### 6. New receipt loop: Agent 42 substitutes the all-zero UUID

After committing Hall III at 17:04 Berlin, Agent 42 proposed a Storehouse III action which was explicitly rejected FORBIDDEN. Earlier episodes already showed it requesting receipt reads without a command ID. In the supplementary window, it made **nine receipt reads over two hours using `00000000-0000-0000-0000-000000000000`**. This ID matches no retained Fleet command resolution and has no server receipt. There is no pending cohort command requiring its reconciliation.

The read schema accepts the nil UUID as structurally valid. The server correctly returns RECEIPT_NOT_FOUND. Fleet's ordinary model-read branch lets that remote error reach the outer catch, which ends the turn with the generic interrupted/status-check summary. The special receipt recovery path for actual pending commands handles not-found separately; the model's discretionary read does not use that path. The summary is then supplied as next-turn intent, while exact prior command metadata is not automatically supplied. These facts form a concrete self-reinforcing reconciliation loop, without any actual uncertain command being established.

Hall III continued building and completed independently. **Confidence:** exact IDs, absence of matching receipt and repeated sequence verified; the loss of command context is an amplification mechanism, not proof that it alone caused the invented nil ID.

### 7. New trade proposals fail local action-contract validation

Agent 03 selected two supply-offer actions at 17:51 and 18:51 Berlin, describing six-hour exchanges of 10 Grain/hour for 10 Silver/hour with zero notice. Both ended INVALID_GAME_ACTION with zero commitments and no pending command. In this deployed route, `SyntheticOwner.prepare()` validates the vendored action contract before creating a pending command. A shape matching none of the contracts throws this generic error, outside the local read-correction branch, and ends the turn.

Unlike basic construction/contact/message/training actions, the supply-offer schema is not in the five initially supplied action schemas; the supported lookup is `fleet_action_schema`. The decision's action field accepts an arbitrary record, so the outer provider schema does not guarantee a valid game command. **Six hours and zero notice are permitted contract values**; those values alone do not explain the failure. Retained decision telemetry records kind/summary, not the exact pre-validation invalid action object or Ajv field errors. Therefore the particular malformed or missing field cannot be recovered from this evidence.

**Confidence:** observed pre-commit validation failure and source-confirmed loss of actionable detail; exact argument defect unresolved. This updates the earlier social census: there has been one admitted offer and now additional failed offer selections. Sources: Fleet b4ad9db `contracts.ts`, `owner.ts`, `adapter.ts`, `engine.ts`; [supply action schema](../../../packages/contracts/src/schemas.ts).

### 8. New credential block coincides with the separate API restart

Agent 17's 18:10:46 Berlin turn made zero model calls and ended AUTH_REQUIRED. Fleet left it needs_owner /REFRESH_UNCERTAIN, credential state needs_reconnect. Gateway metadata shows **18:10:46.334 Berlin, POST /oauth/token, HTTP 502, upstream connection refused**, immediately after the separately authorized API container started at 18:10:45. The agent's stored access expiry was 18:10:46.080.

The stored refresh token matches a server record which is **unused, unrevoked and expires on 13 November**; its grant is unrevoked. No raw token or hash is included in this report. The broker catches any refresh error, writes needs_reconnect and fences the agent, so it cannot schedule another normal attempt. The timing and unchanged server token show a transient upstream availability failure, not demonstrated token rotation loss or account revocation. Catching the error conservatively protects against genuinely uncertain rotation, but this specific availability episode becomes a persistent execution block.

**Confidence:** block, gateway error and unchanged token record verified; attribution to the restart is strongly supported by the matching subsecond window. No token refresh, reconnect or replay was attempted. Sources: Fleet b4ad9db `credentials.ts`, [OAuth refresh](../../../packages/oauth/src/service.ts).

## Why the social funnel stops before cooperation

The original cutoff had ten message senders, five reciprocal messaging pairs, 32 pending introductions and eighteen contacts. Agent 19 sent 46 of 74 messages; Agent 38 sent eleven. Agent 19's 46 messages to Agent 17 have 46 distinct normalized bodies, so this is concentrated outreach, not exact duplicate-message spam. The forty agents with zero messages and the unanswered introductions establish that the deficit starts before contract settlement.

The only admitted offer was Agent 19 to 17: a one-sided 10-Grain/hour gift for 24 hours, no reciprocal flow or bonds, valid for sixty game minutes. It existed from **13 October 02:41:37 to 03:40:56 Berlin**, about 59.32 wall minutes. Agent 17 had four turns during that window, all one-call WAITs. Its automatic peer reads alternated Agents 38 and 19; it read Agent 19's thread/history at 03:10:47 and 03:40:46. Fleet's consented communication ledger records the recipient observing the open agreement at 03:10:47, before expiry. There are zero signatures.

Thus there was time to respond and controller-side observation. This excludes a pure “recipient had no scheduled opportunity” account. It does **not** establish full offer delivery to the model: automatic peer results exceeding 6 KB become a short notice in the input, and subsequent packing can omit optional observations. The agreement observation ledger and a model-visible actionable offer are different evidence. Historical peer-result sizes/final prompts were not captured, so the precise model-visible offer coverage remains unresolved. There is no activated contract whose settlement or delivery failure can explain the zero-contract result.

The two-decision allowance adds friction: schema lookup plus a read can consume the turn before an action, and first-step attention rotates one contact rather than prioritizing every live agreement. Cross-turn handoff is then essential. But Agent 19's admitted offer and seventy-six actual messages disprove that this allowance makes communication impossible; several ignored-offer turns used only one decision.

Default discovery in server Fleet b4ad9db still queries `pact_play_view_v1` with the cohort name as its search filter. It exposes a rotating page of similar founders rather than automatically using whole-world discovery. Arbitrary supported lookups remain possible. Since 18:10 the shared API offers the separate worldwide-discovery release, but the server adapter was not upgraded by that Windows assignment. Wider API availability is not equivalent to wider default attention in these Luna turns.

## Game incentives and freedom

The game's ordinary growth path does not require communication. All founders have the same production technologies. Farm I produces 30 Grain/hour against eight Home Guard consuming eight, leaving 22 normally or sixteen at 80% harvest. At the earlier cutoff none was hungry and none had trained an ordinary army. No cohort raid, garrison or transfer created dependence on another player. There is little immediate food-supply pressure in this observed state; different development choices can still create valuable resource bottlenecks later. A grain gift is not evidence of a mutually beneficial trade.

[Fortune](../../pact/rules.md#L337) measures ordinary wealth at Iron 1, Silver 2, Grain 0.25, including ordinary-funded installed buildings/units. Construction moves wealth into installed value; productive upgrades increase subsequent income. There is no second bonus for transacting and no direct wealth reward for sending messages. A fair exchange at these weights preserves combined marked wealth immediately, although useful reallocation can accelerate development or reduce overflow. Gifts can raise the recipient's score at the donor's expense. Cosmetic opened-channel achievements establish activity, not a recurring economic reason to negotiate.

[Hall bands](../../pact/rules.md#L353) are comparison filters in one world. They do not pay a promotion bonus or grant protected combat leagues; accumulated Fortune follows the player upward, and delaying promotion is explicitly a tuning risk. Therefore “agents will talk to enter a higher bracket” is not an objective the mechanics automatically enforce. Hall III's unlocks can be valuable, but attaining its band is not a separate payoff.

There is also a **hard authority ceiling beyond Hall III** in the verified original mandates: Hall IV costs 1,260 Iron, already above the entire 1,000-Iron limit even with no spending/reservations. Hall V costs 2,700 and Hall VI 4,500 Iron. Under that ordinary authority, the V–VI band is unreachable; rolling-window relief cannot make a quote larger than the full ceiling fit. This is a configured owner constraint, distinct from the observation bugs and distinct from the now-proven route into III–IV. A separate readback at 19:34:30 Berlin confirmed Agent 42 at Hall III and all fifty mandate versions/resource limits unchanged from the original snapshot.

Profile goals are broad personality instructions, not a shared measured objective to maximize Fortune, reach Hall III or cooperate profitably. Expansionists seek territory although Season One does not provide a conventional territory-expansion map. Diplomats seek institutions while Court lifecycle/publication and other political routes are human-gated under this cohort's authority. Courts grant no implicit treasury, troops, private intelligence or command permissions. There is freedom to negotiate economic obligations, but not unrestricted autonomous political institution-building.

At the earlier cutoff the ten diplomats produced fifty messages and fourteen upgrades; ten opportunists produced zero messages and 121 upgrades. This shows materially different observed play, not a randomized estimate of profile effects or proof that communication reduces growth. Identical early technologies, low scarcity, weakly specified goals and a filtered counterpart sample support a cautious solo baseline. They do not establish that no profitable cooperative strategy exists.

## Evidence boundaries and unresolved attribution

This report combines 71,918 retained consented historical events through the original 17:17 cutoff, frozen game/Fleet snapshots and owner projections, deployed module hashes, deterministic quota/packing/quote diagnostics, and supplementary consented traces through **19:24:45 Berlin**. Historical telemetry starts after launch. It stores decisions, outcome metadata and delivered-field coverage, not full historical prompts or invalid pre-validation action objects. Claims about what the model internally believed, or how it would behave under a different policy, are not supported.

The forecast and authority mechanisms are reproduced. The receipt and credential episodes add newly traced blockers. Stale-note salience, full historical offer visibility and the exact invalid supply-action field remain unresolved. Incentive conclusions follow the written engine economics and observed state; quantifying the behavioral contribution of each would require evidence beyond this observational run. No single bug explains every one of the fifty accounts, and feasible upgrades alone do not prove conserving resources is irrational.

Raw snapshots, correspondence, notes, credential-derived metadata and diagnostics remain outside Git in the restricted `C:\Users\ENDORFY\PACT-Investigation\2026-10-14` directory. Only this sanitized report and its index entry are committed. Accounts, mandates, model budgets, schedules, unknown allocations, live commands and configuration were preserved. No fixes, deployment, inference calls, gameplay actions, cancellation, reconnect or roadmap task were performed by this investigation.

Documentation verification: numerical assertions reconciled against frozen/new evidence, source links resolved, and deterministic packing/historical admission diagnostics passed. The staged documentation whitespace check passed. Backlog consistency passed for 170 unique tickets, acyclic dependencies, 37 release criteria and six views. These documentation checks do not certify corrected runtime behavior.
