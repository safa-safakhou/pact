# Fresh local PACT world with four Fleet profiles

19 October 2026. **Proposed design, not execution authorization.** The founder requested a concrete local setup, budget and observation plan. Numbers below are Codex's recommendations, not previously approved inference or population limits. Implementation is local, without delegation. [Execution plan](../plans/2026-10-19-local-four-fleet-world.md).

## Purpose and scope

Observe twelve fresh kingdoms in one ordinary PACT world: three each using `legacy-loop/1`, `legacy-cognition/1`, `reactive-basic/1` and `reactive-cognition/1`. Test whether the complete observation → optional memory → delivered context → decision → receipt → material outcome path works with real counterparties. This is an interacting-world pilot, not twelve independent replicas or a causal architecture ranking.

Use the same Nemotron weights and thinking=true across groups. Only legacy cognition selects Laya. Modern cognition uses its existing continuity path, without legacy cognition/recall model options. Do not add specialist coordination, another model, scripted counterparties, forced messages, manufactured scarcity, economic gifts, accelerated ticks or a survival reward. Respect ordinary game ownership, stock, quotas, leases, publication and human-only boundaries.

Each group has one guardian, merchant and diplomat preference, applied as the same authenticated owner objective for corresponding actors. The engine may act, negotiate, conserve or wait. No requirement to write memories or produce messages. Record absent activity and distinguish lack of opportunity from capability failure.

## Current evidence and feasibility

Planning inspected PACT `df22af95da50ce9f7eef2207402e674404531ffb` and Fleet `421ad90` on master. Source is merged; older handbook notices about unmerged implementations are historical. These pins are baselines, not a claim that future experiment controls already exist.

Read-only checks on this Mac found Apple M4 Pro/48 GB, approximately 48 GiB available disk, Ollama 0.40.3, and `nemotron-3-nano:4b` Q4_K_M digest `6cc467f054393a55e98a74098abde0c762ffb6d1d8cd64becf30458f38886197`. No model was loaded at that instant. The older qualification used another device and Ollama 0.35.1; it does not qualify this runtime. Laya availability/certificate on this Mac has not been established.

The existing local Fleet health at port 8820 reports `liveEnabled:true`; its active cohorts were not enumerated. Ports 5432 and 5439 have existing SSH listeners. A clean experiment requires an explicit census and approved quiescent pause of competing local inference, preserving the same owners/history/settings. No such pause, service change or inference occurred during planning.

## Proposed topology

Create an additional local instance; no old-world replacement or public cutover. PACT runs from a pinned build in a dedicated Docker Compose project with fresh PostgreSQL, gateway/web, API, rules, seals and notification/event projection. Fleet runs natively on this Mac with a separate PostgreSQL database/vault; native Ollama supplies Metal inference. Built-in PACT inference and external channels remain off.

Proposed ports, to be checked again: PACT gateway 3400, PACT DB 5451, Fleet DB 5452, Fleet console 8830, private Laya 8833 and metered helper gateway 8834. Bind every published socket to 127.0.0.1. Ollama remains at 11434. Use a single new Fleet deployment for all four cohorts so provider capacity and accounting are shared.

Use a private generated run ID and `~/Library/Application Support/PACT Local Worlds/<runId>/` for state, configuration, keys and encrypted evidence, outside Git. Never load either repository's existing `.env` or use the root Compose defaults. Use fresh identity/OAuth/encryption/raid keys, entry keys and database passwords. No personal accounts or historical grants are imported.

This one-shot experiment uses the existing single-world origin scope, a new origin, independent keys and fixed database/volume identity, recorded in an exclusive non-reusable run manifest. Pin the Fleet environment instance to that manifest. Replacing the database behind that origin or changing its identity stops admission. This is a local non-replacement procedure, **not** implementation of the proposed generic immutable-world handshake/reset/rollover capability. Never reuse this origin with another database generation; a later run needs another origin and state directory.

## Fleet configuration and authority

Create four profile drafts of three actors; interleave ordinary founding A1,B1,C1,D1,A2,…,D3. Preserve an entry key before each join; uncertainty recovers that identity, never provisions a replacement. Capture actual founding times and ordinary starting state; common inference time does not erase founding-age differences. No contacts, buildings, troops or extra resources are pre-seeded.

All groups use account-autonomy guidance and matched objectives. Proposed mandate actions are `world.read`, `inbox.read`, `message.send.contact`, `contact.request`, `building.queue`, `training.queue`, `supply.sign`, `scout.start`, `raid.commit`, `transfer`. Set iron/silver/grain resource limits to 600000 internal units each, grain reserve floor 12000, troop limit 1000, session limit 1, social delegation `agent_decides`, and no synthetic-owner exception policy. Validate these exact keys against current canonical admission and read back the complete policy before launch. Ordinary limits do not create stock. Supply early termination and garrison signatures are outside this proposed delegation; observe these limits rather than silently raising authority. Models never receive owner sessions/entry keys.

Use route=ollama, thinking=true, context 32768, output setting 2000, delivered input ≤24000 UTF-8 bytes, call timeout 90 s, turn timeout 120 s, allocation 40000 tokens/call, at most two calls and two commands/turn, concurrency one. Known corrective attempts and reads share the two-call limit. Unknown usage/uncertain commands are never blindly retried. Keep existing model sampling parameters and immediate unloading; no VW or mode substitution.

PACT events and outlook are enabled only in the new API; event projection is also enabled in its notification worker. Fleet pins exact advertised protocol versions. Reactive groups use periodic review every 30 minutes plus the seven existing event categories, respecting quiet flags. Legacy groups use periodic review only. Apply a shared run-specific allowance of two model executions and two commands per actor per half-hour window, regardless of trigger or engine. Coalesce/defer events after exhaustion; record queue delay and retain pending review work. Event responsiveness is only available while allowance and capacity remain. No extra daily allowance or catch-up turns.

