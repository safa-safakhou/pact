# Bounded local-model population

## Five-model comparison — PACT-139

**Completed 9 October:** the original two-hour deadline was respected; 555 attempts, 553 completed turns and 38 commitments were observed. The task is Ready and its checkpoint is terminal. No contracts, direct dialogue, successful scouting or raids were achieved. The [final comparison report](../implementation/reports/local-model-comparison-20261009.md) separates quality findings from successful startup. Preserve this finished run; do not restart or extend it. The observation heartbeat is disabled after the final report.

The founder authorized five new kingdoms each for Gemma 4 12B, Qwen 3.5 9B, Granite 4.2 8B, Ornith 1.5 9B and LFM2.5 8B. Windows task `PACT Local Model Comparison 25 20261009` downloads missing weights, provisions 25 stable normal identities and runs `comparison.mjs` for a fixed two hours after provisioning, with 1,000 total attempts maximum. Protected native state is `C:/Users/ENDORFY/pact-model-comparison-25-20261009`. It shares the GPU with the existing continuous worker; minimum intervals can lengthen. Five matched roles and identical non-thinking inference settings are used. Read [setup, actual status and monitoring](../implementation/reports/local-model-comparison-20261009.md) before operating it. A Running download task does not mean models are already playing. Keep terminal/deadline state and do not replace identities or reset counters on retry.

## Current continuous full-game controller — PACT-138

The founder explicitly requested **50 existing accounts indefinitely, all implemented gameplay**, on 9 October. The new Windows task **`PACT Full Game 50 Continuous`** runs `continuous-supervisor.mjs` over protected state **`C:/Users/ENDORFY/pact-full-game-50-continuous-20261009`**. It is independent of the earlier finished task and has no global inference deadline, request ceiling or owner-exception resource/count ceiling. Lifetime counters survive login, failures and operator restarts. Existing kingdoms, ordinary stock and game time are retained; no historical experiment is resumed or reset. [Release and startup evidence](../implementation/reports/full-game-local-20261009.md).

The full profile derives **58 commands** from the actual shared game, Court, politics, Seal, invitation and Chronicle schemas. Military training/scouting/raids, garrisons, transfers, all engine contract terms, Court membership/roles and publications are available. There is no experiment-specific target or mechanic allowlist. Authenticated game reads are discovered from the actual MCP catalog; arbitrary HTTP URLs, shell, account/credential/admin operations are not gameplay tools. The model chooses its strategy; availability does not guarantee that it will exercise every mechanic.

The separate opted-in synthetic owner controller executes exact human-only gameplay decisions and authority exceptions under founder consent. It does not give human credentials to models, change mandates or override ownership, stock, quotas, prerequisites, version checks or other engine rules. Seal/Chronicle publication binds a fresh server preview for the exact selected evidence before submission. A lost command response retains the same ID/payload and must reconcile before more writes. An invalid refresh grant reauthenticates the same existing guest identity; a kingdom mismatch fails closed.

Local Qwen3.5 4B uses 32,768 context, 2,400 output tokens and a ninety-second inference timeout, one serial GPU worker. A turn processes up to three decisions and three selected reads; this is execution batching, not a feature exclusion. Requests are counted conservatively before invocation, including rejected invocation attempts. A minimum five minutes separates an owner's turns; throughput and failed-turn backoff can lengthen that interval. Failed owners retry, without automatic creation of replacement accounts. Large observations use adaptive context pages with explicit omission labels; all command families remain available. Daily protected journal segments and private checkpoints retain decisions; publish only sanitized summaries.

The task runs hidden at current-user login, has no OS execution deadline, restarts failures and prevents idle system sleep while active. The account must stay signed in and the machine, GPU, Ollama and WSL repository must remain available. It does not turn the Windows GPU into an always-on VPS service or survive a powered-off computer. Stored model digest must match on resume.

```powershell
Get-ScheduledTask -TaskName 'PACT Full Game 50 Continuous'
Get-Content 'C:\Users\ENDORFY\pact-full-game-50-continuous-20261009\status.json'
Get-Content 'C:\Users\ENDORFY\pact-full-game-50-continuous-20261009\supervisor.json'
# Explicit permanent stop: no new work; retain counters and exact pending commands.
New-Item -ItemType File 'C:\Users\ENDORFY\pact-full-game-50-continuous-20261009\STOP'
```

