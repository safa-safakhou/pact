# Local Qwen population — final investigation, 9 October 2026

Subsequent founder-authorized [PACT-137 repairs and negotiation analysis](local-reliability-20261009.md) preserve this historical snapshot. Six waiting queues from this run were later canceled through normal owner commands; 119 remain completed. The follow-up deployed expiry recovery fixes and documents live coverage and remaining gaps.

**Finished at 08:00 Berlin as authorized.** The same 50-owner run lasted from 02:53:49 to 08:00 Berlin (00:53:49.557–06:00:00 UTC), including the brief authorized extension pause. It finished at 06:00:00.438 UTC with `DEADLINE`, **2,969/4,000 requests**, and Windows task exit result **0**. No new run was started. Final inspection occurred at about 09:35–09:37 Berlin. Implementation remains uncommitted; this report closes the observation attached to PACT-135/136, under local tracking because of the known Linear issue limit.

**Assessment:** this hardware ran 50 independent Qwen3.5 4B owners at roughly five-minute cadence for over five hours, and the trade/settlement backend worked. Reliability was imperfect: three owners stopped early on repeated output truncation, and late gameplay wasted attempts against quotas and unread-message limits. This is useful sustained evidence, not certification of 50 continuously successful agents or a higher maximum population.

## Counts and lifecycle

| Measure | Final result |
| --- | ---: |
| Distinct existing owners/kingdoms | 50 |
| Model dispatch attempts | 2,969 |
| Valid recorded model results | 2,869 |
| Successfully completed turns | 2,867 (96.6% of turns) |
| Committed commands, deduplicated by ID | 4,164 |
| Agent commands / synthetic-owner contact answers | 3,926 / 238 |
| Accounts still eligible at deadline / stopped early | 47 / 3 |
| Pending uncertain commands / session-close errors | 0 / 0 |
| Actions requested after deadline | 0 |

`status.actors[].turns` counts **scheduled attempts**, including failed turns; it does not count successful turns. Its final distribution is nine owners at 61, 38 at 60, and three at 53/46/41 attempts. The 47 eligible owners completed 53–61 successful turns each; the three early stops completed 49/43/36. Earlier status-only wording that equated this counter with successful turns should be read with this correction. The event-based final counts above reconcile every turn.

There were two normal process starts: initial startup and the authorized extension. The operator pause stopped at 03:16:31 Berlin, preserved 236 consumed attempts, and resumed at 03:16:53; there was no subsequent worker restart or budget reset. The final model result arrived at 07:59:52.809 Berlin; the last action request was 07:59:53.182. Supervisor exited at 08:00:00.512. At inspection the task was Ready, its PID absent and its lock removed. Its terminal saved state prevents the logon trigger from starting another experiment.

## Actual gameplay and settlement

Committed commands were **239 contact requests, 238 owner contact answers, 1,643 messages, 751 supply offers, 91 counters, 1,077 signatures and 125 building queues**. Signatures include first-party signing and repeat signing of existing offers; they are not 1,077 new contracts.

Database verification scoped contract creation to this run and both parties to these 50 owners: **272 contracts created, all 272 naturally expired**, zero defaults or releases. Their **32,640 installments** had zero failures. Every due unit was delivered: iron 505,200, grain 492,600, silver 82,200 in the ledger's internal units. These are delivery totals, not net gains or whole-resource counts. Settlement continued normally after inference stopped; the investigation is a later census, not the precise 08:00 snapshot.

Of the **125 exact building instruction IDs** committed in this run, **119 were completed and six remained waiting** at inspection; none were active or canceled. Queuing is not completion. Waiting starts recheck slot, prerequisites, balances, authority and reserve floors; this investigation did not establish which check prevents those six from starting. They remain a specific unresolved gameplay observation, not a reason to mark every queued upgrade complete.

The wider cohort census has 262 accepted contacts, 239 completed buildings and 16 waiting buildings, including work inherited from the pilot/capacity runs. It has 199 unread cohort messages and no live write leases. These inherited totals must not be presented as new results of this run.

## Failures and limitations

**Output length was the main reliability problem.** The 600-token response cap produced **99 `MODEL_OUTPUT_TRUNCATED` failures** (3.3% of requests). Incomplete outputs were discarded before executing actions. Three consecutive truncations stopped owner 8 at **06:18 Berlin** (36 successes), owner 21 at **06:44** (43 successes), and owner 7 at **07:19** (49 successes). The other owners continued. More truncations appeared in later hours; raw incomplete output/token counts were not retained, so their exact content and total failed-call token use cannot be reconstructed.

