# PACT-133 — local-model population and capacity

Founder assignment: 9 October 2026. Operator: `codex-local-population`.
Status: **complete**; implementation is uncommitted. The bounded experiment finished at its original deadline; no worker remains running.

## Authorized scope and acceptance

Implement a local-only Ollama population client, test Qwen3.5 4B, and measure how many independent accounts the current hardware can support. Preserve the completed October 4 experiment, ordinary economy, owner identity, human approvals and all 24 deferred production tasks. No Luna or paid model calls.

- Independent synthetic owners join through public guest/OAuth APIs; commands use existing MCP mandates, leases and receipts.
- Loopback-only inference, structured plan validation, persistent request/deadline bounds, one process per state directory, safe uncertain-command recovery, and fair scheduling have failure-path tests.
- Benchmark actual PACT prompts and distinguish measured model throughput, projected capacity and observed live cohort capacity.
- Run a small bounded live cohort without minted stock, clock acceleration, administrative gameplay writes or interactions with non-cohort users.
- Publish reproducible operations and credential-free results. Private owner tokens/state remain outside the repository.

## Tracking

Linear creation was attempted once on 9 October and rejected: `You've exceeded the free issue limit for this workspace.` No issue was created, deleted or reopened. PACT-133 is tracked in the local snapshot and this execution report, assigned to `codex-local-population`. Live tracker reads confirmed PACT-099 and PACT-127 Done; local prerequisite snapshot has PACT-052/053/099/127/130 Done. This is a new assignment; the historical 200-request cap remains exhausted and untouched.

## Implementation checks

- Node 24.12 (WSL): the combined local/population suite passed **24 tests**. Windows Node 24.19 independently passed all **11** local-runner tests.
- `npm test -- tests/unit/script-baseline.test.ts`: all ten selected existing script-baseline tests passed.
- Selected Biome checks, architecture boundaries and the forbidden-import fixture passed; all 26 frozen v1 schemas are unchanged.
- An initial typecheck and standalone MCP build encountered stale generated package declarations. The documented `npm run build:packages` rebuilt them in dependency order; subsequent `npm run typecheck` passed. No application source fix was required.
- Planning render/check passed with 133 unique tickets, acyclic dependencies and unchanged specification hashes. All 24 deferred production tasks remain deferred.
- Live server preflight: `world_clocks.status=active`, sequence 16747; API readiness was already checked. The experiment does not mount or mutate PostgreSQL directly.

## Operations

[Local population runbook](../../operations/local-population.md). The runner executes on the owner machine, so no production application image, migration or service restart is necessary. Model weights were downloaded locally before measurements. No provider keys or subscription OAuth route are used for inference.

## Inference benchmark and smoke

Windows Node 24.19, Ollama 0.35.1, RTX 5070 Ti 16 GB. Local `qwen3.5:4b`, Q4_K_M, model digest `d8b0f5e9760cd1682034f292d7ef72ec46f432149be0df7574bf2d6e92e38c04`, 16,384 context, 600 output ceiling, thinking disabled, one serial worker. Ollama reported 100% GPU execution and about 3.6 GB loaded model memory; total device allocation during inference was sampled at 5,724 MiB including other desktop/cache allocations.

- Original embedded `actionJson` format: 7/24 fully valid plans; string-encoded actions caused seventeen SyntaxErrors. First load plus generation took 55.8 seconds. This rejected format was never used for live gameplay.
- Direct typed action objects: syntactically parsed all 24 outputs, but only 12/24 passed semantic checks; other plans invented signatures for offers present only as conversational prose. No invalid action reached the server.
- Typed actions constrained to visible operation/identifier/version facts: **24/24 valid fixture plans**, mean 2.129 seconds, p95 2.954 seconds. With 30% headroom, inference-only p95 projections are 71 accounts at five minutes, 142 at ten minutes and 213 at fifteen minutes. These exclude game/network overhead and are not sustained load evidence.
- Four-account live smoke, run `local-1791505197378-e80a9a6a`: 00:19:57–00:20:08 UTC (02:19:57–02:20:08 Berlin), stopped at its four-request cap. Four original independent kingdoms, four model results, three committed building queues, no model-plan rejection or turn failure. Full turn mean 2.499 seconds, p95 3.489 seconds; a four-sample p95 is the maximum and is not statistically robust.

A separate **48-account** capacity cohort completed with a fixed seventeen-minute deadline, five-minute per-owner interval and 192-request ceiling. Its limits were never extended or reset. This cohort has no scripted players and no cloud model route.

## Capacity-run startup repair

Run `local-1791505243810-9441c8da` started 00:20:43.811 UTC, fixed end 00:37:43.811 UTC (02:37:43 Berlin), cap 192. Provisioning stopped after 23 completed actor setups when Windows atomic replacement through the WSL UNC state path raised `EPERM`; a second resume reproduced it before inference. This is a harness/filesystem failure, not a game or model failure.

The already persisted state/events were copied to `C:/Users/ENDORFY/pact-local-capacity-48-20261009`, with ACL inheritance removed and only the current owner granted FullControl. Source/destination private-state SHA-256 hashes matched before resume. No secret values were printed. Normal guest entry resumed unfinished setup using the original entry keys; all 48 distinct kingdoms are retained. Deadline, counter, model digest and config stayed identical. The inactive original copy remains for audit, never as a second worker.

