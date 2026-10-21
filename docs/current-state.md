# PACT current state

Documentary checkpoint: 21 October 2026. This is source/report state, not a fresh runtime inspection or execution grant.

## Source and milestone

- The latest negotiation and specialist implementation is integrated into master in both main repositories: mine/pact and mine/fleet. Use these folders for normal work. Source integration does not install or activate anything.
- [Latest qualification record](implementation/reports/specialist-KQ1-source-acceptance-20261021.md)
- [Latest paired local acceptance](../../fleet/docs/RC2-local-acceptance-20261021.md): the owned two-kingdom specialist evaluation is implemented. RC1's positive fake attempt hit the 24000-byte packet fence. Separate RC2 uses 32000 input bytes and user-selected 30-minute external reviews without increasing the call ceiling or changing pinned actor/game source. Fresh isolated synthetic tests do not qualify the candidate. The original provider policy denial remains unresolved; no retry or approval-setting change occurred.
- E1/E2/E3 are terminal failures. E3 stopped on an unsupported authority claim; 1 failed/34 unstarted cells, 3 turns/4 reported calls/0 commands. All 70 owned clocks were parked; final encrypted restore verified.
- Combined real E1–E3 usage remains 14 calls/560000 reserved/71886 measured tokens. Failed grants and spare allowance cannot be reopened, replayed or transferred.
- Real E4 and KQ1 remain unrun. Automatic approval review rejected the isolated E4 provider start with only blocked by policy as its stated reason; do not retry through another mechanism. E4 marker-only storage was stopped and retained.
- Specialist source/offline acceptance and the passive KQ1 bundle are verified. Passive source pins: Fleet 7ca67b2 / PACT 81007a4; full artifact/settings details remain in the qualification records. No candidate installation or activation; E3 independently blocks production readiness.

## Preserved local world

The [last local-world result](implementation/reports/fleet-reasoning-outcomes-20261020.md) records 12 matched actors, 40 turns/64 allocations, groups/clock paused at tick39, gates closed and worker stopped. The historical unknown allocation and all identities/settings/goals/mandates/queues/evidence remain retained. This cleanup does not access runtime state or change that checkpoint.

## Next work and reading

Use the paired local acceptance record for current source tests and passive package status, and the [continuation](implementation/reports/negotiation-continuation-20261021.md) for operational gates. Supported denial resolution, fresh operational rosters and encrypted restore proof, exact grants, real held-out qualification and isolated release/rollback/activation acceptance remain pending. Existing E4/KQ1 ceilings, terminal failures, frozen artifacts and the preserved world remain unchanged; no RC2 real-model allowance or release acceptance exists.
For a new task, read only its applicable guide/spec and affected source/tests. Detailed plans, reports and historical evidence remain at their existing paths.
Update this file when a verified milestone changes; do not append execution diaries to AGENTS.md. Read the [original instruction snapshot](reference/agent-instructions-before-20261021.txt) only for a specific historical question; past grants there are not current authority.

Maintenance checks: instruction/state links resolve; the historical snapshot matches the original AGENTS.md bytes; default search skips that snapshot. Existing source and all other documents remain unchanged.

Integration verification: fresh main-repository checks passed 415 unit and 509 integration/smoke tests (one opt-in model test skipped), full build, type/lint/contracts/boundary checks, backlog validation and dependency audit with 0 findings. No model/live-world run or deployment occurred. Both original instruction snapshots remain retained; prior qualification outcomes and frozen artifact pins are unchanged.

Paired main-repository verification also passed Fleet501unit/562integration/38acceptance checks, its builds/type/style/boundaries and a zero-finding audit. Both repositories use main master checkouts for normal work.
