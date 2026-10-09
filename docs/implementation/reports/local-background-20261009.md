# PACT-135 — 50-account background player loop

**Final observation:** finished at 08:00 Berlin on 9 October. [Final investigation, reconciled turn counters and limitations](local-population-final-20261009.md) supersedes ongoing-status notes below.

Founder assignment: 9 October 2026, leave the expected local player schedule running. Operator: `codex-local-population`. **Implementation and startup verification complete, uncommitted.** The two-hour observation is **running** and is not completion/capacity certification. Local tracking continues because the previously verified Linear free issue limit remains unresolved.

## Correction and scope

PACT-133 delivered a bounded capacity test and PACT-134 delivered automatic synthetic-owner decisions, but neither left a background player loop active. The founder expected scheduled gameplay; the implementation had been stopped after its test. This assignment remedies that operational omission rather than claiming a scheduler was already running.

The new run reuses 50 independent existing synthetic owners: 48 from the completed capacity state plus two from the completed pilot state. Source states were read without changes; source request budgets/deadlines remain final. No account was created or economy/mandate reset. New owner-policy markers explicitly authorize the separate bounded controller in this assignment; model credentials remain separate from owner credentials.

Run `local-background-1791507229557-092e5567`: original start 00:53:49.557 UTC, original end **02:53:49.557 UTC / 04:53:49 Berlin**, 9 October; cap **1,250 actual model dispatch attempts**, fifty accounts, minimum five-minute turn spacing, Qwen3.5 4B, serial worker, 16,384 context, 600 output limit, automatic owner decisions capped at 20/account and 500 whole units each per-resource exception ceiling. Those budgets persist for this run; no unattended rollover is configured.

## Background infrastructure

Installed and started current-user Windows task **PACT Local Players 50 20261009**. Principal is interactive/limited, launcher hidden, multiple instances `IgnoreNew`, three restart attempts at one-minute intervals, logon trigger and a two-hour-twenty-minute OS execution ceiling. Startup was invoked immediately; its observed state is **Running**. Windows Node 24.19 runs `scripts/local-population/supervisor.mjs` from the existing repository against native state `C:/Users/ENDORFY/pact-local-background-50-20261009`, owner-only ACL. This task/process survives the chat ending.

Supervisor emits a fifteen-second credential-free heartbeat. It reconstructs every environment setting from immutable saved config, not caller shell defaults. A live lock PID prevents another worker. Only a confirmed dead PID permits removing that unchanged original stale lock, after which the ordinary runner reconciles pending receipts/owner decisions. Finished/stopped states cannot run again or gain a new budget. No automatic trial creation occurs after the deadline.

The Windows account must stay signed in and the PC awake with Ollama/repository reachable. No VPS inference deployment or OS sleep-policy change was made. A later process/logon retry may delay the remaining turns, never extend the deadline. This is a bounded background run, not an indefinite service claim.

## Verification

- WSL Node 24.12: **33 tests passed** across local, owner, supervisor and existing population suites.
- Windows Node 24.19: all three supervisor tests passed.
- Biome selected-script checks and repository typecheck passed. Planning render/check and diff whitespace validation are recorded on completion.
- Supervisor tests cover immutable limit reconstruction, live/dead/invalid process locks, and terminal runs preserving their counters without inference.
- At 00:54:33 UTC: task Running, supervisor PID 17792, all **50 distinct kingdoms** provisioned, six first turns complete, zero blocked accounts.
- At 00:55:25 UTC: 23 model turns complete, 38 committed commands, no turn failures, seven simulated-human contact answers. One stock denial and three fresh-building availability rejections were not treated as commits. This is ongoing live evidence.
- By 00:56:33 UTC / 02:56:33 Berlin: **all 50 distinct accounts completed their first turn**, 50 complete model results, zero turn failures or blocked accounts. Startup audit captured 84 committed commands: 18 contact requests, 18 simulated-owner answers, 13 offers, 13 messages, 16 builds, five signatures, one counter. Two stock denials and six fresh-building rejections were not commits. Automatic exception controller is enabled; first-wave commands fit their ordinary mandates, so no exception was needed.
- [Credential-free first-wave audit](evidence/local-background-20261009-startup.json). Mean full turn 2.825 seconds, p95 4.892 seconds in this richer-state first wave. A conservative p95 calculation with 30% headroom projects 42 at five minutes; the observed 50 completed their first round in about 142 seconds, but this does **not** establish 30% p95 headroom or sustained two-hour capacity. Subsequent live timing must determine whether richer negotiation/approval traffic causes backlog.
- Planning render/check passed: 135 unique tickets, acyclic dependencies, all 37 release criteria covered, unchanged specification hashes and six generated views. `git diff --check` passed.

## Health audit — 03:12 Berlin, 9 October

Founder requested a live health check. Windows task remains **Running**, heartbeat age eight seconds when checked, **50 active owners**, zero blocked owners, no pending commands and no MCP session-close failures. API readiness returned `ready`; world was active at tick 16806. Sampled resource use was modest: API 3.43% CPU/100.6 MiB, PostgreSQL 11.79% CPU/225.2 MiB; Qwen reported 100% GPU execution, about 3.6 GB model memory, device 53°C. These are point samples, not stress-limit certification.

At the settled fourth-wave snapshot: **200 attempts, 199 completed model turns, 312 unique committed commands**. Forty-nine owners completed four successful turns; one completed three because its 600-token response was truncated at 03:06:28 Berlin. That response was rejected without gameplay and the owner completed its next scheduled turn at about 03:11:33, with its failure count reset and no block. There was no need to change configuration, restart the worker or reset any budget.

Commands in this run: 56 introductions, 56 simulated-owner answers, 71 messages, 43 offers, 52 signatures, five counters, 29 building queues. Six stock denials, one tick-admission denial, seven fresh-building rejections and three unobserved/stale-offer rejections did not commit. No authority exception was required yet; initial mandates still cover the successful actions and the bounded owner controller is enabled.

Server cohort audit confirmed **11 active supply contracts**, **132 installments**, zero failed installments, and every due iron/grain unit delivered. The cohort has 80 accepted contacts including earlier contacts; 137 completed, eight active and fourteen waiting buildings include work from source runs. There were no live write leases at the idle sample. Repeat-turn maximum scheduling lateness was about eleven seconds, not a growing multi-minute backlog.

[Credential-free client/server health snapshot](evidence/local-background-20261009-health-0312.json). Overall healthy at this observation, with the isolated safely handled truncation recorded explicitly. The original 04:53:49 Berlin deadline and 1,250-request ceiling remain unchanged; the run is still ongoing.

## Authorized extension — 03:16 Berlin

The founder subsequently authorized continuing until **08:00 Berlin on 9 October**. PACT-136 extended the same run and resumed the same task, preserving consumed requests and all actor/approval state. The effective total cap is 4,000; original limits above remain historical evidence. [Extension implementation and actual resumption](local-extension-20261009.md).

## Handoff

[Background runbook, stop and status controls](../../operations/local-population.md#running-50-account-background-task--9-october). Private state, launcher and log remain outside Git. Credential-free status and heartbeat are separate files. The completed October 4 experiment and PACT-133/134 tests remain stopped; 24 deferred production tickets remain deferred. This assignment does not certify two-hour completion before its deadline or a maximum capacity with richer negotiations/approval traffic.