Some ordinary offers can expire in fifteen game minutes, sooner than a periodic thirty-minute review. Supply each model with truthful next-review/allowance timing and actual offered deadlines; let it choose legal terms or decline. Do not extend game deadlines or blame every missed negotiation on reasoning. This pilot compares engine-and-wake packages; timing opportunity and exposure must be reported separately from model judgment.

## Exact proposed budgets

| Stage | Actors/environment | Time ceiling | Model calls | Reserved tokens | Laya invocations |
|---|---|---|---:|---:|---:|
| Q: this-Mac qualification | Synthetic ports; no game writes | 90 minutes | 32 total, 8/profile | 1280000 | 16 |
| W: interacting world | 12 new kingdoms; first-hour smoke included | 24 hours | 1152 total, 288/group, 96/actor | 46080000 total, 11520000/group | 576, legacy-cognition only |
| Total, only if both stages later authorized | Disjoint stage journals | ≤25.5 hours of stage windows, plus setup/archive | 1184 | 47360000 | 592 |

All calls, failures, corrective attempts and helpers count before dispatch. Reservations are conservative allocations, not measured consumption or a target. Known usage is reported separately; unknowns retain full allocation. No provider API spending or paid infrastructure is proposed; electricity, local storage and machine occupation remain costs. Token/output settings are not a hard monetary or provider-overrun guarantee. Overrun stops further admission and remains recorded.

The world has 48 half-hour windows: 12×48×2=1152 calls. A hard per-actor limit prevents event-heavy actors consuming a cohort's whole allowance. Helper ceiling assumes at most two helper attempts per legacy-cognition model opportunity; verify this bound against actual packing/review paths. Never retry an abstention to obtain a positive selection. Hitting a helper ceiling pauses the pilot rather than silently changing Group B's configuration.

Stage Q runs four controlled turns/profile (read/action contract; two-turn retained-memory/context sequence where applicable; untrusted/ambiguous evidence), at most two executions/turn. Commands are withheld. Optional memory omission is recorded, not forced into a pass. Proceed only with known usage, valid or safely recovered outputs, safe citation/authority handling and measured end-to-end p95 turn time ≤60 s. Twelve serial p95-sized turns plus 15 s quiet gaps occupy about 900/1800 seconds; this is a sizing screen, not a latency guarantee. If it fails, revise the proposal before launch; do not silently change cadence, model or population.

## Observation and ending

Set T0 only after qualification, isolated restore, policy/capability readback and complete enrollment pass. Persist UTC T0/T1=T0+24h; display Europe/Berlin with its actual offset. Start all four cohorts atomically at one anchor, with an interleaved actor service order. Smoke at T0–T0+1h: every actor must finish two reported ordinary turns; these calls are inside W's caps. Review at +1h, +6h, +12h and +24h without additional inference. An independent local observer checks admission/usage/clock/queues/disk every 30 s. No recurring Codex automation is created by this plan.

At T1−120 s close new task/model admission; finish existing bounded work by T1. Freeze the new game's clock through its supported control and archive state at T1; unresolved future construction/contracts remain explicitly censored. Do not pretend those obligations were fulfilled. There is no automatic extension, budget renewal or 48/72-hour continuation: finite cohorts become terminal under current semantics. Continuing these same identities requires a separately designed/reviewed renewal path; never bypass consumed configuration/terminal guards or create replacement bindings as continuation.

Primary measures: per-actor completed turns and opportunity; allocation/actual/unknown usage; delivered and omitted sources; proposed/persisted/retrieved/delivered memories; action admission versus later completion; contacts→reply→proposal→signature→delivery/default; stocks/production/upkeep; actual threat exposure; queue and offer-expiry timing. Report cross-group interactions, legitimate waits and absent opportunities. Use a separate assessor with authenticated local owner projections and read-only local snapshots; never feed an agent another owner's private state. Export formats' newest-20-turn/detail caps are insufficient for a full-day conclusion, so retain consented encrypted per-turn evidence throughout the run.

Stop new admission for all groups on new unknown spend, unresolved command delivery, identity/authority mismatch, changed source/model/runtime, clock suspension/gap, missing monitor heartbeat >90 s, disk <15 GiB, retained experiment state >10 GiB, or an unapproved competing inference consumer. Known invalid decisions may recover inside existing limits; repeated known failure does not justify automatic unknown review. Drain rather than abort known in-flight work, retain original receipts/reservations, and expose a concrete next step. Failure does not restart the 24-hour clock or grant unused calls again.

## Deliverables and authorization boundary

Before any run: implemented/tested opt-in run admission and counting-helper controls; a private launch manifest with exact immutable source/image/provider/helper/config digests, IDs, times, resolved authority and caps; a verified isolated local stack and encrypted restore; recorded handling of existing local GPU users. Planning creates no accounts and spends no model/helper allowance. Execution approval must explicitly cover these setup operations, the selected local pause/restoration scope, Stage Q and conditional Stage W. No server access, old-world reset, historical recovery review, public release or push is implied.

At completion: encrypted PACT/Fleet dumps and matching keys stored separately; original receipts/counters preserved; aggregate checkpoint and final reports; private causal trace samples with source/coverage labels; exact stop and restore-of-prior-local-state receipt. Same-disk backups are recoverability evidence, not off-host disaster recovery. Restore prior local cohorts only under the selected permission, if still eligible, without overriding new uncertainty or replaying work.
