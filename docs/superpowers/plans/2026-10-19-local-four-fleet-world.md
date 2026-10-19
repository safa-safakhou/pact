# Fresh Local PACT World and Four Fleet Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans to implement this plan task-by-task. No delegation. This is a proposed plan, not authorization to build, provision accounts, pause existing work or invoke models.

**Goal:** Run a separately isolated local PACT world with twelve new kingdoms in four matched fleet groups for one bounded 24-hour observation.

**Architecture:** A new loopback-only PACT Compose stack and database supplies ordinary authenticated game operations, events and outlook. One independent native Fleet deployment hosts four profiles behind shared admission/provider capacity, with native Ollama and separately metered Laya. An opt-in experiment controller enforces the same per-actor half-hour allowance across legacy and modern admission; a separate observer measures outcomes.

**Tech Stack:** Existing Node 24.21/npm 11.19, TypeScript/Fastify/React, PostgreSQL 17, Docker Compose, native Ollama 0.40.3 and the existing pinned Nemotron Q4_K_M weights. Pin actual image/helper dependencies before execution; no latest tags or model downloads by default.

**Spec:** [Local four-fleet world design](../specs/2026-10-19-local-four-fleet-world-design.md). Read it and both repositories' current AGENTS.md before implementation. It supersedes the older 100-server-plus-20-local proposal only for this proposed isolated twelve-actor Mac pilot.

## Global constraints

- Current authority: documentation and local commits only. All checklist items below are future work. No test can point to installed or remote game/Fleet databases.
- Existing worlds, grant secrets, cohorts, counters, unknowns, terminal populations and raw evidence remain intact. Never use root `.env`, default Compose projects or ports 5432/5439/8820 for this stack.
- Exactly four groups×3, one shared model/thinking setting, ordinary rules, matched owner preferences/mandates and no synthetic-owner exception controller. Only legacy cognition uses Laya.
- Stage Q ≤32 actual model executions/1280000 reservations/16 helpers/90 min. Stage W ≤1152 executions/46080000 reservations/576 helpers/24h. No unused-grant transfer or automatic renewal.
- W actor cap 96 calls; cohort cap 288; every actor at most 2 calls and 2 commands per 30-minute window. Calls/known corrections/reads/events share caps. Reserve before dispatch; do not refund or fabricate unknown usage.
- Single provider slot, call 90 s/turn 120 s/input 24000 bytes/output 2000/context 32768/per-call allocation 40000, thinking true. At most 2 model executions/2 commands per turn; global 15 s quiet interval after a turn.
- The new world uses a distinct never-reused origin, keys and database generation. No canonical cutover, full-world reset operator or generic renewal platform is part of this task.

## Review focus

1. Existing local Fleet reports live=true: no competing GPU work is silently paused/reconfigured; record approved identities/intents and drain before exclusive admission (Task 1/5).
2. Legacy and modern dispatch paths, event bursts and restarts must all charge the same actor/window and deadline; a UI timer is not enforcement (Task 2).
3. A valid memory can be stored but not delivered; offered/accepted helper choices and final source IDs must remain distinguishable (Task 3/7).
4. Same-origin database replacement, foreign credentials or uncertain enrollment must stop rather than mint replacement identities or reuse events/memory (Task 1/4).
5. The deadline must stop inference safely while preserving pending effects and finite-cohort semantics; observation is right-censored, not a promise of later fulfilment (Task 2/8).

## Source-grounded status

Already implemented: profile drafts/compatibility and common `Store.setStates` transaction; `CredentialBroker.provision` with persisted entry keys; legacy bridge, reactive and continuity engines; scoped events/outlook with default-off flags; canonical receipts; independent route capacity and per-cohort finite caps; model-output correction; encrypted cognition/telemetry; inspection/export.

Not established for this pilot: this Mac's provider/helper qualification; loopback full-stack packaging; same-run per-actor half-hour fairness across both admission paths; shared helper ceiling; restart-safe common T0/deadline monitor; full-day outcome/recall capture. These must be implemented/verified before W. No claim is made that generic world incarnation/renewal features now exist.

