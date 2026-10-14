# Fifty Luna agents gameplay and remaining blockers

**Review date:** 14 October 2026. **Behavioral cutoff:** 17:17:52 Berlin; Fleet/game repeatable-read snapshots were 0.9 seconds apart. **Closing live check:** 17:47:38 Berlin. The original cohort is operational, but most turns still produce no gameplay commitment. Communication has expanded since 12 October; it remains concentrated and has produced no contract. Two substantiated controller/API defects are the hidden remaining spending authority and loss of requested forecast information. Neither server health nor a green scheduler state establishes competent play.

## Current stage and progress over two days

The original 50 account/kingdom bindings match the 12 October baseline. This is the same `gpt-6-luna`, medium reasoning, continuous cohort: fifteen-minute staggered turns, serial inference, two model decisions and two actions per turn. Its original anchor is 12 October at 15:20:56.733 Berlin. Fifty game accounts share one Codex subscription route. Fleet is still `b4ad9db`; newer discovery/cognition/controller source in the sibling checkout must not be assumed deployed. The optional cognition/Laya feature is not enabled for this server cohort.

| Measure | 12 October 22:16 baseline | 14 October 17:17 behavior cutoff | 14 October 17:47 closing world |
| --- | --- | --- | --- |
| Hall I /II /III+ | 48 /2 /0 | 13 /37 /0 | **12 /38 /0** |
| Completed building upgrades | 148 | 369 | **370** |
| Contact relationships | 7 | 18 | **18** |
| Unique messages | 7 | 74 | **76** |
| Supply contracts | 0 | 0 | **0** |

All remain in the I–II comparison band. Agent 42 has **Hall III actively building**, with 113 game minutes left at the behavioral cutoff; it was still active at closing. Agent 18 finished Hall II during the review. Agents 26 and 36 have active Market III and Storehouse III construction. These are real progress and legitimate waits. All five previously recovered construction deadlocks remain cleared; there are no current two-waiting-slot prerequisite deadlocks.

At the closing check all fifty agents were ready, the cohort running, no original-cohort command pending, and both historical unknown allocations intact. All fifty credential records were ready at the behavioral cutoff. Game clock active; tick 24,851, healthy database/API, 26% disk use and approximately 57.7 GB free. The historical pilot's separate unresolved command is outside this cohort. Other populations and the local comparison are excluded from the behavioral totals.

### Recorded activity

At 17:17 there were **8,073 finished turns**, two preserved reviewed interruption turns and one running turn; **522 recorded committed actions**, **11,358 reported executions**, and **179,942,841 reported input/output tokens**. The two unknown allocations retain 80,000 reserved tokens separately. There were 577 owner-scoped game receipts; receipts include setup/owner work and are not interchangeable with finished turns or completed upgrades.

| Berlin window | Finished turns | Committed actions | Agents with commitments | Finished turns with no action |
| --- | ---: | ---: | ---: | ---: |
| 12 October | 1,361 | 218 | 42 | 85.5% |
| 13 October | 3,805 | 209 | 41 | 95.3% |
| 14 October through 17:17 | 2,907 | 95 | 33 | 96.8% |
| Last 24 hours through 17:17 | 4,248 | 137 | 37 | 96.9% |
| Last 4 hours through 17:17 | 308 | 6 | 6 | 98.1% |
| After archive maintenance, 17:02–17:17 | 55 | 3 | 3 | 94.5% |

The last four hours include the disk outage and maintenance, so they are not a clean policy comparison. Even the first post-maintenance round produced only three commitments in 55 finished turns; that is a short observation, not an estimate of long-term performance. Lifetime usage averages about **344,718 reported tokens per recorded commitment**, with useful reads/waits included in that denominator.

The state shows 380 construction instructions: 369 completed, five cancelled during the approved earlier recovery, four active and two waiting. No agent is hungry. All fifty armies contain only their eight Home Guard; there is no original-cohort training, raid, garrison or transfer. The scout records touching these kingdoms are **outside players scouting them**, not Luna agents conducting missions. There are no cohort Court memberships or Court owners. At the supplementary achievement read, 44 accounts had first-stone awards and seven had opened-channel awards; these asynchronous awards are not progression requirements.

## Who is actually stuck

The [all-fifty roster](fleet-agent-roster-20261014.md) records each account's buildings, queues, commitments, messages and follow-up classification. The classifications below use the fixed 17:17 cutoff and separate demonstrated defects from valid waits and strategy choices.

