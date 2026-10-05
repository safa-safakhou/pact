# Backend population playtest — final report, 4 October 2026

**Complete.** The authorized experiment ran from **21:13:59.742 to 23:13:59.742 UTC** (ending 5 October at 01:13:59 Berlin). The runner recorded completion at 23:13:59.959 UTC and its container exited successfully. No action was requested after the deadline. All 100 original kingdoms were retained; exactly **200/200 actual model requests** were used.

**Assessment:** the tested development, messaging and trade loop works with this synthetic population. All ten Luna agents established at least one real contract. The experiment also exposed real bugs, now fixed, and a weaker human-facing layer: agents still sometimes explain ordinary state transitions as contradictions, while later play often becomes waiting. This is bounded functional evidence, not human enjoyment or production certification.

## Final results at the original deadline

The database check reconstructs the deadline using committed world ticks and cohort-only game-time records. It excludes later settlements even though the shared game continues running.

| Measure | Result |
|---|---:|
| Distinct simulated owners / kingdoms | 100 / 100 |
| Luna envoys / deterministic bots | 10 / 90 |
| Actual model requests / local successes | 200 / 200 |
| Unique requested commands | 2,465 |
| Unique committed commands | 2,321 |
| Accepted contact pairs | 180 |
| Sent messages | 891 |
| Offers / counteroffers / signature commands | 272 / 4 / 405 |
| Contracts activated | 131 |
| Naturally expired / still active at deadline | 64 / 67 |
| Delivery installments, counting each direction separately | 12,312 |
| Failed installments / overflow | 0 / 0 |
| Building instructions / completed / still underway | 389 / 388 / 1 |
| Normal committed ticks / game minutes advanced | 120 / 120 |
| Actors blocked at completion | 0 |

Delivery totals were **199.95 iron, 301.8 grain and 113.85 silver**, in whole resources, equal to every installment amount due by the deadline. All 131 contracts had delivery records. For example, an early Farmer 03 / Merchant 02 contract completed sixty installments in each direction, exchanging three whole grain for three whole iron before natural expiry.

Committed command ownership matters: **84 came from Luna decisions, 2,057 from deterministic bots and 180 from the separately labelled simulated-human contact acceptance controller**. The LLM did not impersonate the human to accept contacts. The 90 scripts generated zero model jobs.

Evidence: [final audit](evidence/population-final-audit-20261004.json), [historical database cutoff](evidence/population-final-db-20261004.json), [command/model reconciliation](evidence/population-final-reconciliation-20261004.json).

## Ten separate Luna players

Each retained its own account, kingdom, grant, observations, persona and memory. All reached scheduled wave 10, with zero current consecutive failures. Bots finished with round counters 43–44; restarts and serial pacing mean these counters are not uniform turn counts.

| Player | Committed agent actions | Contracts entered |
|---|---:|---:|
| Ada Byte | 8 | 1 |
| Captain Noodle | 7 | 1 |
| Moss Compiler | 7 | 1 |
| Lady Segfault | 11 | 1 |
| Professor Goose | 9 | 2 |
| Pixel Paladin | 10 | 1 |
| Null Wizard | 6 | 1 |
| Ruby Goblin | 8 | 1 |
| Dr Turnip | 6 | 1 |
| Orbit Duck | 12 | 1 |

These eleven Luna-participating contracts were with scripted counterparties; the remaining 120 contracts were between scripts. The agents made 29 building queues, one cold contact request, 37 messages, three offers, three counteroffers and eleven signatures. The scripts supplied much of the incoming social activity, so the experiment does not establish that an isolated agent would discover a lively community unaided.

Captain Noodle's counteroffer is a useful positive case: it read Miner 22's actual version-1 proposal, changed its offered resource while preserving the parties and rates, committed version 2, and correctly explained that both signatures were still needed. [Exact plan, action, receipt and report](evidence/population-wave7-noodle-20261004.json).

## Budget and response reconciliation

