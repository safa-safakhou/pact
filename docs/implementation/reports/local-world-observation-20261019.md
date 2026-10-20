# One-hour local four-fleet observation — 19 October 2026

The founder explicitly launched the prepared world for one hour. The run finished with one completed Farm II, four waiting Hall II orders and no established cross-kingdom interaction. It exposed session-lifecycle and context-delivery failures that prevent a fair comparison of architecture quality. No code, model, objective, authority, cadence or quota was changed during the hour.

## Run and cutoff

- Window: **2026-10-19 14:26:13.625–15:26:13.625 UTC**, **16:26:13.625–17:26:13.625 Europe/Berlin**. Exactly 3,600,000 ms; the window file closed at the original T1, with no extension/restart.
- Four groups, three original fresh kingdoms each; matched guardian/merchant/diplomat owner objectives. Same Nemotron 3 Nano 4B, thinking=true, native Ollama 0.40.3, one shared inference slot. Periodic phases were staggered 0/5/10 min, repeating every 15 min; reactive profiles also had eligible-event polling enabled.
- Source: PACT `b65ca5ce287c02e1fefd7f5f3dce3c2c89eaa03a`, Fleet `3f5061613eac00016359256dc84d4ed910f11aca`. All 1,552 pinned artifacts and both source revisions verified unchanged after execution, before these report-only edits.
- No aggregate model/helper/token/action/event quota. Continuous accounting had null lifetime call/token/deadline fields. Existing engine bounds remained: 24,000 input bytes,2,000 output tokens,40,000-token reservation/call, up to3 calls/3 actions per turn. The input bound materially affected the reactive paths; this receipt does not describe them as unconstrained inference.
- Independent observation produced 121 snapshots. The cutoff observation and final counters agree. The authoritative clock is paused at tick 67, 60 ticks after the start; recorded pause time is 15:26:14.320 UTC, 0.695 s after T1. This short control/drain interval produced no additional action or model execution.
- All four cohorts are paused. All 12 original accounts/bindings remain; 0 running turns,0 reserved/unsettled model allocations and 0 unknown model allocations. This closed window cannot be relaunched by the ordinary launch command.

## What each group achieved

| Group | Turn attempts | Model executions | Accepted game commands | Completed upgrades | Waiting at cutoff | Reported input + output tokens |
|---|---:|---:|---:|---|---|---:|
| A — legacy-loop |12|19|2|A1: Farm I→II|A2: Hall II|105,293|
| B — legacy-cognition |12|15|0|None|None|86,989|
| C — reactive-basic |13|7|3|None|Hall II for C1, C2 and C3|40,984|
| D — reactive-cognition |12|0|0|None|None|0|

**A, legacy-loop:** A1 completed Farm II, increasing that kingdom’s gross Grain production 30→45/hour. Across the three kingdoms, ordinary Grain increased 78.5 during the observation, versus 66 for each other group. This is 12.5 extra Grain above the common baseline. Farm construction consumed 40 Iron and 20 Silver from founding construction allowances. A2 queued Hall II but never supplied its Farm II/Barracks II prerequisites. A3 proposed an introduction to its own kingdom; it failed with `INVALID_COMMAND`. There were no other accepted actions.

**B, legacy-cognition:** No build, training, agreement or communication was committed. Its decisions mainly waited or requested further reads; an early summary explicitly chose to remain passive until peer engagement. Fourteen valid continuity-review responses were recorded across 15 model executions, all without a subjective-state revision. Twelve automatic observation episodes were retained, but no cognitive state, interpretation, plan, belief or reflection was persisted. Six Laya recall requests occurred: one unavailable outcome at the 3 s timeout and five abstentions. All six retained deterministic recall; no helper selection was accepted. This is evidence of invocation/fallback, not a demonstrated memory benefit.

**C, reactive-basic:** All three kingdoms queued Hall II. None started because Farm II and Barracks II were absent; waiting instructions reserve no construction stock, so these orders produced no upgrade or production gain. C1 also attempted a 26-character direct message to C1 itself; the command was rejected as `INVALID_COMMAND`, with no delivery. Of 13 attempts,7 ended `SESSION_NOT_FOUND`, 2 `AUTH_BUSY`, and 4 with the host’s generic `WAIT` code. That generic code includes the three accepted construction orders and the rejected message; it is not proof that all four model decisions chose waiting.

**D, reactive-cognition:** It never reached inference. Ten attempts ended `MODEL_REQUEST_NOT_ADMITTED`, one `SESSION_NOT_FOUND` and one `AUTH_BUSY`. Thirty automatic observation episodes were retained during context preparation, but there was no model-generated continuity update or persistent subjective state. Its zero outcomes cannot establish the quality of cognition after a usable observation reaches the model.