Inspected baselines: PACT `df22af95da50ce9f7eef2207402e674404531ffb`, Fleet `421ad90` (resolve full SHA in manifest). Final experiment source will include reviewed controls from this plan; never launch under these baseline hashes while running uncommitted control changes.

## File and interface map (proposed files do not exist yet)

| Repository/path | Responsibility |
|---|---|
| PACT `infra/local-world/compose.yaml`, `Caddyfile`, `env.example` | Dedicated loopback stack, explicit process/secrets/volume/image wiring |
| PACT `scripts/local-world/prepare.mjs`, `verify.mjs`, `snapshot.mjs` | Refuse existing targets, validate stack/generation, encrypted snapshot/isolated restore; no inference |
| PACT `scripts/local-world/observe.mjs` | Read-only local game projection/outcome snapshots, no command or message acknowledgment |
| PACT `tests/unit/local-world-setup.test.ts`, `tests/integration/local-world.test.ts` | Target isolation, ordinary founding/clock/lease/interface acceptance |
| Fleet `src/experiments/local-world.ts`, `helper-meter.ts`, new next-numbered experiment migration | Immutable manifest, actor/window/stage caps, monitor lease, helper journal |
| Fleet `src/store.ts:reserveCall`, `src/platform/admission.ts:decideOnce`, `src/platform/execution.ts`, `src/runtime.ts`, `src/worker.ts` | Opt-in experiment admission/fairness/command limits and clean drain, no changed defaults |
| Fleet `scripts/local-world.ts` | Strict prepare/qualify/enroll/start/status/close operations; no implicit transitions |
| Fleet `tests/unit/local-world.test.ts`, `tests/integration/local-world.test.ts` | Dual-engine admission, atomic start, helper caps and crash/deadline preservation |
| Fleet `tests/acceptance/local-world.test.ts` | Actual paired PACT handlers with fake provider, all four profiles |
| Both repositories' dated completion reports | Setup verification, run/checkpoint/final evidence; no fabricated tracker state |

New migrations use the next available number after rechecking actual inventories; do not renumber existing migrations. New experiment tables are Fleet-owned. No new game rule/migration is needed solely to create an additional empty local instance.

### Task 1: Build an isolated, reproducible local stack

**Consumes:** pinned repository revisions, Node 24, Docker capacity, proposed ports and a new private run ID. **Produces:** private `local-world.launch.v1` manifest with immutable run/source/image/runtime/model/helper/DB-generation IDs, selected actors and `approved:false`; all secrets referenced by file path, never embedded in Git.

- [ ] Test preparation refusal for an existing state directory/project/volume, occupied port, shared root `.env`, non-loopback game/provider URL and missing fresh secrets; assert no existing process/container is stopped and no model endpoint is called.
- [ ] Add PACT local-world packaging using the current root Dockerfile/entrypoint and production gateway patterns, without inheriting the production archive/WAL topology. Run PACT Postgres, gateway/web, API, rules, seals and notification projection only. Keep inference/channel/outbound email/push/A2A off. Use fresh protected operator/deletion/key files required by production startup; do not weaken startup checks.
- [ ] Use Compose project `pact-local-<runId>`, distinct named volumes, PACT origin `http://127.0.0.1:3400`, DB publication 5451. Separate Fleet DB on 5452; native Fleet console 8830, private state/release paths. Check ports again; collision requires a revised manifest before any account is created, never stopping the occupant.
- [ ] Verify current hardware/disk/provider metadata without generation. Require ≥30 GiB free to begin setup, ≥15 GiB throughout execution, Docker storage headroom and planned state ≤10 GiB; memory plan reserves ≥12 GiB for macOS/other work. Current observed 48 GiB free is a dated measurement, not a reservation.
- [ ] Record existing local Fleet/GPU consumers read-only. Get a concrete approved pause/restoration scope before altering any; no server or SSH-tunnel target is inspected. If exclusive inference cannot be obtained, do not start Q/W.
- [ ] `prepare.mjs` writes a fresh run sentinel before provisioning and refuses reuse. Pin gateway origin, DB cluster/database/volume identity and independent keys in the manifest. `verify.mjs` fails on changed generation, foreign retained binding, source/image mismatch or reused origin. Test old credentials/cursors against the isolated world and reject them.
- [ ] Build from clean immutable source exports with fresh lockfile installs, build PACT packages before unit tests, apply ordinary migrations to only the new empty database. Fleet migrations run only on its new DB. Assert zero game accounts/kingdoms and no old rows/credentials before enrollment.
- [ ] Run offline/fake-provider stack checks and commit Task 1. No real provider/helper call or game enrollment is part of this task.