Actual usage: **2,969,767 input tokens, including 1,528,064 cached input tokens, and 53,205 output tokens**. Cached input is a subset, not an additional input total. All 200 observed upstream responses were HTTP 200 and all 200 local jobs completed successfully. This used the existing local Codex subscription; no dollar cost was supplied, so no price is inferred.

The server consumed **197 model results: 99 plans and 98 reports**. Three locally successful outputs were not consumed during early harness disruption: Lady Segfault's first plan completed during the startup interruption; Pixel Paladin's first report and Dr Turnip's first plan arrived after their recorded timeouts. IDs and timestamps are reconciled in the evidence. Lady Segfault therefore used 21 requests, Dr Turnip 19, and each other player 20. These are included in the 200 cap; no replacement requests were added afterward.

The final model response completed at 23:05:49 UTC. The idle local worker was subsequently stopped cleanly at 23:28:44 UTC during evidence collection. Its budget remained 200. [Complete usage and job IDs](evidence/population-model-capped-20261004.json).

## Rejections, repairs and reliability

The 2,465 unique command IDs reconcile exactly to **2,321 commits, 32 pre-patch WORLD_PAUSED outcomes and 112 explicit denials**. Denials were 103 INVALID_COMMAND, five TICK_PENDING, two INSUFFICIENT_STOCK, one FORBIDDEN and one SLOT_BUSY. Many early INVALID_COMMAND responses hid full contact queues; the old code did not preserve enough detail to retrospectively classify all 103 with certainty. The new tick-pending code was exercised live five times and correctly reported that no receipt existed.

There were **182 historical turn failures**, all during startup: 90 missing MCP results, 90 orphaned write-lease conflicts and two model-result timeouts. These were repaired and preserved in the logs. No new turn failure occurred after 21:17:56 UTC. Three initially uncertain commands were reconciled using their original IDs; no actor remained blocked and no extra committed command was inferred from an absent receipt.

Owner-authorized fixes deployed at 22:21–22:24 UTC corrected unread queues that never cleared, misleading tick/queue errors, false committed outcome labels, mixed unit presentation and unclear mandate mappings. Message acknowledgment respects incoming ownership, omitted bodies and individual/aggregate response limits. **80 targeted tests** passed, typecheck and affected builds passed, and all 26 frozen published v1 schemas stayed unchanged. The rules worker was not restarted; normal ticks continued. The runner resumed the same population after both brief deployments.

These interventions divide the run into different versions. Improvement after a fix is descriptive evidence, not a controlled causal measurement. [Deployment/live verification](evidence/population-hotfix-20261004.json).

## Explanation quality and game-design findings

The agents can read stock, start construction, negotiate versioned proposals, sign real contracts and distinguish many active/completed states. Later samples correctly state whole-unit costs and delivered quantities. However, an agent report should not yet be treated as an infallible explanation of the game.

Three concrete weaknesses remain:

1. **Before/after confusion.** Orbit Duck signed exactly the offer ID it planned, but its report suggested a mismatch because that offer had correctly disappeared from the after-state open-offer list. Dr Turnip treated a build changing from affordable to busy as a discrepancy. A one-minute reduction in remaining time was also called confusing.
2. **Waiting dominates later turns.** Six of ten final Luna plans chose no action, usually waiting for stock or an existing contract to end. The other four mostly discussed future trades. This peaceful test has limited immediate choices once early upgrades are done; it does not prove humans are bored.
3. **Much social activity is fixture-driven.** Bots follow fixed reciprocal policies and the synthetic human controller accepts cohort requests. Their activity proves system interactions work, but not natural friendship, emotional attachment, trust or a satisfying human multiplayer community.

The smallest next improvements suggested by this evidence are a factual before/action/after explanation with resolved offer-to-contract IDs; permission for the report to say “no confusion”; and an explicit next useful event/time with optional notification. A separate short human playtest should judge whether waiting and negotiation feel worthwhile. These are recommendations only: no new roadmap implementation, economy change or Linear ticket was started.

