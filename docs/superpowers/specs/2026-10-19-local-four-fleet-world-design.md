# Fresh local PACT world with four Fleet profiles

19 October 2026. **Proposed design, not execution authorization.** The founder requested a concrete local setup, budget and observation plan. Revised following the founder's correction: compare achievement over equal wall-clock time, allowing architectures to consume different amounts of compute. The one-hour proposal is not yet a launch. Implementation is local, without delegation. [Execution plan](../plans/2026-10-19-local-four-fleet-world.md).

## Purpose and scope

Observe twelve fresh kingdoms for one shared hour in one ordinary PACT world: three each using `legacy-loop/1`, `legacy-cognition/1`, `reactive-basic/1` and `reactive-cognition/1`. Test whether the complete observation → optional memory → delivered context → decision → receipt → material outcome path works with real counterparties. This is an interacting-world pilot, not twelve independent replicas or a causal architecture ranking.

Use the same Nemotron weights and thinking=true across groups. Only legacy cognition selects Laya. Modern cognition uses its existing continuity path, without legacy cognition/recall model options. Do not add specialist coordination, another model, scripted counterparties, forced messages, manufactured scarcity, economic gifts, accelerated ticks or a survival reward. Respect ordinary game ownership, stock, quotas, leases, publication and human-only boundaries.

Each group has one guardian, merchant and diplomat preference, applied as the same authenticated owner objective for corresponding actors. The engine may act, negotiate, conserve or wait. No requirement to write memories or produce messages. Record absent activity and distinguish lack of opportunity from capability failure.

## Current evidence and feasibility

Planning inspected PACT `df22af95da50ce9f7eef2207402e674404531ffb` and Fleet `421ad90` on master. Source is merged; older handbook notices about unmerged implementations are historical. These pins are baselines, not a claim that future experiment controls already exist.

Read-only checks on this Mac found Apple M4 Pro/48 GB, approximately 48 GiB available disk, Ollama 0.40.3, and `nemotron-3-nano:4b` Q4_K_M digest `6cc467f054393a55e98a74098abde0c762ffb6d1d8cd64becf30458f38886197`. No model was loaded at that instant. The older qualification used another device and Ollama 0.35.1; it does not qualify this runtime. Laya availability/certificate on this Mac has not been established.

The existing local Fleet health at port 8820 reports `liveEnabled:true`; its active cohorts were not enumerated. Ports 5432 and 5439 have existing SSH listeners. A clean experiment requires an explicit census and approved quiescent pause of competing local inference, preserving the same owners/history/settings. No such pause, service change or inference occurred during planning.

## Proposed topology

Create an additional local instance; no old-world replacement or public cutover. PACT runs from a pinned build in a dedicated Docker Compose project with fresh PostgreSQL, gateway/web, API, rules, seals and notification/event projection. Fleet runs natively on this Mac with a separate PostgreSQL database/vault; native Ollama supplies Metal inference. Built-in PACT inference and external channels remain off.

Proposed ports, to be checked again: PACT gateway 3400, PACT DB 5451, Fleet DB 5452, Fleet console 8830, private Laya 8833 and usage-recording helper gateway 8834. Bind every published socket to 127.0.0.1. Ollama remains at 11434. Use a single new Fleet deployment for all four cohorts so provider capacity and accounting are shared.

Use a private generated run ID and `~/Library/Application Support/PACT Local Worlds/<runId>/` for state, configuration, keys and encrypted evidence, outside Git. Never load either repository's existing `.env` or use the root Compose defaults. Use fresh identity/OAuth/encryption/raid keys, entry keys and database passwords. No personal accounts or historical grants are imported.

This one-shot experiment uses the existing single-world origin scope, a new origin, independent keys and fixed database/volume identity, recorded in an exclusive non-reusable run manifest. Pin the Fleet environment instance to that manifest. Replacing the database behind that origin or changing its identity stops admission. This is a local non-replacement procedure, **not** implementation of the proposed generic immutable-world handshake/reset/rollover capability. Never reuse this origin with another database generation; a later run needs another origin and state directory.

## Fleet configuration and authority

