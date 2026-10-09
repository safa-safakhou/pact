# Continuous local-player health and model assessment — 9 October 2026

Follow-up observation for PACT-138, requested by the founder. **The fifty-player controller is running, but operational health does not establish competent gameplay.** Qwen 3.5 4B demonstrates basic command execution and some prerequisite recognition; the observed configuration does not demonstrate reliable independent negotiation or broad strategic play. This assessment concerns the deployed model plus harness, not a general benchmark of the model.

## Observation and operational health

Read-only inspection of the protected controller journal/checkpoint, Windows scheduled task, local Ollama and live VPS PostgreSQL. No new inference experiment, game command, mandate change, restart, budget reset or deployment was performed. Existing continuous authorization remains in effect.

Controller snapshot **11:20:47 UTC / 13:20:47 Berlin**; database snapshot **11:21:21 UTC / 13:21:21 Berlin**. Journal and status were read separately while the worker remained active, so in-flight counters can differ. Run `full-game-1791537512736-10b87b6c` started at 09:18:32 UTC. [Credential-free aggregates](evidence/full-game-health-20261009.json).

- Windows task `PACT Full Game 50 Continuous`, controller and supervisor Running; all fifty owners completed valid turns; no currently failing owner or pending command at the snapshot. Lifetime reserved requests: 1,189. Journal contained 1,171 valid model results/completed turns and sixteen historical startup context failures. Reserved attempts include interrupted/preflight work and are not identical to completed model calls.
- Last turn failure: **09:26:37.804 UTC**, `PROMPT_LIMIT`. No subsequent turn failure in the sampled journal. Last `RUN_ALREADY_ACTIVE` outcome: **09:36:25.216 UTC**, preceding the final lease-reuse release. Historical failures remain counted.
- Ollama reports the pinned `qwen3.5:4b` weights `d8b0f5e9760c`, 32,768 context, 100% GPU, approximately 4.2 GB resident. Median inference duration in the journal: **4.56 seconds**. This is one serial GPU worker serving fifty identities, not fifty concurrent loaded models.
- Public `/health` returned `{"status":"ok"}`. All ten deployed containers were Up; API and PostgreSQL healthchecks healthy. World active at tick 17,415, advancing from the earlier saved owner projection at tick 17,410. VPS disk: 28% used, 52 GB available. A subsequent `docker stats --no-stream` snapshot showed API approximately 19% CPU / 105 MiB, PostgreSQL approximately 9% / 245 MiB, rules approximately 0.2% / 98 MiB; no resource saturation apparent in that snapshot.
- Cohort database totals include historical runs: 263 contacts, 272 expired contracts, 32,640 installments, **zero installment failures**, due and delivered amounts equal for each resource. These successful deliveries are from the overnight run, not new continuous-run negotiation. Zero live write leases at the database snapshot is normal between turns.

The operational checks found no new crash, stuck pending write or settlement failure. This is a point-in-time audit, not proof that every application path or past server log is error-free.

## What the current models actually achieved

| Measure | Observed value |
| --- | ---: |
| Valid model plans | 1,171 |
| Empty plans | 1,036 (88.5%) |
| Owners whose sampled plans were all empty | 18/50 |
| Owners with at least one committed action | 29/50 |
| Proposed actions | 162 |
| Committed actions | 69 (42.6% of proposals) |
| New supply contracts since run start | **0** |
| Current-run committed model messages | **0** |
| Current-run supply counterproposals | **0** |

The 69 commitments are **26 construction queues, five construction cancellations, 35 supply offers and three signatures**. A signature receipt is not proof of bilateral activation. Of the 35 identified offers, 34 had expired and one remained open at the database observation; no new contract had activated.

All other proposed actions were denied: six scouting attempts, one training order, one transfer, one contact request and three messages. There were no proposed Court/social-publication/raid/garrison commands in this snapshot. Public Court/politics/Chronicle reads occurred, but discovery is not mechanic execution. Earlier Court, Article, Chronicle, troop and message adapter probes remain valid adapter evidence and must not be attributed to autonomous model decisions.

Outcome counts: 69 `COMMITTED`, 30 `INVALID_COMMAND`, 19 `BUILDING_BUSY`, fifteen historical `RUN_ALREADY_ACTIVE`, twelve `EXPIRED`, eleven `RATE_LIMITED`, three `SLOT_BUSY`, and one each `MESSAGE_QUEUE_FULL`, `ALREADY_CONTACT`, `FORBIDDEN`. A valid plan with an empty action list or denied commands is still counted as a successful *controller turn*. It is not a successful game decision.

## Concrete reasoning and communication findings