## Completion and evidence retention

The experiment runner exited with code 0. The API and ordinary game workers remain running; existing game contracts can continue settling after the experiment. Their later outcomes are outside the reported deadline. No population was deleted or recreated, no budget increased, and no test duration extended.

Credential-free full event/model logs, final safe status and budget are archived at `C:/Users/ENDORFY/pact-population-20261004/final-evidence`. [SHA-256 manifest](evidence/population-final-log-manifest-20261004.json). Original server logs and synthetic job inputs remain under `/srv/pact/state/population-20261004`. Private state and Codex auth are excluded. Earlier chronological checkpoints below are historical and superseded by this final result.

Linear remains at its free issue limit. No issues were deleted, no upgrade purchased and no deferred production tasks reopened. The findings were delivered and heartbeat `observe-pact-population-playtest` was confirmed **PAUSED**. No follow-up run is scheduled by this experiment.

---

## Historical observations and repair chronology

## Scope and evidence so far

100 distinct guest accounts and 100 distinct kingdoms were created through the public API, each with a separate agent grant. No database population bypass, free resources or accelerated live ticks. All 90 scripted players attempted the first round. Real Luna calls are returning successfully through the local Codex subscription; the first wave reached all ten personas, although harness restarts interrupted two jobs/reports. Do not describe those interrupted turns as complete.

The experiment is bounded peaceful development, contact, negotiation and supply contracting. It does not validate the whole combat/politics game or production readiness. Separate synthetic-human contact acceptance is part of the fixture, not evidence that an LLM can accept as the human.

Initial observations:
- Luna chose different strategies: mine/farm construction versus waiting for ordinary silver to contact neighbours.
- The first reports correctly distinguished an active upgrade from a completed building in several cases.
- Several reports nevertheless confused internal marked-unit charges with whole costs, or mislabelled rates. Example: 30,000 marked iron means 50 whole iron; reports described an unexplained cost discrepancy. The experiment briefing now supplies the server's existing whole-unit facts and explicit whole-unit receipt charges. Later reports must verify whether this improves comprehension.
- One envoy tried messaging a non-contact. The server rejected it. This remains a real model planning failure.
- The first harness version lost structured/text-only error distinctions and treated certain rejections as uncertain commands. It now retains denial codes and reconciles/retries only the original command ID.
- MCP session closure sent JSON content type with an empty DELETE body, which Fastify rejected. This left leases open and caused subsequent `RUN_ALREADY_ACTIVE` errors. The harness and reusable baseline MCP adapter now send a valid empty JSON object. A real Fastify regression test covers the failure. Operator recovery closed 280 orphaned synthetic sessions through their own grants after a read-only cohort-scoped session lookup; no database writes or game-rule bypass.
- Original failed/interrupted attempts remain in logs. Startup rows repeat for the same identities, so use unique IDs. Several short harness restarts occurred during the opening minutes; the original two-hour deadline and cumulative budget were preserved.
- The first-wave report prompts predate normalized briefing, so their unit confusion is retained rather than rewritten.

## Checks completed

- Population harness: **11 tests passed** covering budget persistence/deadline, MCP denial vs receipt distinction, stock/contacts, cohort restriction, stale signatures, unsafe offers, observed-version counteroffers and whole-unit presentation.
- Existing baseline unit suite: **10 passed**, including a real HTTP/Fastify session-close regression.
- Existing baseline database integration: **1 passed, 1 optional local-model test skipped**. The passing comparison used fake-provider inference, not paid model calls.
- Typecheck and diff whitespace checks passed.
- Targeted Biome checks passed after formatting the new scripts.
- Live evidence includes genuine successful Luna provider HTTP responses and committed normal construction commands.

## Observed checkpoint — 21:28:22 UTC