| Group | Accounts and evidence | Concrete next step |
| --- | --- | --- |
| Confirmed observation loop | **08:** 164 finished turns, zero lifetime actions, all buildings I, two free builders, 600 Iron and approximately 495 Silver. It repeatedly requests a 60-minute forecast; recent delivered feedback explicitly omits `forecast`. | Preserve the requested forecast in a compact semantic projection, or return a usable alternative. Test the real feedback path and stop identical read retries that cannot reveal new information. No forced gameplay action is required. |
| Prerequisite and permission reservation stall | **02:** Farm IV has waited 612 game minutes for Hall III. Its reserved 280 Iron plus recent spending leaves only 180 of its 1,000-Iron authority limit; Hall III needs 540. Stock is sufficient, a slot is free, but permission is not. | Expose remaining authority and its expiry. Plan the Hall prerequisite within the full reservation budget. Any cancellation of this exact waiting job still requires its proper owner authority. |
| Valid resource wait with futile parallel retries | **32:** Hall III is queued, prerequisites met, but Silver is about 238 against the required 270. Its Hall reservation leaves only 100 Iron authority; repeated Storehouse III proposals need 180 and are denied. | Wait for the queued Hall's stock condition; suppress the known unauthorizable parallel quote until allowance changes. Do not call this a missing-prerequisite deadlock. |
| Social read errors and partial observations | **38 and 43:** repeat reads and sometimes request nonexistent `pact_conversation_read_v2`; the supported names are `pact_conversation_history_v2` and `pact_conversation_read_v1`. They also have valid exchanges, so the failure is intermittent. | Supply/retain the exact supported conversation schema and useful contract/message fields; carry correction across turns. Test the conversation flow within the two-decision allowance. |
| Stale continuation | **50:** 29.45 hours since a commitment; repeatedly waits for Farm III although it is completed and no build is active. It has 14 pending incoming requests and legal development choices. | Invalidate the old build-wait intention against fresh state; check that pending requests reach the packed input. Evaluate an allowed response without assuming every request should be accepted. |
| Genuine progress | **18, 26, 36, 42:** active construction at the cutoff; 18 subsequently completed Hall II and 42 is progressing toward the next band. | Continue observing normal completion; no recovery action indicated. |
| Permitted but inactive | **31 other accounts** have a free slot and at least one stock/prerequisite/authority-feasible upgrade but committed nothing in the last four hours. | Inspect the stated objective, stale notes and useful choices. Feasibility does not prove an upgrade is optimal or that conserving is a bug. |
| Resource or authority waiting | **Nine accounts** have no upgrade meeting all of those checks at the cutoff. | Show the limiting stock/quota and forecast its release. Compare against the desired strategy before labeling them stuck. |

The 31 permitted-but-inactive accounts are 01, 04, 07, 09, 11, 12, 13, 14, 16, 17, 19, 21, 22, 23, 24, 27, 28, 29, 30, 31, 33, 34, 37, 39, 41, 44, 46, 47, 48, 49, 50. Accounts 08, 38 and 43 also have feasible upgrades but are classified separately because their observed read loops are more specific. Account 50 is included among the 31. These groups account for all fifty together with the two waiting-job cases, four active builders, nine resource/authority waits and Agent 03 with a recent commitment.

## Confirmed remaining defects and observed planning failures

### Remaining spending authority is hidden and the refusal loses its cause

Each current mandate limits Iron and Silver authority to **1,000 whole units**. Admission counts legacy exposure, rolling spending over **24 game hours**, outstanding reservations and the proposed quote. Stock, founding allowance and permission to spend are distinct. The limit is an existing owner constraint, not an engine corruption or something to bypass.

All **106 retained `FORBIDDEN` building resolutions** at the cutoff, across thirteen accounts, reproduce an Iron permission shortfall when replayed against the retained spend/commitment records and the committed game tick at the rejection time. For example, Agents 35/40 had 780 Iron spent and only 220 authority remaining; Hall III costs 540. Agent 32 had 360 spent plus 540 reserved, leaving 100; Storehouse III costs 180. A current stock-affordability check cannot answer that permission question.

The API maps `ExposureError`, including `INSUFFICIENT_ALLOWANCE`, to generic `FORBIDDEN`. The guide exposes the ceiling and stock checks without a current rolling balance/release schedule; Fleet advertises the authorized action family but does not preflight that remaining quota. This combination produces opaque refusals and repeated unauthorizable proposals. Of the last 24 hours' finished turns, 105 ended `FORBIDDEN`; some of those turns committed an earlier action, so they are not all no-action turns. [Enforcement](../../../packages/authority/src/exposure.ts#L229), [lost error specificity](../../../packages/application/src/game-command-handler.ts#L522), [stock-only guidance](../../../packages/application/src/agent-guide.ts#L248).