`status.json` is credential-free and reports all fifty identities, successful/failed turns, owner decisions, pending command IDs and heartbeat. `private-state.json`, `worker.log` and `events-YYYY-MM-DD.jsonl` stay in the owner-only ACL directory. A terminal STOP state is not silently reopened. Ordinary crash/login recovery starts the same state; `clearDeadLock` confirms the PID is dead before removing its exact lock. Monitor disk usage for the continuing journal; it has no automatic deletion or budget rollover.

The bounded instructions below are the historical/default profile and remain applicable to finite new experiments. They do not impose their caps on the explicitly authorized continuous controller.

Founder assignment, 9 October 2026: PACT-133. This operator client runs **only local inference**, outside the application scheduler. It does not enable a hosted local-model provider or restart the completed October 4 experiment.

## Prerequisites and setup

Node 24, built `packages/domain/dist/resource-facts.js`, a loopback Ollama server with downloaded local weights, and the ordinary guest/OAuth/MCP game endpoint. Windows Node can access this WSL repository and the existing Windows Ollama at `127.0.0.1:11434`; WSL localhost does not reach that Windows server in the current setup. Linux execution works with a local Linux Ollama. No SSH or PostgreSQL credentials are needed by players.

```powershell
ollama pull qwen3.5:4b
```

Keep the state directory outside Git. **Windows execution requires a native local disk state directory with an owner-only ACL.** The benchmark initially worked through WSL UNC, but rapid live atomic state replacement failed with `EPERM` during provisioning. UNC state is now rejected before any account is created. The repository itself may remain on WSL. Linux execution uses an owner-only directory and POSIX 0700/0600 permissions.

Provision the Windows state directory before a run (replace the path for each new trial):

```powershell
$stateDir = 'C:\Users\ENDORFY\pact-local-new-run'
New-Item -ItemType Directory -Path $stateDir | Out-Null
$acl = Get-Acl -LiteralPath $stateDir
$acl.SetAccessRuleProtection($true, $false)
$owner = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($owner, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
$acl.AddAccessRule($rule)
Set-Acl -LiteralPath $stateDir -AclObject $acl
```

## Isolated inference benchmark

```powershell
$env:PACT_LOCAL_STATE = 'C:\Users\ENDORFY\pact-local-benchmark-new-run'
$env:PACT_LOCAL_MODEL = 'qwen3.5:4b'
$env:PACT_LOCAL_BENCHMARK_SAMPLES = '24'
node scripts/local-population/benchmark.mjs
```

The fixture varies synthetic owner state. It creates no account and executes no gameplay. `benchmark.json` separates first-load and warm serial latency, counts attempted requests and valid plans, and projects account counts at 5/10/15 minutes with 30% headroom. These are estimates, not a multiplayer load certification. For representative prompts from this cohort's live `events.jsonl`, set `PACT_LOCAL_BENCHMARK_EVENTS`; replay validates output shape only, since original owner state is not the fixture. Never use real-user message logs.

## Bounded live cohort

```powershell
$env:PACT_LOCAL_STATE = 'C:\Users\ENDORFY\pact-local-cohort-new-run'
$env:PACT_LOCAL_BASE = 'https://pact.tinyagenttools.com'
$env:PACT_LOCAL_ACCOUNTS = '8'
$env:PACT_LOCAL_MINUTES = '20'
$env:PACT_LOCAL_INTERVAL_SECONDS = '300'
$env:PACT_LOCAL_REQUEST_CAP = '100'
node scripts/local-population/runner.mjs
node scripts/local-population/audit.mjs
```

Defaults are four accounts, twenty minutes, one turn per five minutes, 100 actual dispatch attempts, 16,384-token context, **1,000 output tokens**, ninety-second request timeout. Completed capacity and overnight runs retain their original immutable 600-token setting. Limits: 100 accounts, two hours, 2,000 requests; they are operator safeguards, not demonstrated capacity. All environment configuration is immutable on resume, including model digest. Retries are not automatic and failures consume the request budget. Limits never reset on restart. An experiment stops on deadline, request cap, STOP file or all actors being blocked.

