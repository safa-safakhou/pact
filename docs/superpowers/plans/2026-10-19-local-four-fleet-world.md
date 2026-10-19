> Preparation authorized subsequently; see [actual preparation receipt](../../implementation/reports/local-world-preparation-20261019.md). No launch was requested. Superseding rulings: use native application processes with PostgreSQL-only containers, the existing certified helper, no added experiment restrictions/reserve floor, and the existing three-call/three-command turn structure. This checklist retains original planning provenance; the receipt records actual completed checks and remaining observation work.

# Fresh Local PACT World and Four Fleet Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task-by-task. No delegation. Planning only; this revision starts no world, account, model/helper inference or existing-service pause.

**Goal:** Observe twelve fresh kingdoms using four architectures for the same one-hour window, comparing achievements and recording unequal compute usage.

**Architecture:** A separate loopback PACT stack supplies ordinary authenticated game operations, scoped events and outlook. One new native Fleet deployment hosts all four profiles with shared provider capacity. A fail-closed one-hour run gate bounds execution by time; it does not normalize call counts or impose per-half-hour quotas.

**Tech Stack:** Existing Node24.21/npm11.19, TypeScript/Fastify/React, PostgreSQL17, Docker Compose, native Ollama0.40.3 and the installed pinned Nemotron Q4_K_M weights. Resolve full source/image/helper pins before execution.

**Spec:** [Local four-fleet world design](../specs/2026-10-19-local-four-fleet-world-design.md). This revision follows the founder's equal-time correction and supersedes the unexecuted 32-call preflight and 24-hour equal-compute proposal. All numerical defaults other than that correction remain proposed implementation choices.

## Global constraints

- Planning/local documentation commits only. No server or historical-runtime database access; tests use distinct synthetic databases.
- Four groups of three: legacy-loop/1, legacy-cognition/1, reactive-basic/1, reactive-cognition/1. Same Nemotron/thinking=true and matched guardian/merchant/diplomat owner objectives and mandates. Only legacy cognition uses Laya; specialist coordination is excluded.
- One common T0 and T1=T0+3600000 ms. Periodic review proposed at15 min for all; reactive groups additionally use eligible event wakes. No total-call, group-call, helper-count, per-actor/window or equal-token quota.
- Keep existing per-turn limits: at most2 calls/2 commands,90s call/120s turn,24000 input bytes,32768 context,2000 output setting,40000 reserved tokens/request. Use one shared provider slot; do not add an artificial cross-group cooling policy to equalize work.
- Fresh origin, state, databases, secrets and actors. Never load existing root .env, use existing ports5432/5439/8820, import old grants or change an old world's clock.
- Existing unknown usage/uncertain receipts remain review/reconciliation gates. No blind retry, identity replacement, historical restart or threshold/authority bypass.

## Review focus

1. Existing Mac Fleet reports live=true: identify and drain only explicitly approved competing local GPU work; retain prior intent/settings and do not abort a call (Task1/4).
2. A continuous accounting configuration must never permit indefinite execution: both legacy and modern model/helper/command paths require the live run window and monitor lease (Task2).
3. Reactive groups may make more requests: count that behavior, test no former half-hour quota remains, and disclose shared-provider queuing rather than asserting equal exposure (Task2/5).
4. Saved memory may be missing from delivered context; retain final source IDs separately from storage/helper selection and outcomes (Task3).
5. One-hour cutoff must not kill a known in-flight request or credit late effects inside the hour; preserve state for a later separately authorized continuation (Task6).

## Existing capability and work still required

Merged baselines inspected: PACT df22af95da50ce9f7eef2207402e674404531ffb and Fleet421ad90 (resolve full SHA). Existing APIs include profile drafts, Store.setStates common-anchor transactions, CredentialBroker.provision persisted entry keys, all four engines, events/outlook, shared route capacity, encrypted cognition/telemetry and receipts. Do not reinvent a generic engine or world reset.

Required before launch: isolated local packaging; verified helper availability; opt-in persistent time-window/monitor gate across both admission paths; safe cutoff/pause; coverage-aware usage/outcome capture. Earlier Windows provider qualification does not certify this Mac/Ollama0.40.3. This hour is the initial bounded live pilot; validate source/protocol plumbing offline beforehand and record real-runtime failures during the hour.

## File and interface map (new files are proposed)