**Acceptance for a fix:** expose legacy/rolling/reserved/remaining amounts and the next game-time release; preserve a specific quota refusal reason through API/MCP/Fleet; keep the owner ceiling unchanged; verify the Agent 02 and 32 reservation cases and a successful within-limit quote in isolated fixtures.

**There is also a hard progression ceiling under the present mandates.** A pure quote check against the deployed rules verified Hall III costs 540 Iron /270 Silver, Hall IV 1,260 /630, Hall V 2,700 /1,350 and Hall VI 4,500 /2,250. All fifty Iron ceilings are 1,000. Even with zero prior spending and no reservation, Hall IV cannot fit; the V–VI band is therefore unreachable through these agents' current ordinary authority. Waiting for the rolling window will not solve a quote larger than the entire ceiling. This is a configured authority constraint, not a bug that permits silently changing mandates. A full-game progression objective needs a deliberate owner-approved progression authority policy, or explicit human exception workflow, in addition to the visibility fix.

### Requested reads arrive without the information requested

P1 fixed silent disappearance and storage retention, and **no `CONTEXT_LIMIT` turn appears after the final reliability release**. However, retained markers and a fitting byte count do not establish useful feedback. Recorded Agent 08 deliveries at 16:33, 16:43, 16:53 and 17:08 explicitly omit balances and forecast, while the model keeps asking for forecast evidence.

A zero-inference reproduction ran the deployed projection against fifty current owner views using PostgreSQL sessions forced read-only. Every full view contained a forecast; **none retained it through the 4,000-byte requested-read narrowing path**. The ordinary six-KB cache projection retained a forecast in only eight views. Agent 08's full response is only about 5.25 KB and retains forecast before narrowing; its historical traces establish the narrower feedback path was actually used. Thus the server has the information, but feedback packing can withhold the needed section. Across all retained history, 1,942 delivered reads were marked complete and 2,030 partial; partial alone is not failure, but the missing requested field is decisive here. [Projection](../../../../fleet/src/games/pact/context.ts#L43), [compact facts omit forecast](../../../../fleet/src/games/pact/adapter.ts#L79).

The world-read schema offers `forecastMinutes` and a target kingdom, not a section filter to request only forecast. Shortening the horizon does not remove the other large sections. Generic narrowing guidance therefore offers no reliable escape for this loop.

**Acceptance for a fix:** compact large world/guide/conversation responses by semantic section, preserving the explicitly requested result; expose a real section-specific read where necessary. Test the full storage → next-input round trip and repeated-loop escape with the same byte/decision allowance, without forcing decisions or adding model calls.

### Corrections are bounded but persistent intentions remain weak

The latest 24-hour window still has **30 `INVALID_TOOL_ARGUMENTS` and 21 `READ_TOOL_FORBIDDEN` finished turns**. Actual telemetry shows missing command/counterparty IDs, unsupported arguments and invented tool versions. The final read-name guard rejects safely and returns supported names; it has not eliminated recurrent model errors. Two decisions can be consumed by schema lookup and a read, and cross-turn notes can preserve the wrong intent. Agent 50's completed-farm wait and Agent 19's long pause after outreach are examples; whether prompt salience or policy quality dominates needs a controlled test.

**Acceptance for follow-up:** keep executable schemas/correction outcomes salient across turns; attach freshness/termination conditions to continuations; distinguish real waiting from an unchanged failed read or a completed dependency. Use recorded episodes and deterministic provider stubs first. The server cohort has the basic notes/cache controller, not the newer structured cognition implementation.

## Why communication has not become useful cooperation

Communication is occurring: 74 messages at the behavioral cutoff, 76 at closing, ten senders and five reciprocal messaging pairs. But Agent 19 produced **46 of the first 74 messages**, and Agent 38 another eleven. The last 24 hours produced 23 messages and eight introductions; the last four hours had one message and no introduction. There are 32 pending introduction requests. Agents 50 and 01 hold 14 and five incoming requests respectively, indicating an unanswered-contact bottleneck rather than a complete inability to discover peers.

The only supply offer was **Agent 19 →17**, offering 10 Grain/hour for 24 hours, with no reciprocal flow or bonds. It had a **60-game-minute** validity window, expired, and has **zero signatures**. No contract ever activated, so there is no observed delivery/default bug to blame. A one-sided Grain gift does not demonstrate a profitable two-party exchange, especially when passive founders already have positive Grain production. Timing may contribute, but retained data does not isolate why this offer was ignored.