Other turn failures: one local Ollama HTTP 500, one timeout after a valid model response but before any action-request event in that turn, and one expected `RUN_STOPPED` after a valid response during the extension pause. The latter two explain why 2,869 model results yielded 2,867 completed turns. The missing 100 valid results reconcile to 99 truncations and one local HTTP 500. Recorded valid responses consumed **15,511,369 input tokens and 847,230 output tokens**; these are partial usage totals because discarded/error responses have no recorded usage.

**Quota and inbox awareness deteriorated.** The server rejected 558 dispatched commands: 320 `RATE_LIMITED`, 190 `MESSAGE_QUEUE_FULL`, 26 `TICK_PENDING`, eight insufficient-stock contacts, six `INVALID_COMMAND` signatures, six already-contact requests and two existing-request attempts. Rate-limited actions were 58 contacts, 140 offers, 111 signatures and 11 counters. Ordinary limits remain eight cold contacts and 48 offer actions per game day, with four unread messages per sender/recipient pair and 48 unread agent messages per recipient. Daily limits cannot be overcome by faster inference. In the final UTC hour, rate-limit denials rose to 180 and queue-full denials to 64; repeated attempts did not improve game outcomes.

Local validation separately rejected 22 no-longer-available building actions and 50 unobserved offer actions. Six invalid signatures remain unexplained at the precise underlying game-error level because the adapter exposes the generic `INVALID_COMMAND`; they are denials, not commits. There were no unknown command outcomes or silent receipt recovery failures.

**Approvals:** bounded synthetic-owner approvals were enabled throughout, but **zero authority exceptions or owner approval decisions occurred**. All successful agent moves fit ordinary mandates. No manual approval was required. This observation cannot establish heavy exception-controller performance; the separate PACT-134 live exact-command proof remains its integration evidence. Automatic approvals correctly did not override stock, quota, inbox or stale-state constraints.

**Model quality:** 671 valid plans chose no actions (23.4%). Late samples also repeated confirmations and sometimes described a message as renewing a contract, although messages do not extend authoritative contract duration. Claims about intentions/understanding are model text; receipts and settlement records determine game outcomes. Peaceful synthetic development/trade does not test combat, human enjoyment or strategic strength.

## Capacity and infrastructure

Recorded successful full turns averaged **3.359 seconds**, p95 **5.391 seconds**. Maximum repeat scheduling lateness was **36.783 seconds**, so there was no observed growing multi-minute backlog. At 30% headroom, a conservative calculation using successful-turn p95 projects **38 accounts at five minutes**, **77 at ten minutes**, **116 at fifteen minutes**. Those are projections; slow/error turns are excluded from that latency sample. The observed 50-account run demonstrates throughput, while three early stops and late wasted requests prevent calling it fully reliable capacity.

At inspection, public readiness returned `ready`, API/PostgreSQL containers were healthy and every game worker was up. World clock was active at tick **17188**. Point samples: API 0.25% CPU / 104.9 MiB; PostgreSQL 9.04% CPU / 195.8 MiB. No API or database resource bottleneck was apparent in this sample. We did not continuously sample server/GPU utilization or audit all unrelated players' logs; this is not a whole-platform stress certification.

## Recommended next work

1. Reduce verbose plan fields and make output length bounded; evaluate a modest output-budget increase on replayed synthetic prompts, then remeasure latency. Preserve truncation telemetry without admitting incomplete actions.
2. Include quota remaining/reset information and apply deterministic backoff after known quota/queue denials. Prioritize incoming/unread conversations and avoid repeating confirmations or already-signed offers.
3. Make attempt/success/failure counters explicit, investigate the six waiting builds and six generic signature denials, and retain richer safe error diagnostics.
4. Re-test 50 accounts after those changes; a ten-minute interval gives more measured inference headroom, but it does not reset daily gameplay limits. Do not increase population merely from model-only throughput.

These are findings and proposed follow-ups, not implemented changes or authorization for another experiment. The worker remains finished. No original October 4 budget, economy, authority or deferred production scope was changed.

Evidence: [final client audit](evidence/local-population-20261009-final-audit.json), [turn/failure analysis and synthetic late samples](evidence/local-population-20261009-final-analysis.json), [server cohort census](evidence/local-population-20261009-final-server.json), [exact run contract/building census](evidence/local-population-20261009-final-details.json). These contain synthetic summaries, not credentials. Verification used event/receipt reconciliation, read-only database queries, public readiness and Windows task/process checks. No code change or restart was required for this investigation.

Planning render/check passed for 136 unique tickets, acyclic dependencies, all 37 release criteria and unchanged source snapshots; six generated views validated. `git diff --check` passed. Runtime tests were not repeated for this documentation-only investigation.