Windows UNC state paths are now rejected during configuration, with a regression test. The running native-disk process uses the same typed/dynamic action schema as the successful benchmark. No API, inference, rules or database service was restarted.

All 48 first turns completed: 100 committed building commands, thirteen definitive server denials (twelve `BUILDING_BUSY`, one `SLOT_BUSY`), no malformed plan or turn failure. These denials reflect conflicting actions within one generated plan; generation-time facts cannot reserve multiple actions, so the server remains authoritative. Audit now reports denials separately rather than allowing them to disappear into successful turn counts.

The observed duplicate-build denials prompted an additional fresh-state client check and regression test: an occupied building/slot or no-longer-affordable upgrade is rejected before dispatch. This check was added after the capacity process started; the running process retained its original loaded code. Consequently the live results include the original server denials, and the additional client check has unit evidence rather than a claim of live deployment.

A 00:27:19 UTC session-scoped, read-only gameplay audit confirmed active world tick 16761 and 71 active/32 waiting building instructions. Its only SQL writes were to a temporary cohort-ID table inside the audit session; no persistent gameplay table was written. Container sampling around the same time showed API 13.78% CPU/96 MiB and PostgreSQL 11.13% CPU/214 MiB, not a sustained server limit measurement.

## Final live result

Stopped for `DEADLINE` at 00:37:43.899 UTC (02:37:43 Berlin), approximately 88 ms after the original fixed boundary. **155 dispatch attempts, 154 complete model results/turns**, 48 unique original kingdoms. All 48 completed three successful cycles; ten completed a fourth. The eleventh fourth-cycle attempt was aborted at the deadline (`TIMEOUT` at 00:37:43.824 UTC), with no gameplay from its unfinished inference. There were no earlier inference/transport/plan failures, no blocked actors, no unresolved commands, no action dispatch after the deadline and no remaining runner lock.

**200 unique committed commands**: 129 building queues, 24 contact requests, 24 separate simulated-human contact answers, eight messages, twelve supply offers, two signatures and one counteroffer. Of these, 176 were Envoy commands and 24 were labelled simulated-human commands. There were 31 definitive denials: 13 `BUILDING_BUSY`, six `SLOT_BUSY`, nine `INSUFFICIENT_STOCK`, one `TICK_PENDING`, two `REQUEST_EXISTS`. None was counted as a commit or retried with a fresh ID. No invalid-shape plan was accepted.

Final server audit at 00:38:03 UTC confirmed active world tick 16772, **75 completed / 35 active / 19 waiting buildings**, 24 accepted cohort contacts, eight messages and twelve open offers. **Zero activated supply contracts or delivered installments**: two individual signatures and one counter do not prove a completed agreement. There were zero live cohort write leases. No persistent gameplay SQL writes, production deployment or service restart occurred. The four pilot kingdoms and 48 capacity kingdoms remain in the normal world; stopping the external client does not delete accounts or cancel queued construction.

## Capacity conclusion

One warm serial Qwen instance shares weights across independent owner prompts/memories. Full successful turns averaged **2.203 seconds**, p95 **3.890 seconds**, including OAuth/MCP/network/session overhead. Repeat-turn maximum scheduling lateness was **3.576 seconds**. Initial maximum lateness of 111.589 seconds includes provisioning and the UNC repair and is reported separately.

| Turn spacing | Inference-only p95 estimate | Full-turn p95 estimate, 30% headroom | Observed live cohort |
| --- | ---: | ---: | --- |
| Five minutes | 75 | **53** | **48, three complete cycles each** |
| Ten minutes | 150 | **107** | Not load-tested at this spacing |
| Fifteen minutes | 225 | **161** | Not load-tested at this spacing |

**Recommended current operating cohort: 48 accounts with a minimum five-minute interval and one serial worker.** The short experiment does not establish the exact maximum or multi-day reliability. Empty waiting turns and early/simple negotiations lower the average; more complex Courts/messages/contracts may increase latency. Ten-minute operation can be considered for a larger cohort, but the current harness caps configuration at 100 accounts and those larger cohorts are unverified. Cold model load was about 56 seconds and must be warmed before relying on these warm-throughput estimates.

Small-model quality remains a separate constraint: the rejected embedded JSON route and invented signatures were corrected by typed/dynamic schemas, while multi-action stock/slot conflicts still caused legitimate denials. Fresh-building checks now catch the observed duplicate-build class locally; stock, tick and cross-owner contact races remain subject to server authorization. This run proves ordinary construction/social/offer commands, not successful contract negotiation or settlement.

## Durable evidence and handoff

- [24-plan fixture benchmark](evidence/local-population-20261009-benchmark.json)
- [Four-account live smoke audit](evidence/local-population-20261009-pilot.json)
- [Final 48-account client audit](evidence/local-population-20261009-capacity.json)
- [Final server cohort audit](evidence/local-population-20261009-server.json)

The published summaries contain synthetic/public identities and no credentials. Full synthetic events and private owner/OAuth state remain outside Git. Native Windows state is owner-only at `C:/Users/ENDORFY/pact-local-capacity-48-20261009`; the inactive WSL copy is retained solely for audit. A finished run cannot resume; any future trial needs a fresh state directory and explicit bounds. Local PACT-133 acceptance is complete, despite the unavailable Linear issue slot. No next roadmap ticket is selected or authorized automatically; all 24 deferred production tasks remain deferred.