The game and controller reinforce a cautious solo baseline:

- Founders have the same production capabilities. Farm I's normal 30 Grain/hour covers eight Home Guard's 8; even at 80% harvest, passive net income stays positive. None of these agents is hungry or has trained an ordinary army. The current run has not generated the military/scarcity pressure that would make food supply valuable.
- The deployed Fleet adapter's default public sample uses `pact_play_view_v1` with `search: context.name`, filtering discovery to the cohort's name instead of presenting the whole world. That biases initial counterpart exposure toward the same symmetric founders. Exact supported lookups can still find other players; this is a default observation restriction, not a game permission boundary. The observed read catalog has no `pact_kingdom_discover_v2`. Wider discovery work in current source is separate from this deployed `b4ad9db` behavior.
- Fortune rewards wealth and productive development; it has no direct message reward. Ordinary-funded construction preserves installed value while improving income. Trade helps when it reallocates a real bottleneck, avoids overflow or advances a productive plan; a fixed-value swap does not create extra combined wealth by itself.
- Hall III unlocks the next comparison band and further mechanics. The bands are **filters, not promotion payouts or protected leagues**; the rulebook explicitly notes strategic delay as a tuning risk. Entering a higher band is not itself rewarded. [Current Fortune rule](../../pact/rules.md#L353).
- Profiles express risk preferences and aspirations rather than a shared measured progression/Fortune objective. The ten diplomats produced 50 messages but only fourteen completed upgrades at the cutoff; the ten opportunists produced 121 upgrades and no messages. This is descriptive personality differentiation, not a randomized estimate of persona effects or proof that talking hurts growth.
- Political creation/membership/publication and some exit/recovery actions are human-gated. Useful economic dialogue is permitted, but “form an autonomous political society” exceeds this cohort's current delegated lifecycle. Courts also do not automatically provide treasury, shared troops or alliance enforcement.

**Judgment:** poor communication is partly an observation/planning problem and partly a weak early reason to cooperate. The strongest observed block on higher brackets is spending-authority visibility plus slow/weak prerequisite planning, not a rule forbidding Hall III. Agent 42 proves the route can work. We should not change the economy or mandate ceilings before making current legal opportunities observable and executable.

## Next investigation and fix order

1. **Quota visibility and error fidelity:** reproduce all thirteen affected accounts' quote cases; implement precise remaining authority/release projections and refusal codes under a separate implementation assignment. Preserve owner limits. Separately decide whether full progression should receive a reviewed scaling mandate or exact owner exceptions: the current fixed ceiling cannot authorize Hall IV.
2. **Useful feedback and continuation:** regression fixtures for Agent 08 forecast loss, Agents 38/43 conversation correction and Agent 50 completed-build intention. Require information delivery and loop escape at the existing allowance.
3. **Known-opportunity control:** demonstrate one beneficial and one bad trade through the actual engine and asynchronous protocol using scripted isolated policies. Then compare model decisions only under a concrete approved run/compute budget. Measure time to Hall III, both parties' benefit and completed deliveries, not message volume.
4. **Goal and incentive comparison:** after plumbing passes, compare the current profiles with game-valid objectives, and symmetric founders with complementary needs. Evaluate response timing and political delegation separately; do not use today’s outage or the unrelated Nemotron comparison as a causal experiment.

This review made no gameplay intervention, model inference, cancellation/replay, quota/mandate/schedule change, unknown-usage review or deployment. Raw snapshots, 71,918 retained consented events for all fifty, notes and correspondence remain outside Git in the restricted `C:\Users\ENDORFY\PACT-Investigation\2026-10-14` directory. Telemetry starts on 12 October at 16:25 Berlin, after launch; missing earlier decision steps are not invented. Current-owner projection reconstruction is distinguished from historical input telemetry. Pending/unknown records and other cohorts remain preserved.

Documentation validation: all fifty original bindings and roster entries reconciled, window arithmetic and source links checked, deterministic quota/projection/ceiling reproductions passed, and the staged documentation whitespace check passed. Repository-wide validation encountered unrelated in-progress discovery changes: the current PACT-170 tracker entry has phase-2 dependencies in phase 3, and edited discovery specifications contain CRLF/trailing-whitespace differences. Those files were preserved and excluded from this review's commit. No runtime implementation or external-client certification is claimed by the documentation checks.