### Task 2: Enforce the bounded run across all four profiles

**Consumes:** manifest and existing Store/ModelAdmission/CommandExecutor. **Produces:** opt-in `LocalWorldRun` with `register`, `start`, `reserveModel`, `reserveCommand`, `heartbeat`, `beginDrain`, `close` operations; journaled run/stage/actor/window bindings. Existing non-experiment cohorts retain existing semantics.

- [ ] Write failing tests: two legacy/modern callers racing on the last actor slot admit one; the third call in one actor/window is refused; unused slots do not carry forward; events/read/correction count; all four cohort ceilings sum to 1152; refused pre-dispatch work does not pretend reported usage; actual dispatched uncertainty keeps its original allocation.
- [ ] Add immutable `Q` and `W` registrations linked by report digest, without reopening old diagnostic grants. Q cap 32/1280000; W children 288/11520000 each, actor 96/3840000 each. Use finite, lifetime budgets rather than UTC daily counters. No migration of historical cohorts.
- [ ] Implement optional registration lookup in both actual reservation paths in the same Fleet transaction/lock order as ledger reservation; never rely on an observer to count after dispatch. Enforce monitor lease, approved manifest/source/provider, stage time, actor allowance and uncertainty gate before dispatch. Check available opportunity before context/helper work, then reserve atomically before the actual model request. Keep ordinary per-call allocation rows as the accounting source of truth. Usage recording or command-journal uncertainty must atomically fence the run before another actor can dispatch; the observer is an additional check, not the uncertainty gate.
- [ ] Half-hour index is `floor((now−T0)/1800000)` for indices 0…47. At most two model calls and two new canonical command IDs/actor/index, including event-triggered tasks. Retries of the identical command reconcile its receipt, not spend authority under a replacement ID. Saturated tasks defer/coalesce to the next eligible slot, preserving event metadata and gap coverage.
- [ ] Add atomic four-group start using existing `Store.setStates(ids,"running",true,true)` within the run's start transaction: all profiles/actors/policies/credentials validated; one T0, T1=T0+24h, common anchors, no partial start. Initial legacy due phases remain the existing per-cohort ordinal phases; rotate cohort service priority by slot to avoid a permanent group-order advantage. Record actual queue order rather than claiming perfectly interleaved starts.
- [ ] Runtime sets `maxConcurrency=1`, route capacity 1 and at least 15 s quiet time between finished turns. Reactive periodic review=30 min with event categories `completion,conversation,contact,offer,contract,raid,resource`; respect quiet cards; legacy wakes off. Seed exactly one ordinary initial snapshot-review task per reactive actor at its first T0 phase, and initialize its next periodic review one interval later. Test that a quiet new world still produces two smoke-period turns, with no duplicate timed lane, pre-T0 inference or extra budget. Periodic/event lanes must not duplicate inference or exceed actor caps.
- [ ] At T1−120 s stop new turns/requests, let bounded existing work drain, and close by T1. Stop admissions on a stale (>90 s) independent monitor lease; on restart neither create a new T0 nor catch up missed slots. Test sleep/wake across deadline, monitor loss, unknown usage, pending receipt and crash after reservation. Retain unknowns; do not automatically review them.
- [ ] Test the original unregistered legacy/parity and modern acceptance suites unchanged; run checks/build/boundaries. Commit Task 2. End-of-window/finite cohorts remain terminal; no renewal bypass is implemented.