1. **Failure to update beliefs after expiry.** Actor 4 signed offer `c0ef3f48-8bf0-4748-ab3f-f97b18a469a0` once at 10:16:13 UTC, then tried the same offer/version twelve more times between 10:21:21 and 11:17:50, receiving `EXPIRED` every time. Later reasons explicitly acknowledged previous expiration while retrying. The current private memory also contains the preceding `EXPIRED` outcome. This is strong evidence of weak error recovery, rather than an approval blocker.
2. **Prerequisite recognition without a workable plan.** Actor 0 repeatedly stated that Barracks II is needed for Hall II, but selected no actions across all its sampled turns. Its latest owner read showed Barracks I, Hall I, one slot occupied by Mine III waiting on the Hall limit and the other by Hall II waiting on Barracks II. Resolving this requires freeing a slot and building the prerequisite. Actor 43 also had both slots waiting and proposed more blocked upgrades. Across saved selected world reads, 27 waiting instructions comprised seventeen `hall_limit`, nine `hall_prerequisite` and one `ready`; two owners had both slots waiting. These reads are per-owner snapshots, not a simultaneous database proof of every prerequisite. The database independently confirms 27 waiting instructions.
3. **Repeated impossible bond sizing.** Actor 44 repeatedly proposed 3 grain/hour versus 3 iron/hour for 72 hours with 1,200-whole silver bonds and received `INVALID_COMMAND`. `validateSupplyTerms` limits bond value to at most six hours of that party's flow. Resource values are grain=1, iron=4, silver=8: its proposed silver bond value is 9,600, versus maxima of eighteen and seventy-two. The terms violate the deterministic rule by large margins. The journal records only the broad denial, so this calculation identifies a rule violation without claiming access to a more specific historical server error.
4. **Invented references and uncertain identity.** A plan queried a Seal with the all-zero UUID; another proposed message introduced a nickname inconsistent with the current cohort nickname. The schema enforces shape, not existence or truth. The message was denied, so this is proposed text, not a communication delivered to another player.
5. **Conversation is not currently happening.** The three generated message proposals received `RUN_ALREADY_ACTIVE`, `MESSAGE_QUEUE_FULL` and `FORBIDDEN`; none committed. The newest two stored messages were clearly labelled finite adapter-verification messages at 09:36:25–26 UTC. The next newest messages came from the finished overnight run. Thus there is no fresh successful model dialogue from which to claim current negotiation quality.
6. **Earlier dialogue was partly useful but repetitive.** A limited latest-fifteen-message sample included three copies of a trade confirmation, three requests to confirm a receipt, uncertainty about whether a trade exchanged grain/iron or grain/silver, and some ordinary clarification. This is a recency sample, not a representative score of all conversations. The prior complete overnight analysis found 91 counters, only nineteen genuinely changed counters, six contracts activated after changed terms, and 72 unchanged counters. It demonstrates some substantive bargaining, but not consistently strong negotiation. See [the completed negotiation analysis](local-population-final-20261009.md).

## Harness limitations contributing to the result

- Full mode still copies the old builder/trader/peaceful personas. All 58 command kinds are available, but availability alone supplies neither a strategic objective nor pressure to explore Court or military play. No artificial mechanic restriction was reintroduced.
- Every turn reads an owner world projection and rotating rule/discovery guides. Additional requested reads return **next turn**, roughly five minutes later. The model must choose targeted conversation reads; the controller does not automatically poll and answer every conversation/contact request. At the database snapshot, 201 cohort messages were unread and three incoming contact requests pending, including historical backlog. Those totals do not mean 201 new unanswered current-run messages.
- `fullPrompt` pages arrays by their first entries and excerpts long strings. Historical consequence lists can compete with current evidence, and requesting the entire world again duplicates a mandatory read. Journal requests overwhelmingly selected world reads (1,151), while only eleven requested council threads. No exact historical rendered prompt is retained, so this audit cannot prove which paged item a particular model call saw.
- Action memory exposes the outcome code but does not retain detailed denial explanations or explicit allowed alternatives. `INVALID_COMMAND` is much less useful feedback than a specific bond/prerequisite constraint. This is a harness explanation weakness as well as a model adaptation problem.
- Preserved old mandates still describe narrow agent permissions; the separate synthetic owner controller can handle authorized exceptions through normal APIs. A small model may misread those restrictions as a complete gameplay prohibition. This is a plausible confounder, not demonstrated causation for every empty turn.

## Assessment and recommended next work

**Adequate for low-cost basic execution and exercising some API paths; not yet demonstrated adequate for the independent full-game play expected here.** Structured output is reliable after the context repair, and ordinary builds/offers can commit. However, repeated stale writes, unmet prerequisites, unactivated offers, missing dialogue and absent broad mechanic use prevent claiming a capable strategic player. More empty turns do not resolve this evidence gap.

Improve the information loop before attributing all failures to the weights: prioritize current actionable facts, supply a short decision objective consistent with each owner, retrieve relevant conversations/offers before decisions, retain precise denial feedback, and make completed versus pending versus expired obligations explicit. Measure actual activation, useful changed counters, truthful messages and successful prerequisite recovery separately from valid JSON. Preserve all existing server authority and economic rules.

Then run a bounded comparison of local configurations on the same decision cases, including expired-offer recovery, slot deadlock recovery, valid bonds, bilateral trade completion and Court participation. A stronger local model can be assessed against the same cases if memory permits. These are recommendations; this audit did not replace the deployed model, alter strategies, start extra workers or change the continuous run. No new paid provider use or deferred roadmap work is implied.

## Verification and handoff

Executed: Windows task/status/supervisor checks; `ollama ps`; SSH `docker ps`, public health request, disk and resource snapshot; read-only cohort/receipt/offer/contract/message SQL; full daily-journal aggregation; selected protected checkpoint reads excluding credentials; source inspection of prompt, outcome memory and bond rules. No application code changed, so application tests were not rerun. Planning render/check and `git diff --check` validate this documentation update; they do not certify gameplay.

Current implementation remains PACT-138 Done; observation ongoing. The controller remains enabled indefinitely under the founder's existing instruction. The next useful work is the information-loop and local decision-quality comparison above, rather than any of the 24 deferred production tickets.
