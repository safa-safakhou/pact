# PACT-053 — transactional rules prototype gate

Ticket: [PACT-053 / MNI-118](https://linear.app/mnim/issue/MNI-118/pact-053-accept-the-transactional-rules-prototype)  
Gate review: 29 September 2026; Node 24.19.0, disposable PostgreSQL server 17.11, macOS arm64; read-only public verification of the single VPS. All 27 prerequisites were read Done in Linear before claiming this gate.  
Playable web revision: immutable VPS release `alpha-20260929-4` at `2143d92`. The reviewed checkout through `ca6e8fb` adds only acceptance documentation and an optional local comparison test after that deployed gameplay revision; no later domain/API/migration change. Specification: PACT v1.3. Rules catalog: `RULES_ID = pact-s1-v1` in `packages/domain/src/rules-catalog.ts`.

## Decision

**R01–R08 pass for the private transactional-rules prototype profile.** The script wins the one recorded real-model comparison; R07 does not require model superiority or a fun claim. The release record below identifies the checks, physical/local recovery evidence and remaining non-gate limits. No unresolved ledger or identity corruption is known from these checks or the deployed synthetic play. This is not Season One release, a 50-player pilot, hosted-provider certification, native distribution, or proof that the game is fun.

## Acceptance review

| Criterion | Committed evidence | Gate result |
| --- | --- | --- |
| R01 conservation | [PACT-051 consolidated review](rules-verification-completion.md#result-and-acceptance-decision), ledger/provenance/overflow/cancellation/default/Fortune tests; 28-command rollback matrix and journal reconciliation | Pass in the implemented prototype; no negative or duplicated stock in tested transitions. |
| R02 time | Exact due/harvest/charge/notice boundaries, 360-installment six-hour fixture, atomic ordered tick and pause/resume tests in the same [review](rules-verification-completion.md) | Pass. Automatic Season One rollover remains PACT-069, not a Phase 1 claim. |
| R03 units | Identity, guard disband, capacity, hunger/desertion, pending return and overlap fixtures; 32 rosters × 36 dice pairs preserve split invariance in the [review](rules-verification-completion.md) | Pass. |
| R04 authority | Multi-client HTTP/MCP signatures, mandate/floor/future reservation races, exact human permits and competing garrison capacities in the [review](rules-verification-completion.md) | Pass; no incoming/outgoing netting or agent self-approval. |
| R05 combat | Published worked battle/all 36 die pairs, zero-power/tie/loot bounds, seed commitment and overlapping/closing raids in the [review](rules-verification-completion.md); [two-player deployed battle](rules-ui-completion.md) | Pass. |
| R06 reliability | 28 commands × two fault positions, same-ID replay, 19 private object classes, nine tick-phase rollbacks, SIGKILL tests and caller-timeout reconciliation in the [review](rules-verification-completion.md); local marked-wealth restore today and earlier physical [single-VPS Restic restore](../../operations/vps-deployment.md#backups) | Pass for the prototype recovery profile; same-server backup cannot survive VPS loss. |
| R07 baseline automation | [PACT-052 real local-model comparison](script-baseline-completion.md) with identical initial stocks/partner policy and published script tools | Pass. Script: Farm II, one expired contract/120 installments, ten MCP calls. Model: Farm II only, eight calls, seven `BUILDING_BUSY` denials, no contract. No fun claim. |
| R08 reuse | [PACT-096 independent non-game proof](platform-reuse.md); `npm run check:non-game` run again today; integrated stock-plus-authority tests included in full suite | Pass. No PACT domain/database import in the non-game fixture. |

The plain [PACT-048 UI acceptance](rules-ui-completion.md) is a prerequisite and provides actual browser gameplay. It verifies two-player capability across paired sessions, not one same-pair longitudinal pilot or simultaneous isolated browsers. It does not replace the deterministic R01–R06 checks.

## Reproduction and observed checks

Use Node 24, installed lockfile dependencies, and an isolated PostgreSQL 17 `pact_test` database. The following were run against this checkout after `0b144c5`:

```sh
npm run build
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run check:non-game
node scripts/rehearse-rules-restore.mjs
```

Results: build/typecheck/lint passed; lint includes import-boundary, build-order and fourteen published-contract fingerprint guards. **175/175 unit tests** in 53 files passed. **226/226 integration tests** passed in 39 files; one optional local-model test is skipped without its loopback URL. The non-game independent compile/runtime action → exact approval → receipt → notification → revoke cycle passed with forbidden PACT import rejected. The fresh disposable restore preserved stock/journal, 64 marked units of wealth, exact troop placements and command receipt; outbox replay deduplicated. PostgreSQL server version was 17.11 (client 18.4). The prior physical Restic snapshot `86734927` booted in a network-isolated PostgreSQL 17 container on the single VPS and reconciled game balances, Home Guard, Hall III instruction/receipt and outbox replay; this gate did **not** rerun the physical restore.

With a loopback-bound `llama-server` and the variables in [the baseline runbook](../../operations/script-baseline.md), the optional two-test comparison also passed its measurement assertions; its actual outcome is unfavorable to the model as stated above. External API charge was USD 0, with local compute/electricity unmeasured. The measured model was Qwen3-4B GGUF, not a deployed supported-provider certification.

On the VPS, this read-only command passed on 29 September:

```sh
cd /srv/pact/source
./infra/production/bin/verify.sh infra/production/vps-connection-test.env https://safa.dedyn.io/pact
```

It checks running services, API/public health, Telegram framing, private key mounts, database isolation and cache controls. The immutable deployment and Chrome gameplay observations for `alpha-20260929-4` are in [the UI report](rules-ui-completion.md). A health check is not a fresh gameplay replay or security certification.

## Release inventory and limits

- Rules catalog: `pact-s1-v1`, exact 600 internal units/resource. Published command/event/API schema versions: `pact.command.v1`, `pact.event.v1`, `pact.api.v1`; fourteen published v1 schema fingerprints are guarded by `npm run check:contracts` (included in lint). MCP command surface is `pact_command_v1`; all clients share the application dispatcher and owner-scoped projections.
- Replay/invariant fixtures: `tests/integration/game-command-faults.test.ts`, `rules-runtime.test.ts`, `world-domain-order.test.ts`, `run-process-death.test.ts`, `script-baseline.test.ts`, plus the focused ledger/clock/authority/troop/raid fixtures indexed in [PACT-051](rules-verification-completion.md). The restore script is `scripts/rehearse-rules-restore.mjs`; no migration was added by this gate.
- Recovery boundary: local schema restore passed today; the physical single-VPS restore is from 28 September. Backups still share the VPS and do not cover host loss. Outbound email, paid model routes, native signing, full Telegram gameplay, production legal facts, security review and the 50-player pilot are later tickets.
- The one measured local model failed to negotiate despite a task-specific wire-schema shim. Do not extrapolate model quality, cost effectiveness or enjoyment from it. The private Alpha may be played and evaluated further without asserting social-slice or Season One exit.

## Handoff

After tracker reconciliation, PACT-054 is the next dependency-ready social-slice task. Its public profile/handle work must preserve immutable identity, private kingdom state and account-deletion tombstones. Keep the later PACT-067 three-week pilot and Season One production/distribution gates independent of this rules gate.
