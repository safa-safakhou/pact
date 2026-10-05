# Bounded backend population experiment

**Completed at the original deadline; runner exited successfully. Local model worker stopped with 200 requests. Final results and evidence are in [the report](../implementation/reports/population-playtest-20261004.md).**

Owner assignment: 4 October 2026. Ten simulated humans, each with a separate GPT Luna envoy, plus ninety model-free scripted players. Ignore UI for this experiment. This is observational testing, not evidence of human enjoyment or production readiness.

## Completed run

- Run ID: `population-2026-10-04T21-13-18-681Z`.
- Start: 4 October 2026, 21:13:59 UTC (23:13:59 Europe/Berlin).
- Fixed end: 4 October 2026, 23:13:59 UTC (5 October, 01:13:59 Europe/Berlin).
- Maximum **200 actual model requests**, including failed upstream attempts and retries. The owner explicitly selected this cap. Existing Codex subscription; no dollar price is returned.
- Real production ticks and ordinary resource rules; no minted stock or accelerated live clock.
- VPS: `agentic@2.28.57.254`; existing public game `https://safa.dedyn.io/pact`.
- Dedicated Node 24 container: `pact-population-run`, existing image `pact-runtime:friends-play-20261004-3`, 256 MB memory and half a CPU.
- Server state: `/srv/pact/state/population-20261004`. Directory 0700; JSON/log files 0600.
- Local model worker: `C:/Users/ENDORFY/pact-population-20261004/model-worker.mjs`. The worker is now stopped; there is no remaining requirement to keep Windows awake for this run. Provider authentication remains local.
- Heartbeat: `observe-pact-population-playtest`, **PAUSED** after completion and delivery of the final findings. Its saved twenty-minute schedule is inactive. Do not restart this completed run or reset its cap/deadline.

## Live repair record

Owner-authorized backend fixes were deployed at 22:21:38 and 22:24:19 UTC on 4 October. API/inference use `pact-runtime:population-fixes-20261005-2`; gateway and other game workers retain their existing image. The rules worker was not restarted. The experiment container keeps its existing image and reloads patched briefing/client files from its mounted harness directory. Runtime `current.env` points to the fixed image for subsequent service recreation; the current mixed deployment is intentional.

Repairs address message read acknowledgment, byte-bounded excerpts, tick-pending vs paused errors, social queue error codes, false committed summaries, and agent unit/permission explanations. The 200-request cap, deadline and population are unchanged. Read the report's **Authorized live bug fixes** section and evidence before interpreting before/after behavior. Safe rollback source archives and build context are under the existing experiment directory; do not expose private-state or credentials.

## Design and authority

`scripts/population/runner.mjs` provisions 100 independent guest accounts through ordinary guest-entry APIs. Each has its own kingdom, mandate and OAuth MCP grant. An explicitly labelled simulated-human controller creates the account, sets the initial mandate, and accepts incoming cohort contacts. It does not approve agent exceptions. All game decisions use the normal MCP command dispatcher, normal write leases, receipts and stock checks.

The 90 scripts use deterministic policies, not model calls. They favour different resources, build production, seek two cohort neighbours, discuss small reciprocal trades, counter unfavourable terms, and sign only bounded affordable agreements. Their messages identify them as scripted. Up to three actions per turn, roughly every three minutes with serial pacing.

The ten Luna players have separate personas, memories, observations and reports. Each wave requests a structured plan, executes up to three valid actions, then requests a report grounded in actual receipts and resulting state. Waves are scheduled every twelve minutes, at most ten waves and two model jobs per player per wave. Failures and interrupted jobs can reduce completed waves; the cap is a ceiling, not a target. Empty plans are allowed. Models never receive other owners' private views or credentials.

The current experiment deliberately covers peaceful development and economic/social interaction: building, contact requests, messages, supply offers, counteroffers and signatures. It does not exercise raids, combat, politics, destructive actions or human approval exceptions. Supply terms are restricted to one hour, zero notice, no bonds and at most twelve whole resources per hour per direction. Scripted players use stricter stock/rate policies. This narrow scope is a test configuration, not a new authoritative game rule.