All groups gained 60 ordinary Iron and 30 ordinary Silver through automatic production. B/C/D each gained 66 ordinary Grain; A gained 78.5. Passive production is distinguished from agent accomplishments. No troop training occurred; starting Home Guard is not new military development.

## Interaction and event exposure

There were **zero accepted introductions, contacts, delivered direct messages, supply offers, supply contracts, garrison agreements, transfers, scouts or raids**. Trace review found the two invalid self-directed communication proposals described above; neither reached another kingdom. No cross-group negotiation or collaboration was established.

Peer opportunities were not uniformly delivered. All 34 legacy decision contexts advertised some candidates: A received 2–8 per context and B 1–4. Nevertheless, neither group established a relationship. Conversely, all 7 reactive-basic provider requests retained only `observation.payload.guide`: fitting omitted the current `world`, `discovery`, `socialAttention`, `development`, `diplomacy`, `observationTurn` and `actionGuide` fields. Its reduced state/partner exposure must be considered when interpreting its choices.

All 6 reactive bindings maintained fresh polling cursors. No event records were consumed; reactive tasks were initial/periodic reviews, not message/contract/raid event responses. With no incoming communication, contracts or owned completed construction, this hour did not provide a meaningful test of those response paths. More reactive turn attempts were largely failures/retries, not evidence of more achieved work.

## Concrete runtime findings

1. **MCP session ownership races.** PACT initialize reuses the active session for an OAuth grant. Event polling opens that same logical session and closes it while the turn still uses it. Seven C turns and one D turn ended with a missing session; concurrent authentication also produced 3 `AUTH_BUSY` results. A fake local fixture using the actual compiled McpGame reproduced: initialize turn, initialize poll, close poll, then turn read fails `SESSION_NOT_FOUND`. No real inference/game request was used in that fixture. Provider-slot queue delays were at most 26 ms; the Fleet slot queue was not the principal blocker.
2. **Reactive context fitting loses essential state.** The7 actual C requests demonstrate guide-only delivery. D’s 10 admission refusals happened before a model allocation. A post-cutoff authenticated D observation, real 40-tool catalog, real action contract and retained owned evidence reproduced `MODEL_REQUEST_NOT_ADMITTED` with 0 stub-provider calls and 0 real inference. This was a read-only size replay, not an exact recovered pre-cutoff prompt. Its non-payload observation was 10,350 bytes and its reconstructed continuity context 13,321 bytes before fitting; schemas/catalog also consume the 24,000-byte allowance. A minimal empty-extension/catalog replay did reach the stub, so the individual observation alone was not larger than the limit. Separately, a synthetic 30 KB continuity fixture confirms that the fitter can retain oversized non-payload continuity while trimming payload fields. Fixing delivery requires considering the complete packet and preserving current state/owner intent/partner evidence.
3. **Coarse helper accounting missed debug labels.** The live aggregate queried `Laya recall request`, while actual events are labelled `Debug: Laya recall request`. Its zero helper counter underreported B. Final totals use all 6 paired request/outcome trace records. No gameplay or model counter was reset to correct the report.

The pre-launch metadata, account-read and offline tests did not certify concurrent MCP session ownership or useful full-size live prompt delivery. These gaps allowed an apparently ready setup to launch with faulty reactive integration paths. No live code repair was introduced to change the experiment midway.

## Accounting, preservation and interpretation

All 41 model executions have reported usage: 216,565 input and 16,701 output tokens, 233,266 total. Their 1,640,000 reserved tokens are conservative accounting, not reported consumption or an experiment ceiling. There are 0 unknown model allocations and no request quota stopped a group. Helper unavailability/abstention remains explicit and separate from model-token accounting.

Encrypted cutoff and assessed PACT/Fleet dumps were preserved outside Git, with separate keys. A network-disabled PostgreSQL restore authenticated the assessed archives and matched complete rows in 10 core PACT tables and 39 nonvolatile Fleet tables. The temporary clone and its own volume were removed. These are local recovery archives, not off-host disaster recovery. Private prompt, identity and receipt evidence remains outside Git. Existing local/server/historical populations were not restarted, reset, reviewed or modified by this run.

The run was useful: it established actual local execution/cutoff/recoverability, measured weak early development and uncovered concrete session/packing failures. It provides no fair overall architecture winner or evidence of successful bargaining or cognitive advantage. The immediate engineering work is session lifecycle coordination and context delivery, including regression checks with full authorized world/continuity packets and concurrent event polling. Preserve this world and its history; no second hour, fix deployment or population restart follows automatically from this receipt.

Evidence: private `local-four-20261019-ef5d29eb/evidence/` contains start/cutoff observations, 121 aggregate snapshots, final detail/metrics, rejected communication verification, helper outcomes, closed verification, size/session replays and authenticated restore proof. No hosted CI or independent review is claimed. This is the founder-authorized observational assignment, not a newly activated backlog ticket.