Create four profile drafts of three actors; interleave ordinary founding A1,B1,C1,D1,A2,…,D3. Preserve an entry key before each join; uncertainty recovers that identity, never provisions a replacement. Capture actual founding times and ordinary starting state; common inference time does not erase founding-age differences. No contacts, buildings, troops or extra resources are pre-seeded.

All groups use account-autonomy guidance and matched objectives. Proposed mandate actions are `world.read`, `inbox.read`, `message.send.contact`, `contact.request`, `building.queue`, `training.queue`, `supply.sign`, `scout.start`, `raid.commit`, `transfer`. Set iron/silver/grain resource limits to 600000 internal units each, grain reserve floor 12000, troop limit 1000, session limit 1, social delegation `agent_decides`, and no synthetic-owner exception policy. Validate these exact keys against current canonical admission and read back the complete policy before launch. Ordinary limits do not create stock. Supply early termination and garrison signatures are outside this proposed delegation; observe these limits rather than silently raising authority. Models never receive owner sessions/entry keys.

Use route=ollama, thinking=true, context 32768, output setting 2000, delivered input ≤24000 UTF-8 bytes, call timeout 90 s, turn timeout 120 s, allocation 40000 tokens/call, at most two calls and two commands/turn, concurrency one. Known corrective attempts and reads share the two-call limit. Unknown usage/uncertain commands are never blindly retried. Keep existing model sampling parameters and immediate unloading; no VW or mode substitution.

PACT events and outlook are enabled only in the new API; event projection is also enabled in its notification worker. Fleet pins exact advertised protocol versions. Proposed periodic review interval is 15 minutes for every group: legacy groups follow their periodic loop; reactive groups additionally wake on eligible events. An initial ordinary review gives every actor an opportunity at T0. Respect existing quiet-event and coalescing behavior. The interval is a proposed configuration, not a claim that all legacy installations use that default.

**No equal-call budget, per-actor half-hour allowance, or total request ceiling is imposed on this pilot.** More event-driven decisions are part of the architecture's behavior and cost. Preserve the existing bounded per-turn work and one shared inference slot. Record provider queue delay, actual opportunity and interference: one local model serializes execution, so a queued event is not an instant response. Do not add an artificial global quiet interval just to equalize activity. Any existing engine cooldown is pinned and disclosed.

Some offers can expire before the next periodic review. Supply truthful next-review and actual game-deadline facts; let models choose legal terms or decline. Do not extend deadlines, force replies or mistake scheduling exposure for reasoning quality. Compare engine-and-wake packages; assess compute efficiency separately from total achievement.

## Time and resource budget

| Item | Proposed limit or treatment |
|---|---|
| Common live observation | Exactly 60 minutes: T1=T0+1h for all four groups |
| Model-call and aggregate token ceilings | None for this local pilot; count actual requests and retain per-call reservations/usage |
| Provider capacity | One shared native Ollama inference slot |
| Per-turn work | Existing two-call/two-command, 90-second call and 120-second turn bounds |
| Helper | Count actual Laya invocations, timeouts and abstentions; existing 3-second request timeout, no equal/helper-count quota |
| External provider fees/infrastructure | No paid model route or new paid infrastructure proposed; electricity and local machine use remain costs |
| Setup storage | At least 30 GiB free before setup; stop on less than 15 GiB during the run; retained pilot state at most 10 GiB |
| Preflight | Metadata, source/build, fake-provider and isolated-stack checks; no separate mandatory 32-call real-model batch |

Per-call 40000-token reservation is conservative accounting, not a consumption target, total pilot allowance or guaranteed provider-enforced ceiling. Known returned usage and unknown allocations remain separate. Existing overrun/uncertainty handling is retained. No unused historical grant is reused. All new real model/helper work belongs to this one-hour window; no hidden preflight, warm-up or post-run summarizer calls.

Existing Fleet finite budgets require a call ceiling; imposing an arbitrary large one would obscure the design. For this pilot configure fresh cohorts with the existing continuous accounting shape (null call/token/deadline fields), **behind a mandatory independent one-hour run gate** checked before every model/helper request and command submission. That configuration is an implementation mechanism, not indefinite execution permission. An unregistered, expired, closed or stale-monitor run refuses dispatch even if the cohort is labelled running. Test both legacy and modern paths. Record counts without equalizing them.

