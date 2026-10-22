# PACT current state

Documentary checkpoint: 22 October 2026. This is source/report state, not a fresh runtime inspection or execution grant.

## Source and milestone

- The latest negotiation and specialist implementation is integrated into master in both main repositories: mine/pact and mine/fleet. Use these folders for normal work. Source integration does not install or activate anything.
- [Latest qualification record](implementation/reports/specialist-KQ1-source-acceptance-20261021.md)
- [Latest paired local acceptance](../../fleet/docs/RC2-local-acceptance-20261021.md): the owned two-kingdom specialist evaluation is implemented. RC1's positive fake attempt hit the 24000-byte packet fence. Separate RC2 uses 32000 input bytes and user-selected 30-minute external reviews without increasing the call ceiling or changing pinned actor/game source. Four positive fake worlds and the passive 14320-file Windows package passed acceptance; real qualification remains pending. The original provider policy denial remains unresolved; no retry or approval-setting change occurred.
- E1/E2/E3 are terminal failures. E3 stopped on an unsupported authority claim; 1 failed/34 unstarted cells, 3 turns/4 reported calls/0 commands. All 70 owned clocks were parked; final encrypted restore verified.
- Combined real E1–E3 usage remains 14 calls/560000 reserved/71886 measured tokens. Failed grants and spare allowance cannot be reopened, replayed or transferred.
- Real E4 and KQ1 remain unrun. Automatic approval review rejected the isolated E4 provider start with only blocked by policy as its stated reason; do not retry through another mechanism. E4 marker-only storage was stopped and retained.
- Specialist source/offline acceptance and the passive KQ1 bundle are verified. Passive source pins: Fleet 7ca67b2 / PACT 81007a4; full artifact/settings details remain in the qualification records. No candidate installation or activation; E3 independently blocks production readiness.

## Preserved local world

The [last local-world result](implementation/reports/fleet-reasoning-outcomes-20261020.md) records 12 matched actors, 40 turns/64 allocations, groups/clock paused at tick39, gates closed and worker stopped. The historical unknown allocation and all identities/settings/goals/mandates/queues/evidence remain retained. This cleanup does not access runtime state or change that checkpoint.

## Next work and reading

Current user restriction: **do not start another Ollama server or retry blocked E4**. The [local RC2 qualification record](../../fleet/docs/RC2-shared-service-qualification-20261022.md) reports four passing restored-only fake worlds, followed by a terminal R2-D review-transport failure: 1 reported real call / 4709 measured tokens, 1 failed-unassessable cell / 3 unstarted, no game commands, eight clocks parked and final encrypted restore verified. Its grant and unused allowance remain closed. Atomic encrypted review publishing now passes on private native Windows NTFS storage; the separate, untuned R2-H held-out stage is preparing 35 fresh cells / 70 owned worlds with its independent ceiling. Consult the current private held-out runtime record before any operation; never relaunch a consumed grant. Empty PACT/Fleet interfaces remain healthy/live-disabled, and the old world, identities, unknown allocations and frozen E4/KQ1 are unchanged. No new server, E4 retry or production qualification is claimed.

Use the paired local acceptance record for source tests and passive package status, and the [continuation](implementation/reports/negotiation-continuation-20261021.md) for the still-pending operational gates. Study-specific operational rosters and encrypted restore proofs, exact grants, real held-out qualification and isolated release/rollback/activation acceptance are unfinished. Existing E4/KQ1 ceilings, terminal failures, frozen artifacts and the preserved world remain unchanged; existing service availability does not replace their exact provider/model bindings or create a new study allowance.
For a new task, read only its applicable guide/spec and affected source/tests. Detailed plans, reports and historical evidence remain at their existing paths.
Update this file when a verified milestone changes; do not append execution diaries to AGENTS.md. Read the [original instruction snapshot](reference/agent-instructions-before-20261021.txt) only for a specific historical question; past grants there are not current authority.

Maintenance checks: instruction/state links resolve; the historical snapshot matches the original AGENTS.md bytes; default search skips that snapshot. Existing source and all other documents remain unchanged.

Earlier full-suite checkpoint: main-repository checks passed 415 unit and 509 integration/smoke tests (one opt-in model test skipped), full build, type/lint/contracts/boundary checks, backlog validation and dependency audit with 0 findings. No model/live-world run or deployment occurred. Both original instruction snapshots remain retained; prior qualification outcomes and frozen artifact pins are unchanged.

Earlier paired main-repository verification also passed Fleet501unit/562integration/38acceptance checks, its builds/type/style/boundaries and a zero-finding audit. Both repositories use main master checkouts for normal work.