### Task 3: Meter the helper and retain decision-to-outcome evidence

**Consumes:** run registration, Laya0.4.6/certificate, retained observability and PACT projections. **Produces:** counted helper gateway plus timestamped coverage-aware observation journal.

- [ ] Test reserve-before-forward helper accounting, Q16/W576 limits, duplicate/ambiguous requests, no retry on abstention, 3 s timeout, restart preservation and no hidden warm-up calls. A dispatched helper timeout counts; private raw certificate/response remains encrypted.
- [ ] Implement `HelperMeter` only for the opt-in experiment: native helper 8833, counted gateway 8834, legacy cognition points to gateway. Preserve the current threshold 0.65 and model/certificate. Exhaustion or unknown helper dispatch atomically fences further run admission even if the legacy recall catch block returns deterministic fallback; test no subsequent model dispatch. Verify at most two helper attempts per model opportunity under dense packing; if this assumption fails, revise the reviewed budget, not the model's original evidence or runtime silently.
- [ ] Verify helper dependencies/weights on this Mac without generation; record availability. If unavailable, install/qualify its pinned environment only under the later concrete setup authorization. No Group B launch as an unlabelled helper-free substitute.
- [ ] Retain accepted state updates, retained originals, retrieval rank/candidate IDs, helper offered/accepted IDs, final delivered source IDs/omissions, exact allocation/attempt links, command IDs/receipts and later dated game outcomes. Capture absence of an update separately from rejected storage. No extra summarizer/model calls.
- [ ] Separate observer reads its own Fleet operational tables and local PACT authenticated owner projections without acknowledge-on-read conversation APIs; any game DB assessment is read-only, scoped to this new instance and outside Fleet's runtime adapter. Test that observation issues no commands, refresh replay, inference or message acknowledgments.
- [ ] Add full-day encrypted evidence segments because ordinary report export truncates newest turns. Expose aggregate operational snapshots without prompts/messages/secrets. Warn on capture truncation; missing evidence remains missing. Commit Task 3 after tests.

### Task 4: Verify setup, backup/restore and actual local compatibility

**Consumes:** committed Task 1–3 source. **Produces:** source/packaging/restore acceptance and a ready-but-disarmed launch manifest.