All 100 players had owner-bound observations. There were **375 unique committed commands**: 279 building queues, 84 contact requests, 10 separately labelled human contact answers and two messages. Ten contact pairs were observed. No active supply contracts were observed yet; their absence at this checkpoint is not a completed-run conclusion. Scripted players generated zero model jobs. No actor was blocked at the checkpoint.

The second wave demonstrates both improvement and remaining errors. Ada's human report correctly described the completed mine and noticed its own planner had wrongly claimed construction was not authorized. The actual prompt included a Farm II example and a mandate granting building.queue. Another envoy incorrectly inferred that making a nonbinding supply offer needed an explicit supply.offer mandate grant. Captain Noodle successfully sent a cold request and accurately reported the two-whole-Silver charge; its explanation still contained unnecessary contradictory language about empty social lists. These are comprehension/reliability findings, not proof that the backend denied valid actions.

Some cold requests met the receiver's existing eight-pending-request limit. Source inspection explains the CONTACT_QUEUE_FULL condition, but the public dispatcher reports INVALID_COMMAND in these samples. That vague error is a concrete usability problem for agents; logs retain the actual rejection. The experiment has not changed that game limit.

All seven game application services remained running with zero restarts at the checkpoint. Harness container restarts are separately documented above.

Evidence: [initial audit](evidence/population-initial-20261004.json), [initial real-model usage](evidence/population-model-initial-20261004.json). Counts will increase while the run continues.

## Second-wave verification — approximately 21:31 UTC

All ten Luna actors reached wave 2 and have zero current consecutive turn failures; none is blocked. The run has queued 40 model jobs so far. Later reports correctly stated a mine charge as **50 iron and 25 silver** and a market charge as **40 iron and 30 silver**. Bots continued through rounds 8–9, with more than 400 committed commands recorded overall.

Three commands returned WORLD_PAUSED during this period. A read-only world-clock check showed the world **active**, sequence 12734, a current heartbeat and no suspension reason. Source inspection shows the dispatcher also maps temporary tick-pending admission to WORLD_PAUSED. Do not report these three receipts as a sustained world outage; the ambiguous status is another concrete agent-facing finding.

## Scheduled observation — 21:41 UTC

The experiment has reached real trade activity: **25 distinct active contracts observed**, 133 accepted contact pairs, 97 committed offer commands and 93 committed signatures. There are **1,034 unique committed commands** overall, including 247 messages. Bounded conversation reads have observed 119 distinct messages; that is a sample, not the complete sent-message count.

Normal settlements are occurring. For example, Sim Merchant 02 and Sim Farmer 03 have both signed a one-hour exchange of 3 iron/hour for 3 grain/hour; their owner views show three installments in each direction, 90 marked units (0.15 whole) delivered per direction, with no failed installments in that sample. This verifies actual delivery rather than merely proposal/signature text.

No actor is blocked. All 90 scripts reached round 12; Luna wave 3 is progressing. The local upstream counter was **55 of 200** at the check; scripted model jobs remain zero. No new turn failures have appeared since the opening harness repairs. The original deadline is unchanged.

Luna remains more hesitant than the scripted population. Null Wizard sent a clarification message about an already explicit, counterpart-signed offer instead of signing it, and accurately reported that no contract was active. Pixel Paladin waited for a concrete trade need. These are observations of simulated strategy, not evidence of player satisfaction. The ten Luna players' most recent owner observations in this snapshot show no supply contracts yet; the observed active contracts are between scripted kingdoms.

Evidence: [21:41 audit](evidence/population-checkpoint-2141-20261004.json). Continue observing through the original deadline; do not pause the heartbeat yet.

## Scheduled observation — 22:01 UTC

**The first Luna-to-bot trade is active and delivering.** Captain Noodle and Sim Farmer 12 both signed offer version 1 for 3 iron/hour from Noodle in return for 3 grain/hour. Noodle's latest collected owner view records twelve installments in each direction, 360 marked units (0.6 whole) delivered each way, and zero failed installments. The agent's report correctly identifies Farmer 12 as the actual contract partner while distinguishing a separate message to Farmer 72. Its report still uses marked totals from the consequence projection, showing normalization does not yet cover every nested quantity.