| Repository/path | Responsibility |
|---|---|
| PACT infra/local-world/compose.yaml, Caddyfile, env.example | Dedicated loopback processes, explicit ports/volumes/secrets/images |
| PACT scripts/local-world/prepare.mjs, verify.mjs, snapshot.mjs | Target/generation refusal, setup checks, encrypted snapshot/isolated restore; no inference |
| PACT scripts/local-world/observe.mjs | Read-only local outcomes and cutoff snapshots without message acknowledgment |
| PACT tests/unit/local-world-setup.test.ts, tests/integration/local-world.test.ts | Isolation, ordinary founding, clock/lease/interface acceptance |
| Fleet src/experiments/local-world.ts, helper-meter.ts; next-numbered experiment migration | Immutable run window, monitor lease, closed state and usage journal; no equal-compute counter |
| Fleet src/store.ts, src/platform/admission.ts, src/platform/execution.ts, src/runtime.ts, src/worker.ts | Opt-in window check before either model path and new commands; safe common start/close, unchanged defaults |
| Fleet scripts/local-world.ts | Explicit prepare/enroll/start/status/close; no implicit activation |
| Fleet tests/unit/local-world.test.ts, tests/integration/local-world.test.ts, tests/acceptance/local-world.test.ts | Both paths, no call normalization, safe deadline/restart and actual paired handlers with fakes |
| Both repositories' dated reports | Setup, actual hour, final coverage/usage/outcomes and limitations |

New migration numbering is selected after rechecking inventories. Experiment state belongs to Fleet. A separate empty PACT instance needs no game-rule correction or generic world-reset migration.

### Task1: Prepare the isolated stack and exact resource scope

**Consumes:** source pins, new run ID, approved local operating scope. **Produces:** private local-world.launch.v2 manifest, initially disarmed, with exact source/image/provider/helper/model/policy/database/volume identities and selected operating limits.

- [ ] Test refusal of occupied ports, existing state/project/volumes, shared root .env, non-loopback URLs, old keys and replaced database generation. Assert preparation cannot stop an existing process, provision an account or invoke inference.
- [ ] Package PACT from its root Dockerfile and current entrypoint/gateway patterns: Postgres, gateway/web, API, rules, seals and notification/event projection. Keep PACT inference, external channel/email/push and A2A off. Supply fresh protected operator/deletion/identity/raid files; do not weaken startup checks or inherit production archive/WAL topology.
- [ ] Proposed loopback ports: PACT3400/DB5451, native Fleet8830/DB5452, native Laya8833/usage gateway8834, existing Ollama11434. Use project pact-local-<runId> and private state under ~/Library/Application Support/PACT Local Worlds/<runId>/. Check collisions again; revise the manifest before enrollment rather than stopping an occupant.
- [ ] Require30GiB free before setup and15GiB throughout execution; retained experiment state≤10GiB. Reserve12GiB memory headroom for macOS/other work. Metadata-only preflight pins Mac M4Pro/48GB, Ollama0.40.3 and Nemotron digest6cc467f054393a55e98a74098abde0c762ffb6d1d8cd64becf30458f38886197. Verify current values; no model upgrade/download or warm-up.
- [ ] Census local GPU consumers/active cohorts read-only. Record exact identities/intent/settings and an approved drain/pause/restoration scope before altering any. Do not inspect remote targets reached through existing SSH tunnels. If exclusive model access cannot be obtained, revise launch timing.
- [ ] Fresh DB/volume/origin/independent key identities are pinned in the run manifest. Never reuse this origin with a different DB generation; refuse changed identity/foreign bindings. This closed local procedure does not claim a generic game-owned incarnation handshake or reset operator.
- [ ] Use clean immutable source exports, fresh lockfile installs and built PACT packages. Apply migrations only to the new databases and verify empty game state before enrollment. Encrypt a snapshot and restore/authenticate it in a network-disabled clone. No real preflight model/helper batch is required.
- [ ] Commit setup source and acceptance documentation. No inference or enrollment occurs during source preparation.

### Task2: Implement one common hour without call normalization

**Consumes:** run manifest, existing Store/ModelAdmission/CommandExecutor. **Produces:** opt-in LocalWorldRun register/start/heartbeat/close, persisted original T0/T1, and a closed-by-default admission lease.