- [ ] PACT: `npm ci`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run check:non-game`, `npm test -- --maxWorkers=2`, isolated migrations then `npm run test:integration -- --maxWorkers=2`, `npm run eval:offline`, `npm run check:dependencies`, `npm audit`, backlog check. Set only dedicated synthetic `pact_test` URLs; keep real local-world DB separate. Reproduce CI public-schema-before-tests order.
- [ ] Fleet: `npm ci`, `npm run check`, `npm test`, `npm run test:integration`, `npm run build`, `npm run check:boundaries`, `npm run test:acceptance`, `npm audit`; integration uses dedicated `fleet_test`, not world/Fleet state. Paired tests set exact built PACT path and PACT test URL as documented in `fleet/docs/profile-qualification.md`. Linux-only fixtures require an isolated Linux verification image; native skips are not full acceptance.
- [ ] Fake-provider paired tests: all four profiles complete observation→decision→ordinary command/receipt→later outcome, and cognitive profiles persist/deliver a cited update. Refuse specialist profile; verify exact feed/outlook versions, ownership/cursor/gap handling and no duplicate commitment after retry/restart.
- [ ] New API flag readback: `PACT_AGENT_EVENTS_ENABLED=1`, `PACT_AGENT_OUTLOOK_ENABLED=1`; notification worker also has events=1. Fleet config pins `FLEET_PACT_EVENT_FEED_VERSION=pact.agent-events.v1`, `FLEET_PACT_OUTLOOK_VERSION=pact.agent-outlook.v1`, selected instance and game URL. Verify API capability and actual event projection, not just environment strings. Built-in live model calls remain off.
- [ ] Encrypt an initial PACT/Fleet snapshot and restore it into a network-disabled disposable clone. Compare complete relevant rows/keys and authenticate populated ciphertext fixtures. Use separate key custody and never restore a pre-run dump over later gameplay. Archive/backup size counts toward disk gates.
- [ ] Record exact new images/commits/config/model/helper digests, ports and initial state in private manifest. Stop owned test fixtures, preserve new stack disarmed, commit reports. No Stage Q/W until concrete execution scope is supplied.

### Task 5: Qualify this Mac within its new Q grant

**Consumes:** approved Q manifest and approved exclusive local GPU window. **Produces:** immutable Q report, pass/fail and exact remaining/counted usage; no transfer of unused Q calls.

- [ ] Record active local cohort identities/intent/settings and drain only the approved existing Mac GPU consumers using admission fencing/maintenance first. Do not use an ordinary aborting pause on an in-flight request. Preserve pending/unknown work; an inability to reach safe quiescence blocks Q. Existing game/server worlds are not paused or contacted.
- [ ] Register UTC Q start/end≤90 min, 8 executions/profile, 32 aggregate, 16 helper ceiling. Use purely synthetic ports, existing actual engine paths and withheld commands; exclude game credentials. Every attempt reserves 40000 before dispatch.
- [ ] Run four controlled turns/profile: read/action envelope; first and second turns of a retained-evidence sequence where supported; untrusted/ambiguous source case. Ordinary waits and optional memory omissions remain valid observations. No generated probe, retry, helper call or warm-up outside the journal.
- [ ] Pass operational gate only with all planned turns complete, known usage, valid/safely recovered decisions within original limits, no authority/citation bypass, no uncertain command/spend, and p95 whole-turn time ≤60 s. Report helper abstentions/selection and optional-write coverage separately. Failure closes Q; unused allowance does not authorize another run.
- [ ] Record Q pass source/runtime/config digest. W requires the same pins; any change needs explicit requalification/review. Publish a credential-free report and commit it; do not imply live strategic quality.

### Task 6: Enroll twelve kingdoms and start W

**Consumes:** passed Q, approved W grant, isolated stack and exact policy from design. **Produces:** four three-actor cohorts with one common T0/T1 and 12 verified ordinary bindings.

- [ ] Create inactive profile drafts through `ProfileConsole.createProfileDraft`, three actors each, intervalMinutes=30, guardian/merchant/diplomat preferences. Model settings are identical except legacy B's `cognition=llm-centered-v1,recallAssist=laya-recall-v1`; A/C/D omit those legacy options. Preview must accept all four and reject unsupported coordination.
- [ ] Enable account enrollment only in this new Fleet while its worker is fenced and every cohort is inactive. Provision interleaved A1…D3 using `CredentialBroker.provision` and persisted entry keys. Use exact mandate in the design and the source-verified `socialDelegation:{mode:"agent_decides",allowedKingdomIds:[]}`. Read back policy and authenticated account/kingdom identity; uncertain provisioning halts, never creates a replacement actor.
- [ ] Set corresponding authenticated owner objectives through the existing versioned owner-intent path, preserving each matched role: guardian protects downside, merchant seeks advantageous production/trade, diplomat seeks useful relationships/agreements. Common goal: sustain and develop this kingdom under actual costs/obligations and its owner's authority. No invitation/contact/trade is prearranged. Record exact goal text and policy digests before configuration is consumed.
- [ ] Record starting stocks/buildings/founding times; no clock rewind/resource equalization. Keep normal clock running during ordinary founding. Require founding skew ≤10 game minutes or halt before W and revise interpretation/plan; do not erase those accounts to retry a cleaner start.
- [ ] Select T0 at least five minutes after last verified enrollment, T1=T0+24h; configure each finite cohort with callLimit=288/tokenLimit=11520000/deadlineAt=T1 and all exact per-turn limits above. Select consented private observation and account-autonomy guidance. Validate all 12 actor ceilings and capability/pin/lease/role/credential checks before atomic start. No application login credentials enter model context.
- [ ] Start atomically, record first actual dispatch times and local AC/awake assertion. Keep laptop on AC/lid open; use process-scoped assertions rather than global power changes. Work/sleep/network outages remain visible, not replayed missed turns.

### Task 7: Observe one bounded day

**Consumes:** W registration and supervisor/observer. **Produces:** +1h/+6h/+12h/+24h aggregate reports and protected traces.

- [ ] First hour is the smoke gate inside W: every actor completes two ordinary reported turns and no unknown/pending/identity/clock error. All twelve must be covered; WAIT is acceptable; action count is not a liveness test. If an actor misses coverage, fence all groups and report the cause rather than inject extra acceptance calls. Deadlines/budgets do not move.
- [ ] Independent observer checks every 30 s: heartbeat leases, local world clock, cohort/actor eligibility, exact usage, pending commands, provider queue, helper count, state growth/disk and external GPU competition. P95 queue delay >10 min for two consecutive half-hour windows is a capacity stop; do not speed the schedule or add concurrency.
- [ ] At checkpoints report each group's calls/allocations/known/unknown, useful completed development, stock/upkeep, contacts/replies/offers/signatures/delivery/default, actual threats and responses, waits/failures, missed opportunities/deadlines, helper candidate versus delivered choice, and proposed→stored→retrieved→delivered memory. Record no-opportunity denominators and censored pending obligations.
- [ ] Review twelve trace samples: one per actor, chosen by a declared rule (first available later turn after an earlier outcome), plus every uncertainty and a bounded sample of known failures. Do not cherry-pick only successful memory or social episodes. Cross-group messages remain untrusted input.
- [ ] Do not intervene in gameplay, grant authority, force memory/social activity, repair prompts mid-run or silently apply retrieval fixes. A source/config change closes comparability and requires a new reviewed phase/grant. A small interacting world can diagnose behavior; it cannot establish a statistical winner.

### Task 8: Close, preserve and report

**Consumes:** original T1, recorded stop conditions and clean-drain controls. **Produces:** terminal W receipt, final aggregate report, encrypted recoverable archive and prior-local-state restoration receipt if authorized/eligible.

- [ ] At T1−120 s close admissions without aborting known in-flight work. At T1 preserve original actor/binding/turn/ledger/receipt/cognition rows and set finite cohorts terminal through supported semantics. If anything remains uncertain, retain its gate and stop; do not manufacture clean termination or relabel unknown tokens.
- [ ] Freeze only this new local world via its supported clock pause. Record active builds, unsigned/active contracts and future due work as right-censored. No extra model calls or post-deadline gameplay. Snapshot and verify encrypted PACT/Fleet state and archives, with separate key storage; final restore verification uses an isolated clone, never the live world.
- [ ] Stop only owned pilot processes/containers after archive acceptance; retain volumes and manifests. Never issue an unqualified Compose down/remove-volume/prune against shared Docker. Preserve failure logs and unused caps as closed history.
- [ ] Restore only explicitly approved prior Mac runtime intent after checking exact identity, current eligibility, no new pending/unknown gates and original settings. If restoration cannot safely proceed, leave a concrete recovery instruction rather than automatically reviewing failures. Remove only experiment-owned awake assertions/helper processes.
- [ ] Write/commit final reports in both repositories with actual start/end, source/model/provider/helper pins, all 12 coverage, material outcomes versus proposals, memory pipeline omissions, known limits and no-winner conclusion unless evidence supports one. Suggested follow-up is chosen from observed failures; a longer run/new world requires a separate reviewed plan and budget.

## Summary for execution review

Recommended selection: twelve new local kingdoms, all Nemotron thinking=true; Q32 calls followed conditionally by one W24h run of at most1152 calls, total1184/47360000 reservations/592 helpers. No real start time is selected during planning. Source/control implementation and isolated stack acceptance come before any model work. The first hour of W is already budgeted, and existing local GPU consumers require an exact reviewed pause/restoration scope. No world or inference has been started by this document.