Across the cohort: **1,847 unique committed commands**, including 707 messages, 172 offers, 234 signatures and three counteroffers. There are 169 observed contact pairs and 60 distinct contracts observed active across accumulated snapshots. Latest collected consequence views show deliveries on 59 of those contracts and no failed installments; one had no delivered installment in its captured view yet.

All ten Luna actors reached wave 4 with zero current consecutive failures; all 90 scripts reached round 19. No actor is blocked and no new turn failure has appeared since the startup repairs. Actual local model requests: **80/200**, all observed upstream responses HTTP 200. Server result counts are lower because startup-interrupted jobs were not all consumed by the runner; do not misclassify those as provider failures.

Nine Luna players still have no contract in their latest observations. Permission confusion persists: Professor Goose's planner incorrectly claimed supply.sign was disallowed, while its report correctly pointed out that the mandate permits it. Several reports refer to whole balances versus marked reserve floors or delivery totals inconsistently. Preserve these observations for the final agent-briefing recommendations instead of forcing decisions or changing the experiment midstream.

Evidence: [22:01 audit](evidence/population-checkpoint-2201-20261004.json), [actual model usage](evidence/population-model-2201-20261004.json). The run continues to 23:13:59 UTC with its original cap and population.

## Authorized live bug fixes — 22:21–22:24 UTC

The owner explicitly asked to fix obvious observed bugs immediately. The API and inference worker now run `pact-runtime:population-fixes-20261005-2`. The first patch became healthy at 22:21:38 UTC; a follow-up protecting aggregate initial conversation context became healthy at 22:24:19 UTC. These are interventions during the experiment: compare observations before and after them rather than treating the whole run as an unchanged baseline.

- **Unread queues never cleared:** conversation reads previously never acknowledged messages, so four unread messages could permanently block another send even when the recipient kept reading. Owner-bound reads now acknowledge only incoming message IDs whose bodies fit the delivered page; unread messages are prioritized. Outgoing messages, other owners, guide-only metadata reads and omitted bodies do not clear unread state. Human social responses acknowledge the incoming bodies they return. Initial in-app excerpts allocate the total context budget before acknowledgment, including JSON escaping.
- **False world outage:** temporary tick-pending admission now returns `TICK_PENDING` with retry advice; a genuinely paused world retains `WORLD_PAUSED`. The human command HTTP response uses 409. No tick or resource rule changed.
- **Vague social failures:** `CONTACT_QUEUE_FULL`, `MESSAGE_QUEUE_FULL`, `REQUEST_EXISTS` and `ALREADY_CONTACT` now survive dispatch with actionable recovery text. Blocks remain generic forbidden responses. Existing inbox limits remain enforced.
- **Misleading outcome summaries:** rejected in-app command results now say `not_committed`; dispatcher exceptions explicitly report `receiptExists:false`. The experiment's human-command adapter now recognizes top-level error codes.
- **Unit and permission confusion:** the common agent guide now supplies exact whole resource limits/reserve floors, explicit action-to-mandate permission flags, and the distinction between nonbinding offers and signature authority. The experiment briefing converts nested marked delivery/reserve amounts with the shared game formatter. Models still choose their own actions; explanations are not guaranteed accurate.

Verification: **44 database integration tests, 23 targeted unit tests, 13 population-harness tests** passed across the affected suites. Typecheck, affected package/API/inference builds, selected Biome checks and diff checks passed. All **26 frozen published v1 schemas remain unchanged**. The runtime overlay was built from the existing deployed image with only selected changed source/compiled files; local and VPS lockfile/Dockerfile hashes matched. Rollback images and pre-patch source remain on the VPS.