- [ ] Write failing tests: a registered reactive actor can make more than two requests within30min when legitimate events require it; differing group call counts never close the run; the old third-call/window and total32/1152 checks are absent. Existing per-turn/canonical authority checks still hold.
- [ ] Configure fresh cohorts using the existing continuous accounting shape: mode=continuous, callLimit=null, tokenLimit=null, deadlineAt=null, continuousExecutionAccepted=true. This is allowed only behind the independent one-hour run registration, not indefinite consent. Existing generic cohorts and old releases are unchanged.
- [ ] Test refusal before T0, at/after T1, when registration is absent/closed, on stale monitor lease>90s, after source/model/runtime mismatch and on restart past deadline. Check both Store.reserveCall and ModelAdmission.decideOnce, helper dispatch and new command submission. Registering or relabelling a cohort cannot bypass a closed window.
- [ ] Persist actual per-call allocations/usage with original ledger IDs before/after dispatch; helper gateway records every actual invocation/timeout/abstention. No total helper/token quota or hidden auto-top-up. Keep unknown/overrun gates, no selection-seeking retries, no extra summarizer calls.
- [ ] Atomically start all four groups through Store.setStates(ids,running,true,true) inside the run transaction, validating profiles/credentials/policies and writing T0/T1 once. Consumed source/profile settings remain immutable. Record actual dispatch phases/order and queue delay; do not claim equal turn counts or perfectly simultaneous service.
- [ ] Set legacy intervalMinutes=15, reactive periodicReviewMinutes=15 plus completion/conversation/contact/offer/contract/raid/resource wakes respecting quiet flags. Seed one ordinary initial snapshot review per reactive actor at its T0 phase, with its next periodic review one interval later; test no duplicate timed lane or pre-T0 inference. Preserve normal event coalescing, current cooldowns and one provider slot; no extra15s global gap.
- [ ] A new unknown spend, unresolved command or identity/authority mismatch atomically closes admission for this pilot before another dispatch. Known invalid outputs may recover under existing per-turn limits. Error-stop is an interrupted run, never a normal quota-based completion. Retain ledger/receipt history without automatic reviews.
- [ ] Test crash/sleep/wake across T1 and observer loss, queued events at cutoff, a request dispatched just before cutoff, late response and command receipt reconciliation. Never restart T0 or catch up expired work. Commit after original parity/modern acceptance/check/build/boundary checks.

### Task3: Retain useful outcomes and actual compute cost

**Consumes:** encrypted observability, owned PACT projections and optional helper. **Produces:** observer journal, per-group achievements and cost/coverage metrics.

- [ ] Validate pinned Laya0.4.6/revision/certificate availability on this Mac. Setup its dependencies only within approved installation scope. Route legacy cognition through a usage-recording gateway; preserve threshold0.65/3s timeout/abstention/fallback. Reactive cognition must not receive legacy Laya options. Unavailable helper before launch blocks the declared GroupB configuration, rather than silently substituting another group type.
- [ ] Test helper request/response accounting and attribution without invoking a real helper during offline checks. Keep current fallback behavior for ordinary runtime abstention/unavailability, labelled in outcomes; a no-selection result is not retried seeking success.
- [ ] Capture proposed/accepted memories, retained originals, retrieval ranks/candidates, helper offered/accepted IDs, final delivered IDs/omissions, model request/usage, command receipts and later outcomes. Distinguish no update, rejected update and stored-but-undelivered evidence.
- [ ] Observer uses only this run's read-only Fleet data and owned local game projections/snapshots, never an acknowledge-on-read conversation API. Test no inference/command/refresh replay/acknowledgment. Keep all prompt/message/cognitive detail encrypted outside Git and separate from public aggregates.
- [ ] Retain segmented full-hour evidence; normal newest20-turn exports may truncate an event-heavy group. Report all omitted/truncated coverage. No equality of evidence counts is manufactured. Commit source and privacy/coverage checks.

### Task4: Verify and enroll the new world

**Consumes:** committed controls/stack and explicit local execution/setup scope. **Produces:** twelve verified ordinary actor bindings ready for the single-hour start.

- [ ] PACT checks: npm ci, lint, typecheck, full build, check:non-game, unit tests with --maxWorkers=2, public migrations then integration with --maxWorkers=2, eval:offline, check:dependencies, audit, backlog check. Use dedicated pact_test only; no installed/world DB tests. Preserve CI-order fixture acceptance.
- [ ] Fleet checks: npm ci, check, unit, serial integration, build, check:boundaries, paired acceptance and audit. Use fleet_test and the exact built PACT acceptance path/URL documented in fleet/docs/profile-qualification.md; Linux-only process fixtures run in an isolated Linux verification image.
- [ ] Fake-provider paired acceptance covers all four profiles, cited continuity storage/delivery, ordinary commands→receipts→later outcomes, old/foreign credentials, event gaps and retry idempotency. Reject specialist coordination before inference. No32-call real-model gate is substituted for these tests.
- [ ] Read back PACT_AGENT_EVENTS_ENABLED=1 on new API and notification worker, PACT_AGENT_OUTLOOK_ENABLED=1 on API; Fleet pins pact.agent-events.v1 and pact.agent-outlook.v1 with the exact new instance/game URL. Verify actual projection/read behavior, not just flag strings. PACT's built-in live inference remains off.
- [ ] Drain and pause only explicitly approved competing Mac inference at a verified idle boundary. Preserve original running intent, identities, unknowns and settings. Do not use an aborting pause on an active call; uncertainty blocks the proposed operation, not a reason for blanket review.
- [ ] Create four inactive profile drafts of three actors, matched guardian/merchant/diplomat preferences. Same Ollama model/thinking=true; only B sets cognition=llm-centered-v1,recallAssist=laya-recall-v1. A/C/D omit those legacy options. Preview all four compatible; enable enrollment only on this new disarmed/fenced worker.
- [ ] Provision interleaved A1,B1,C1,D1,…,D3 using CredentialBroker.provision, persisted entry keys and exact mandate from design; socialDelegation={mode:agent_decides,allowedKingdomIds:[]}, no synthetic-owner exceptions. Read back complete authority and authenticated identities. Uncertain founding halts; never mint a replacement actor.
- [ ] Set matched authenticated owner objectives/account-autonomy guidance; record exact text and policy digests. Capture ordinary starting stocks/buildings and actual founding ages. No seeded relationships, gifted stock, clock/resource equalization or forced activity. Founding skew>10 game minutes requires revised interpretation before launch, not deletion/retry.
- [ ] Select UTC T0≥5min after last verified enrollment and T1=T0+1h. Record Berlin display times, metadata/pins/consent and resource budget. Keep laptop on AC/lid open and use process-scoped awake assertions, without global power changes. Atomic start is a separate explicit operation; the first real-model calls begin inside this hour.