The model returns typed action objects. A per-turn JSON schema restricts available operation variants, cohort IDs, free builder slots, and observed offer IDs/versions. Unseen signatures and duplicate contact requests are excluded at generation; application validation remains authoritative. Before each building dispatch, the client also rechecks fresh stock, building availability and the chosen slot, so a first action can invalidate a second action in the same plan. Counteroffers may change rates/resources within the experiment bounds, preserving observed A/B parties. Empty plans are valid.

The separate simulated-human controller creates the guest, sets its initial mandate, accepts **cohort-only** incoming contacts and now resolves bounded authority exceptions under the 9 October PACT-134 founder assignment. The model cannot accept contacts or approve exceptions. Models choose at most three actions from building/contact/message/small reciprocal supply operations. The server still enforces all stock, authority, quota and version checks. No raids, transfers, publications or non-cohort targets are permitted. One serial process shares local model weights across independent player memories.

## Automatic simulated-owner decisions

New local runs default to `PACT_LOCAL_OWNER_APPROVALS=bounded`. This is the owner's deterministic controller, separate from inference and authenticated with its own synthetic guest cookie/CSRF credentials. Ordinary permitted moves still use the Envoy's mandate. Only `FORBIDDEN`, `INSUFFICIENT_ALLOWANCE` or `APPROVAL_REQUIRED` on a runner-generated, locally validated exact action can enter the owner path. Stock, reserve, tick, quota and stale-state denials are never escalated as authority exceptions.

Building and cold-contact exceptions use `pact_approval_propose_v1`, owner-authenticated review, then the normal owner POST approval. Re-proposing the original command verifies its immutable server hash before review; mismatched IDs or expired requests are not approved. Supply offer/counter/sign actions are absent from the frozen approval-proposal v1 schema, so those bounded owner decisions use the normal first-party `/v1/commands` route with the **same command ID and exact action**, rather than widening that schema or exposing an approval tool to the model. Server-authenticated human permits and normal rules remain authoritative.

Defaults: **20 owner decisions per account per run**, with **500 whole units of each resource** as a separate exception ceiling. Configure `PACT_LOCAL_OWNER_APPROVAL_CAP` (0–100) and `PACT_LOCAL_OWNER_RESOURCE_LIMIT` (0–1000); `PACT_LOCAL_OWNER_APPROVALS=off` disables the controller. Ceilings and decisions are immutable/persisted with the run. A building charges its full displayed iron/silver cost conservatively, contact charges two silver, and a signature charges its full outgoing hour. Expected incoming trade never offsets this budget. Failed decisions retain their charged allowance. Offers/counters consume decision count but reserve no resources until signing. Small reciprocal one-hour/no-bond/zero-notice terms are rechecked on signature.

Only actors created with the local synthetic-owner policy marker are eligible. The runner never scans and approves arbitrary pending requests. It does not raise mandates or automate real player approvals. After a lost response, pending decisions reconcile the original receipt, or retry the original proposal/owner command without a fresh ID or budget reset. An inconclusive result prevents later writes; a stopped/deadline-expired run cannot approve. Exhausted ceilings leave the action uncommitted rather than asking you to approve it manually.

The completed PACT-133 run remains stopped with its original configuration. New trials include these owner-policy settings; no finished run or historical request budget is reset. Authority exceptions add HTTP/proposal overhead; the prior 48-account capacity result did not measure heavy automatic-approval traffic. [Approval implementation and live evidence](../implementation/reports/local-owner-approvals-20261009.md).

State reads remain subject to 120/hour per kingdom. A normal turn uses one guide, up to two conversation reads, and a fresh guide per action, plus a guide after contact acceptance when needed. Five-minute turns therefore leave quota headroom; outgoing messages and contract writes must still fit daily limits. Stale output is discarded after stop/deadline. Missed turns coalesce and never replay in a catch-up burst.

## Stop, resume and evidence

### Running 50-account background task — 9 October

**Finished at the authorized 08:00 Berlin deadline.** Task exit result 0; 2,969 requests, 47 owners eligible and three blocked on repeated truncated output. No new run is active. Historical setup and bounds below remain the operating record. [Final investigation](../implementation/reports/local-population-final-20261009.md).