`briefing.mjs` presents the server's existing whole-resource facts and labelled rates. It translates receipt charges into whole units for the report. Raw game observations and receipts are retained separately. The server remains authoritative.

The local worker claims synthetic jobs over SSH, invokes `gpt-6-luna` with low reasoning and a strict output schema, and returns results over SSH. No shell, game tools, plugins or multiplayer credentials are exposed to those model calls. A local loopback proxy durably charges each actual upstream request before forwarding it; retries are configured to zero and still count if attempted. The server permits at most 200 jobs and the proxy independently enforces 200 upstream calls. No API key or subscription auth is copied to the VPS.

## Logs and evidence

- Server `events.jsonl`: timestamps, actor/role, observations, synthetic conversations, plans, requested action/command IDs, receipts, denials, uncertainty, reports, lifecycle and recovery events.
- Server `status.json`: safe operational status and public cohort identities.
- `node /srv/pact/state/population-20261004/harness/audit.mjs` exports a credential-free detailed summary suitable for the final report; it uses unique command IDs and retains per-actor game-time/building evidence.
- Server `jobs/`: synthetic prompt/result audit trail.
- Server `private-state.json`: **credentials and owner sessions; never publish, print or commit**.
- Local `model-events.jsonl`: actual upstream request sequence, HTTP status, model output, usage and job completion.
- Local `budget.json`: durable upstream count; **never reset for this experiment**.
- Local `codex-home/auth.json`: secret local Codex auth; never publish.
- Summary: `docs/implementation/reports/population-playtest-20261004.md`.

Observations can contain synthetic messages only from this cohort. Never broaden message collection to real users. Completed instructions and contracts must be distinguished from queued instructions and unsigned offers. Historical provisioning/lifecycle events include retries/restarts; count **unique kingdom IDs and command IDs**, not raw event rows.

## Inspect, stop, resume

Use the existing WSL SSH identity; do not show private-state content:

```sh
ssh -o BatchMode=yes -o ControlPath=/home/mnim/.ssh/pact-experience-%r@%h:%p agentic@2.28.57.254   node /srv/pact/state/population-20261004/harness/status.mjs
```

Create `/srv/pact/state/population-20261004/STOP` to stop the server experiment. Create `C:/Users/ENDORFY/pact-population-20261004/STOP` to stop the local worker. In-flight bounded calls may finish during shutdown; no new paid work starts beyond the fixed deadline.

A controlled container restart retains the original deadline, actor identity, pending command IDs and cumulative job count. After uncertain command delivery, reconcile the original receipt or replay the **same ID and exact action**; never fabricate a new ID to bypass uncertain completion. Definitive validation errors are recorded as rejections, not committed receipts. A temporary held lease is a wait, not an invitation to seize it.

Do not launch a duplicate local model worker: one process owns the budget proxy. On recovery check that the existing worker is stopped first and preserve budget.json. A claimed job is never blindly rerun: a crash can leave it uncompleted, and that loss is recorded.

`recover-sessions.mjs` is an **operator-only** remedy for the initial harness bug. With the runner stopped, it reads session IDs for the exact synthetic cohort with a SELECT and closes those sessions through their own public MCP grants. It does not alter the database or economy directly. Normal runs should not need it.

## Verification

```sh
node --test scripts/population/*.test.mjs
npx vitest run --config vitest.config.ts tests/unit/script-baseline.test.ts
npx vitest run --config vitest.integration.config.ts tests/integration/script-baseline.test.ts
npx biome check scripts/population scripts/lib/baseline-mcp.ts tests/unit/script-baseline.test.ts
npm run typecheck
git diff --check
```

The integration comparison uses synthetic players and a fake model; it is separate from the genuine Luna calls in this live experiment. Its optional external local-model comparison remains skipped unless configured.

Linear could not create the experiment issue because the workspace has reached its free issue limit. Keep the report as the execution record. Do not delete older issues, change their statuses, or purchase an upgrade.