### Task5: Observe achievement over the shared hour

**Consumes:** live run registration/observer. **Produces:** +15min, +30min and +60min reports with actual unequal request counts.

- [ ] Check every30s: clock/heartbeats, actors/credentials, original receipts, allocations/actual/unknown usage, provider queue, helper outcomes, disk/state growth and competing GPU work. Model requests and event bursts alone never stop the run; overload/queueing is measured and disclosed. Failure of a real resource/identity/uncertainty gate is labelled an interruption.
- [ ] At15/30/60min compare completed builds/development, stocks/production/upkeep, contacts/replies/proposals/signatures/actual delivery/default, threat exposure and response, legitimate waiting and pending obligations. Distinguish achievements of the kingdom from cosmetic achievement unlocks and command admission from later success.
- [ ] Alongside results show model/helper calls, reported input/output, reserved/unknown tokens, GPU/queue/turn times and actual decisions per actor. Report achievement per elapsed hour first; compute efficiency is a separate view. No actor is stopped because it used more calls than another.
- [ ] Inspect one declared trace per actor when available: first later decision after an earlier observed outcome, plus all uncertainty and a bounded sample of known failures. Include absent memories and stored-but-undelivered evidence; no positive-only selection. Unexposed threats, absent partners and late offers remain coverage limits.
- [ ] Do not force messages/alliances/memory, change prompts/permissions/thresholds/model mid-hour or silently fix retrieval during observation. One hour in an early shared world can reveal integration/interaction failures; it does not guarantee mature trade/war or prove an architecture winner.

### Task6: Close at one hour and preserve continuation state

**Consumes:** original T1 and the current journals/state. **Produces:** closed-window receipt, cutoff/final snapshots and paused preserved cohorts.

- [ ] Use the whole hour; no T1−120s early close. At T1 refuse new turns/model/helper requests and new command submissions. Let already-dispatched calls finish within their original remaining bounds, record usage and withhold their newly generated actions. Reconcile commands already sent using original IDs/receipts; never blindly replay.
- [ ] Capture and pause only the new world's clock via supported control; record actual snapshot/committed-game times and cutoff races. Exclude late admissions/effects from completed-within-hour results and list them separately. Queued builds/contracts/future obligations are right-censored, not successes/failures by assumption.
- [ ] Pause, preserve and archive cohorts rather than marking them terminal as an experiment reset. The registration is closed and ordinary resume cannot bypass it. Further observation requires an explicitly authorized new time window on the same eligible identities and lifetime counters; no automatic extension, replacement bindings or reset of usage/history.
- [ ] Encrypt PACT/Fleet dumps and private evidence, keep keys separately and verify restore/authentication in a network-disabled clone. No restore over later gameplay. Stop only owned processes/containers after preservation; never prune shared volumes/images or delete evidence.
- [ ] Restore only the approved prior Mac cohort intent if identities/settings/eligibility and unknown/pending gates permit it; otherwise report the concrete recovery step. Remove only experiment-owned helper/awake processes. Preserve old worlds and server fleets untouched.
- [ ] Commit final reports with exact times/source/provider pins, achievements at the cutoff, actual compute, interruptions, omissions, early-game limits and recommended next observation. Planning and a completed hour do not authorize an automatic longer run.

## Execution review summary

Twelve new kingdoms; four profiles; same local model and one shared hour. Legacy periodic review proposed every15min; reactive groups add real event wakes. No aggregate or per-window model/helper-call quota. Track usage/allocations faithfully and retain ordinary per-turn bounds and operational safeguards. Setup/offline checks precede launch; no mandatory32-call preflight. The former24h/1152-call/equal-half-hour plan is superseded and was never executed. No world or inference starts from this document.