Only API and inference were recreated. The rules worker's container ID, start time and restart count are byte-for-byte unchanged. The population runner was gracefully interrupted and resumed twice between Luna waves; the same 100 kingdoms, original deadline and persistent request counter remain. No migrations, stock edits, model-worker restart, new identities or increased cap were used.

Live check at 22:24 UTC: world active, tick sequence **12,788**, no suspension reason; **726 of 835 cohort messages acknowledged**; 126 subsequent owner observations and three committed actions captured after the first patch, with no new turn failures in that interval. A live guide shows the grain floor as **20 whole**, and all four configured action permissions correctly true. All ten Luna actors completed wave 6 before deployment; local actual model usage remained **120/200**. This short post-patch interval verifies deployment/read behavior, not sustained model improvement or real human enjoyment.

Evidence: [pre-patch audit](evidence/population-pre-hotfix-20261004.json), [post-patch audit](evidence/population-post-hotfix-20261004.json), [deployment and live checks](evidence/population-hotfix-20261004.json). The final report must include these interventions and examine later Luna waves separately.

## Post-fix observation — 22:27 UTC

The seventh Luna wave is progressing normally. Captain Noodle successfully countered an observed Miner 22 offer from version 1 to version 2, changing its outgoing resource from silver to grain while preserving the A/B directions and 3/hour reciprocal rates. The receipt records only the versioned offer; its report correctly says signatures were reset and the new trade is not active. This is a concrete model-driven negotiation, not a scripted action. Its older Farmer 12 contract continues delivering independently. Do not attribute this behavior solely to the fixes; there is no control group.

The same report still overstates uncertainty about a historical Farmer 72 conversation: the planner explicitly said it was absent from the current snapshot, while the reporter treated its absence as a possible plan discrepancy. Ada's report correctly converts 720 marked delivery units to 1.2 whole, but unnecessarily treats ordinary waiting as something requiring a committed action. These are remaining explanation-quality issues, not failed game commands.

At the 22:27:25 audit there were **2,020 unique committed commands**, 180 observed contact pairs, 181 observed offers and 66 distinct contracts observed active across collected snapshots. All 100 existing players have observations; scripted model jobs remain zero. No new turn failures have occurred since the startup repairs, and no post-fix uncertain commands or denials were seen in the inspected interval. The live status showed all Luna players through wave 6, the first two through wave 7, and bots in rounds 27–28.

Local usage during this checkpoint reached **129/200 actual model requests**, all 129 observed provider statuses HTTP 200; 128 jobs had completed and one was still in progress. The fixed deadline remains 23:13:59 UTC. No changes, restarts or extra model calls were made by this observation.

Evidence: [checkpoint audit](evidence/population-checkpoint-2227-20261004.json), [Noodle plan/action/receipt/report chain](evidence/population-wave7-noodle-20261004.json). Continue observation; final results are still pending.

## Natural contract completion — 22:47 UTC

Contracts have now completed their full lifecycle under normal ticks. Latest accumulated consequence records contain **30 naturally expired contracts**, each sample retained in the settlement evidence, plus 99 still marked active in their latest captured views. No failed installments appear across those 129 distinct observed contracts. A concrete completed example is Sim Farmer 03's exchange with Sim Merchant 02: **60 installments in each direction, 1,800 marked units = 3 whole iron received and 3 whole grain sent**, then `natural_expiry`. These are sampled owner projections, not a simultaneous database census.

The cumulative audit records **2,293 unique committed commands**: 388 building queues, 180 contact requests, 180 human-controller acceptances, 869 messages, 270 offers, 402 signatures and four counteroffers. All ten Luna actors reached wave 8, with zero current failures; all 90 bots are progressing through rounds 34–35. Model usage is **160/200**, all 160 upstream responses HTTP 200 and all local jobs completed. No new turn failures have occurred since 21:17:56 UTC.