## Observation and ending

Set T0 only after source/stack acceptance, restore verification, policy/capability readback and complete enrollment. Persist UTC T0/T1=T0+1h; display Europe/Berlin with its actual offset. Start all four cohorts atomically at a common anchor. The first real turns belong to this same hour, not a separate quota-limited test. At +15, +30 and +60 minutes report each actor's completed turns and outcome coverage without requiring equal turn counts. Lack of an eligible event is not a failure. An independent observer checks admission/usage/clock/queues/disk every 30 seconds; it invokes no models. No recurring Codex automation is created.

Use the full hour: do not close admissions two minutes early. At T1 close new turn, model, helper and command admission for all groups. Permit already-dispatched requests to finish under their original remaining bounds and record their usage; do not issue another decision or submit a newly generated command after cutoff. Reconcile original commands already dispatched before T1. Capture/pause the new local world through its supported clock control, recording actual snapshot/committed-game times and any cutoff race. Attribute late receipts/effects separately; do not call them achievements completed inside the hour.

Preserve the kingdoms and pause the cohorts rather than terminating/replacing them as an experimental reset. The run window is closed; ordinary UI resume cannot bypass it. A later explicitly authorized window may continue these same eligible nonterminal identities with lifetime accounting retained; no automatic extension or quota reset is permitted. Pending construction and obligations at cutoff are right-censored, not failed or fulfilled by assumption. One hour may establish setup, early development and interaction behavior; it cannot guarantee mature diplomacy, combat exposure or long-term memory benefit.

Primary measures: per-actor completed turns and opportunity; allocation/actual/unknown usage; delivered and omitted sources; proposed/persisted/retrieved/delivered memories; action admission versus later completion; contacts→reply→proposal→signature→delivery/default; stocks/production/upkeep; actual threat exposure; queue and offer-expiry timing. Report cross-group interactions, legitimate waits and absent opportunities. Use a separate assessor with authenticated local owner projections and read-only local snapshots; never feed an agent another owner's private state. Exports have bounded newest-turn/detail coverage, so retain consented encrypted per-turn evidence throughout the hour rather than silently omitting busy groups.

Stop new admission for all groups on new unknown spend, unresolved command delivery, identity/authority mismatch, changed source/model/runtime, clock suspension/gap, missing monitor heartbeat >90 s, disk <15 GiB, retained experiment state >10 GiB, or an unapproved competing inference consumer. Known invalid decisions may recover inside existing limits; repeated known failure does not justify automatic unknown review. Drain rather than abort known in-flight work, retain original receipts/reservations, and expose a concrete next step. Early interruption is reported as an incomplete time-window run; it does not restart the clock or create a successful comparison. Calls or event activity alone are never a stop condition.

## Deliverables and authorization boundary

Before any run: implemented/tested fail-closed time-window admission and usage capture; a private launch manifest with exact immutable source/image/provider/helper/config digests, IDs, times, resolved authority and resource limits; a verified isolated local stack and encrypted restore; recorded handling of existing local GPU users. Planning creates no accounts and invokes no models/helpers. Execution approval must explicitly cover these setup operations, the selected local pause/restoration scope, the one-hour world window and its actual local inference, with no total call quota. No server access, old-world reset, historical recovery review, public release or push is implied.

At completion: encrypted PACT/Fleet dumps and matching keys stored separately; original receipts/counters preserved; aggregate checkpoint and final reports; private causal trace samples with source/coverage labels; exact stop and restore-of-prior-local-state receipt. Same-disk backups are recoverability evidence, not off-host disaster recovery. Restore prior local cohorts only under the selected permission, if still eligible, without overriding new uncertainty or replaying work.

## Correction to the earlier proposal

The previous 32-call preliminary batch and 24-hour/1152-call/equal-half-hour proposal are superseded and were never executed. They tested equal-compute behavior, whereas the founder wants equal elapsed time with architecture-dependent compute. Report both achievements and the actual cost of obtaining them. Do not silently reintroduce those old caps as launch gates.