PACT-135 started a distinct two-hour run over **50 existing synthetic owners**: all 48 PACT-133 capacity owners and the first two pilot owners. Their kingdoms, mandates, stock, grants and memory were retained. Source runs remain finished with their original counters; no accounts were created and no finished source runner was resumed. The new run has its own explicit bounds and native, owner-only state directory.

- Windows task: `PACT Local Players 50 20261009`, current-user interactive/limited privileges, hidden launcher, one instance.
- Run: `local-background-1791507229557-092e5567`, started 02:53:49 Berlin, 9 October 2026; original end 04:53:49. Under the explicit PACT-136 extension, the effective end is **08:00 Berlin today** and the total ceiling is **4,000 model dispatch attempts**, including attempts already consumed (original ceiling 1,250).
- Fifty accounts, minimum five minutes between each owner's turns, one serial `qwen3.5:4b` worker, bounded automatic owner decisions enabled. Starts are staggered; model/HTTP work and failures can delay a turn, so an exact count at every wall-clock quarter-hour is not guaranteed.
- Native state: `C:/Users/ENDORFY/pact-local-background-50-20261009`. `status.json` shows owner turns and blocked actors; `supervisor.json` updates its heartbeat every fifteen seconds. Both are credential-free. Private state remains protected separately.

The task runs independently of Codex/chat. It retries an abnormal process exit up to three times, one minute apart, and resumes that **same** saved run after logon. The supervisor clears a stale lock only after confirming the stored PID is dead; an existing live PID prevents a second worker. Configuration, deadline and consumed requests always come from the saved state. A terminal run is a no-op at later task starts; this task never creates a new experiment or resets budgets automatically. The OS execution limit was increased to six hours for the authorized extension; the application has the earlier fixed 08:00 Berlin deadline.

This is local GPU execution: Windows must remain on/awake, the account signed in, Ollama available and the repository reachable. It is not an always-on VPS inference service. A fifteen-second heartbeat becoming stale is evidence to investigate rather than proof a scheduler is healthy.

```powershell
Get-ScheduledTask -TaskName 'PACT Local Players 50 20261009'
Get-ScheduledTaskInfo -TaskName 'PACT Local Players 50 20261009'
Get-Content 'C:\Users\ENDORFY\pact-local-background-50-20261009\supervisor.json'
# Graceful stop: stops new model/game work; cannot reset or resume a stopped trial.
New-Item -ItemType File 'C:\Users\ENDORFY\pact-local-background-50-20261009\STOP'
# Resume only an interrupted/crashed, nonterminal run with its original remaining bounds.
Start-ScheduledTask -TaskName 'PACT Local Players 50 20261009'
```

The task's protected `launch.ps1` invokes `supervisor.mjs --state <native-directory>` with Windows Node 24; output goes to `worker.log`. The supervisor derives environment values from private state, so unrelated shell settings cannot replace the original limits. [Background startup evidence](../implementation/reports/local-background-20261009.md).

### Authorized extension — 9 October

PACT-136 explicitly extended this same live run to **08:00 Berlin / 06:00 UTC, 9 October**, with **4,000 total dispatch attempts**. A brief graceful operator pause preserved 236 consumed requests and all 50 actors, including owner decision/resource ceilings and pending exact commands. The same background task resumed; no accounts or budgets were reset. [Extension and resumed health evidence](../implementation/reports/local-extension-20261009.md).

`config.requestCap` and original duration remain the historical immutable configuration. `status.json` exposes `effectiveRequestCap`, `originalEndsAt`, the current `endsAt` and authorization records; `supervisor.json` reports the effective bounds. Ordinary crash recovery cannot grant extensions. A separate locked operator function requires explicit authorization, same run ID, a non-expired interrupted run (or deliberate STOP), matching previous bounds and an increased deadline. It refuses completed/expired runs and bounds extensions to eight hours from original start and 5,000 total attempts. These extension ceilings do not change the two-hour/2,000-attempt safeguards for new trials. No automatic extension or rollover is configured.

Create an empty `STOP` file in the state directory to stop new work. The client permits an already-dispatched call to finish within its timeout; it cannot issue game actions after stop. The process closes each MCP session in `finally`. A process crash can leave a fifteen-minute write lease, which normal server expiry handles.

