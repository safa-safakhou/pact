# Paired runtime reliability investigation and fix plan — 27 October 2026

Subsequent execution: [shared repairs and fresh Nemotron validation](runtime-reliability-nemotron-20261027.md). The user authorized implementation and one fresh 30-minute local-model run after this planning checkpoint; Codex-specific work is deferred.

**Planning only.** Worlds remain paused; no model calls, deployment, reset, uncertainty settlement, commit or push in this assignment. E4/KQ1 remain blocked. Work inline.

The canonical [Fleet investigation and implementation plan](../../fleet/docs/superpowers/plans/2026-10-27-runtime-reliability-fixes.md) contains source/test locations, design choices, bounded work packages and acceptance checks. It follows the fresh Nemotron and Terra experiments. The aim remains a society experiment: agents can reason, communicate and make imperfect choices; software should deliver accurate observations and enforce native authority, not choose the strategy for them.

## Findings relevant to PACT

- A synthetic coordinator probe reproduces loss of old evidence when Fleet caches observations under the same native revision. The live rejected proposal cited five references actually delivered to the model. The live cache contents were not retained, so the exact live cause remains uncertain. Proposed fix: immutable Fleet observation identities, with native PACT revisions and atomic effect guards unchanged.
- Eight active Fleet workers shared one Codex slot. Two legacy-cognition turns committed an action before their next queued call expired. Codex medium reasoning received a two-minute Fleet turn while local thinking mode received six minutes. Queue cancellation can be mislabeled as claim loss. Proposed fix: existing admission controls, explicit Codex turn bounds and accurate cancellation reasons; no PACT lease extension or command replay.
- Fleet communication metrics query a consented ingestion journal populated by legacy read paths, rather than every native message. The platform architectures need equivalent scoped ingestion and explicit coverage labels. Missing Fleet telemetry does not establish missing PACT delivery.
- Later Codex quota failures exposed opaque provider diagnostics and repeated admission against an unavailable provider. A narrowly scoped provider admission block should preserve unknown usage, tasks and world policy. The intentionally different Codex account is not a bug.
- The remaining Nemotron resource/reference/trade rejections require case-by-case comparison of delivered context, proposals and native state. Correct guards must remain intact. Contract defaults and strategic waits are not automatically defects.

For the matched **24m12.520s** active windows: Nemotron produced 65 actions, 22 completed upgrades, one accepted contact and three messages; Terra produced 85 actions, 34 completed upgrades, seven accepted contacts and ten messages. Terra's 55 completed upgrades in the [full-hour report](codex-terra-hour-run-20261027.md) include later passive construction and must not be used as the active-period total. Provider, input limits, reasoning and concurrency differed; this is not an isolated model-intelligence experiment.

## PACT implementation boundary

No production PACT change is presently demonstrated as necessary. Implement Fleet evidence binding, admission/cancellation, provider diagnostics and measurement changes first. Verify their integration against PACT's actual application handlers using the existing fresh, owned synthetic paired fixtures.

Retain these acceptance conditions:

1. Refreshing evidence cannot bypass current native effect quotes, ownership, resource/authority claims or the one-kingdom write lease.
2. Construction and composed messages use original command identities, native authorization and receipts; no duplicate effects across a timeout or refresh.
3. Different authorized views remain private. Metrics only ingest communication pages actually read with consent; native sent-message totals and observed account history are distinct.
4. Changes to owner intent, cost, target, contract perspective or native revision still invalidate unsafe proposals. Feedback tells the model what failed without inventing permission or forcing a particular strategy.
5. Unknown usage and uncertain commands in retained worlds remain preserved. Synthetic tests do not restore, replay or repair old worlds.

If a paired regression demonstrates a PACT handler or contract defect, report the exact failing case and add a narrow PACT work item. Do not redesign game rules or expand authority to make a model answer pass. Source verification must precede any separately authorized deployment or live probe.