The new admission error has now been exercised live: five scripted actions received `TICK_PENDING` with `receiptExists:false`, instead of a false paused-world receipt. No new WORLD_PAUSED receipts appeared after the patch. These waits are retained as denied attempts; the harness does not mislabel them committed.

Orbit Duck signed a concrete Merchant 80 offer and received an active-contract receipt. Its subsequent report correctly identifies the activated contract, but invents a possible mismatch because that offer is absent from the *after-action* open-offer list. The planned offer ID and committed offer ID are identical. Likewise, Dr Turnip accurately explains a queued market build but calls the expected transition from affordable to busy a confusion. This points to weak before/after interpretation in the reporting model; it is not evidence that the dispatcher chose the wrong offer. Preserve this as an explanation-quality finding rather than changing valid game outcomes.

The audit's per-actor latest `observation` is taken before the actor's actions, so it can lag a newly signed contract (Orbit is an example). Final analysis must reconcile receipts, post-action report facts and the stored model-job inputs rather than treating that older projection as current absence.

Evidence: [22:47 audit](evidence/population-checkpoint-2247-20261004.json), [expired settlements and Orbit plan/receipt/report](evidence/population-settlements-2247-20261004.json), [local model counter](evidence/population-model-2247-20261004.json). No code/deployment changes were necessary at this checkpoint. The original end remains 23:13:59 UTC.

## Model cap reached — 23:07 UTC

All ten Luna actors reached their tenth scheduled wave. The local worker completed exactly **200 actual upstream requests**, all HTTP 200 and all locally successful; the final model response finished at 23:05:49 UTC. The durable budget is **200/200**. No further model calls are authorized or needed. The runner also reached 200 jobs; its Luna loop has ended, while the 90 scripted bots continue toward the unchanged 23:13:59 UTC deadline. Their current rounds are 41–42. Neither the population nor its clock was restarted.

The audit now shows **2,314 committed commands**, 131 distinct contracts observed active over time, and latest accumulated contract projections containing **64 naturally expired and 67 active** contracts, with no failed installments. No new denied/uncertain commands or turn failures appeared since the previous checkpoint. These are still pre-deadline observations, not final totals.

The final Luna plans expose a pacing limitation: **six of ten choose no action**, mainly waiting for production or a contract to end; the other four propose or discuss future trades. This is evidence of limited immediate choices in this narrow peaceful scenario, not proof of human boredom. Reports remain broadly grounded in stock/contract facts but still sometimes present normal one-minute changes or stale proposal references as confusing.

The local model evidence includes all 200 job IDs, per-actor counts and token totals. The runner consumed 197 model results and logged 98 human reports; early startup-interrupted responses account for a discrepancy that final analysis must explicitly reconcile. Do not call these missing consumed results provider failures: local completion succeeded.

Evidence: [23:07 audit](evidence/population-checkpoint-2307-20261004.json), [late-run plans and settlements](evidence/population-late-run-2307-20261004.json), [capped model usage](evidence/population-model-capped-20261004.json). Leave the heartbeat active until the actual deadline has passed and final findings are delivered.

## Original follow-up requirements (completed above)

After the fixed deadline, collect safe status/events and local model usage; report unique actors active, decisions and successful/rejected commands, model request/token counts, contacts, messages, proposals/counteroffers, both-signed contracts, real delivery settlements, building completion and game-clock progression. Inspect samples of later whole-unit reports for factual accuracy. Identify inactive/stuck players and any unexplained missing responses. Separate game problems, model mistakes and harness failures. A synthetic model's reason-to-return text is not evidence a human found it fun.

Paths and exact operating instructions: [population experiment](../../operations/population-playtest.md). Heartbeat `observe-pact-population-playtest` will observe and complete this report, then pause itself. The Windows computer must stay awake for subsequent Luna calls; bots run on the VPS independently.

## Tracking

Linear issue creation was attempted and rejected because the workspace has reached its free issue limit. No issue was created, no old issue was deleted, and the 24 deferred production tasks remain untouched. This report is the current execution record.