`runner.lock` prevents two processes from using the same state. Never remove it until the previous process is confirmed dead. Then remove only that lock and resume with identical configuration. Pending commands reconcile their original receipt or replay the **same ID and exact payload**; an inconclusive receipt blocks further writes. A finished/stopped run cannot restart. New trials require new state directories and retain existing kingdoms; they must not silently reset the historical experiment.

- `private-state.json`: owner sessions, guest entry keys and OAuth tokens. Never print, publish or commit it.
- `status.json`, `capacity.json`: operational state and public cohort identities, no credentials.
- `events.jsonl`: synthetic prompts/results, receipt evidence and timings. May contain owner-only synthetic state; publish only selected credential-free summaries.
- `benchmark.json`, `benchmark-samples.json`: isolated synthetic model measurements.

Audit deduplicates command IDs and distinguishes model requests/results, agent commits, definitive command denials and simulated-human contact acceptances. Capacity from complete live turns includes network/tool/session overhead; inference-only capacity does not. Repeat-turn lateness excludes each actor's startup turn. Verify game clock and infrastructure separately. Account creation and receipt success do not establish useful negotiation or sustained performance.

## Checks

### Reliability follow-up — PACT-137

[The completed investigation](../implementation/reports/local-reliability-20261009.md) quantifies negotiation and separates live coverage, regression tests and unverified mechanics. New prompts bound planning text to 120 characters, reasons to 80 and messages to 160. Schema generation and fresh validation exclude missing building prerequisites, unchanged counters, already-signed/expired offers and known local eight-contract saturation. Both reciprocal flows may change in a counter. A counterpart's private capacity remains unknown; server denials remain authoritative.

Persisted pacing tracks observed commits, not exact remaining server quota. Rate limits back off the group for a game day; queue-full and duplicate-message cooldowns last thirty game minutes. Reads rotate across contacts. These conservative policies can underuse quota from previous runs; they never alter allowances. Status/audit distinguish attempted, successful and failed turns; historical `turns` remains attempts. Truncation retains safe usage metadata and never admits partial output.

Operator tools use new protected native state and explicit bounds; they never resume a terminal population run:

- `replay.mjs`: set `PACT_LOCAL_REPLAY_EVENTS` to recorded synthetic events and `PACT_LOCAL_REPLAY_SAMPLES` (1–100). Imports no game client; inference only. Set the ordinary request/deadline configuration explicitly. Replay excludes lost failed-response payloads and is not an endurance benchmark.
- `probe.mjs`: zero-inference public-interface verification with two new synthetic owners, at most forty direct attempts and two minutes. Owner decision/resource ceilings remain separate. Ordinary commitments finish through server ticks.
- `repair-waiting.mjs --source <protected-finished-private-state>`: defaults to inspection. `--apply` cancels only prerequisite-blocked waiting instructions through normal owner commands, at most sixteen cancels/two minutes. Preserves stock-waiting and active instructions. Only `TICK_PENDING` retries, at most eight times with the same ID/payload. Resume the same repair state and remaining deadline; preserve the finished source archive. Latest refreshed credentials stay in protected repair/probe state.
- `negotiations.mjs --events <events.jsonl> --server <safe-server-export.json> --output <analysis.json>`: deduplicated offer-to-activation wall latency and true term changes. Game-time contract duration is separate; unactivated offers do not enter latency percentiles.

Final broader-schema replay accepted 47/48 plans, rejected one invented offer ID and had zero truncations. The old 50-owner endurance test has not been repeated with the new token ceiling. No population loop is active.

The 9 October measurement verified 48 independent Qwen3.5 4B accounts with a minimum five-minute interval on the RTX 5070 Ti, one serial worker, 16,384 context and 600 output tokens. Full-turn p95 was 3.890 seconds: 53 accounts at five minutes or 107 at ten minutes with 30% headroom are projections. Start with the verified 48; the current configuration ceiling is 100 and larger cohorts are unverified. Warm the model first. The test stopped after seventeen minutes, so it does not establish multi-day stability or successful contract settlement. See the report for exact commands, denials and final server evidence.

```sh
node --test scripts/local-population/*.test.mjs scripts/population/*.test.mjs
npx biome check scripts/local-population
npm run typecheck
python3 docs/implementation/backlog.py render
python3 docs/implementation/backlog.py check
git diff --check
```

[Assignment and measured results](../implementation/reports/local-population-20261009.md).
