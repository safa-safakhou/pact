# Two-Kingdom Negotiation — PACT Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` for subsequent authorized implementation. Work inline without delegation. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supply independent two-kingdom fixtures and authoritative supply/communication evidence for the paired negotiation milestone.

**Architecture:** Reuse normal onboarding, agent authority, command receipts and full rules ticks. PACT owns economic truth and controls; Fleet owns decisions, memory and usage. Add separate test-only negotiation contracts, preserving historical evidence and production rules.

**Tech Stack:** Existing Node 24, TypeScript, PostgreSQL 17, Vitest and public PACT modules; no new dependency.

**Spec:** [Milestone design](../../../../fleet/docs/superpowers/specs/2026-10-20-two-kingdom-negotiation-design.md). [Canonical tasks N01–N08](../../../../fleet/docs/superpowers/plans/2026-10-20-two-kingdom-negotiation.md).

**Status:** Planning only, 20 October 2026. No new runs, source implementation or runtime changes. Baseline `41e8bcdd85b320fa31bbf31c328214b71dd6e0e1`. This details PACT ownership of N01/N02/N06/N08, not another task list to execute twice.

## Global Constraints

- Preserve the parked world, archives, other populations, goals, mandates, unknowns and private evidence. No server contact, deployment, reset/replay, recovery review or settings change.
- Later offline work uses fresh owned loopback fixtures only. Reuse specialist F00's runner; verify environment/configs and never borrow retained databases or stop unowned services.
- Unchanged rules, integer scaling, ordinary/founding resources, contact/lease/grant checks, supply formulas and minute ordering.
- Exactly two active kingdoms per negotiation world; separate solo worlds. Evaluator-only data never enters actor observations.
- Historical `tests/evaluation/design.json`/672-cell registry remains unchanged. Supply evidence gets its own schema; the existing garrison schema does not already cover it.
- This assignment is prose only. Listed commands belong to a later source/offline assignment; real models remain a further separate gate.

## Review Focus

1. Domain-service success bypassing agent contact/lease permission: N02/N06 use actual principals and dispatcher.
2. Signature/counteroffer attached to the wrong peer/version: N02 asserts receipt/source joins and stale-signature rejection.
3. One flow defaults after the opposite flow paid: N02 records independent obligations, never atomic barter.
4. Gain arises from ignored costs or different solo timing: N02/N05 match goals, state, permissions and final tick.
5. Fixture/clock reset reaches preserved state: N01/N02 require ownership manifests and fail-closed targets.

## Existing source to reuse

| Files | Purpose |
| --- | --- |
| `tests/evaluation/world.ts`, `plan.ts` | Isolation/onboarding patterns; add an explicit negotiation manifest rather than accepting arbitrary old replica IDs |
| `tests/integration/social-material.test.ts` | Numerical 2 Iron/hour ↔ 1 Silver/hour reference; its shared fixture is not the new independent-world proof |
| `packages/application/src/dispatcher.ts`, `game-command-handler.ts` | Agent authorization, idempotency and receipts |
| `packages/kingdom/src/supply.ts`, `supply-settlement.ts`, `supply-terms.ts` | Exact versions, bonds, boundaries and independent obligations |
| `packages/kingdom/src/social-attention.ts`, `observation-sections.ts`, `agent-outlook.ts` | Actor-scoped facts/coverage without automatic message acknowledgment |
| `workers/rules/src/runtime.ts` | Full normal tick phases, not a manually selected settlement subset |
| `tests/integration/game-command-social.test.ts`, `game-command-faults.test.ts` | Permission and crash/receipt test patterns |

## N01 — Manifest/schema ownership

**Create:** `tests/evaluation/negotiation-design.json`, `negotiation-plan.ts`, `negotiation-contracts.ts`, `tests/unit/negotiation-plan.test.ts`.

**Interfaces:** Implement canonical N01 cells/evidence/solo contracts and strict `pact.negotiation-outcome.v1` JSON Schema mirrored for Fleet validation. This is evaluation data, not a deployed endpoint/permission.

- [x] Freeze C01–C06 state, private objectives, reference outcomes, caps, clock modes and split rotations. Test wrong world/config, duplicate cells, private fields and incorrect amount scaling.
- [x] From Fleet run `npm run test:architecture -- --repo pact tests/unit/negotiation-plan.test.ts`; see the intended missing contract assertion fail.
- [x] Implement exact decimal-string amounts, scoped refs and explicit coverage. Mark provider stages unapproved and preserve historical manifests.
- [x] Rerun new/existing evaluation-plan suites and mirror digest checks. Parsing must create no fixture, account or provider call.
- [x] Commit N01 files locally using the canonical task message.

## N02 — Worlds, full lifecycle and independent controls

**Create:** `tests/evaluation/negotiation-world.ts`, `negotiation-outcome.ts`, `tests/integration/negotiation-worlds.test.ts`, `negotiation-lifecycle.test.ts`.

**Interfaces:** `createNegotiationWorld(ownedFixture,cell):Promise<NegotiationWorld>`; `readNegotiationEvidence(world):Promise<NegotiationEvidence>`; `compareSolo(trade,controls):SoloComparison[]`. The handle supplies actor-scoped reads/dispatch, full-tick `advanceTo(gameMinute)` and manifest-owned cleanup. No production migration is expected.

- [ ] Test separate identities/stocks, onboarding invariants, agent-decided contact, same-version signatures, canonical receipts, 60 installments/flow and natural expiry. Cover C02 owner-goal amendment/stale version; C03 negative value; C04 expired/revoked/stale admission; C05 true default versus fulfillment. Do not use fixed UUIDs as model hints.
- [ ] Run both new integration files through F00's PACT runner; establish red on a missing behavior, not absent infrastructure.
- [ ] Construct initial stocks before decisions with ledger provenance. Later actions use agent principals/current mandates/leases/shared dispatcher. C05's scripted owner intervention uses its real handler and is labelled. Execute all ordinary ticks in order; never selectively freeze native time while a model thinks.
- [ ] Rerun new suites and existing social-material/supply-offers/supply-settlement/game-command-social/game-command-faults checks. At actual final refill boundary require A donor Iron equal solo and Silver +1; B donor Silver equal solo and Iron +2. Derive times from actual activation/start/end records. Actor adapters cannot read private opposing state.
- [ ] Commit fixtures/evidence/tests. A reproduced production defect receives a separate minimal fix/regression/report; no economic or authority change to make an agent pass.

## N06/N08 — Paired acceptance and report

Fleet N06 consumes exported fixture evidence and built public packages through the existing acceptance pattern. Runtime Fleet imports no PACT test or database code. Scripted prefixes never count as autonomous proposals/history.

N08 writes `docs/implementation/reports/two-kingdom-negotiation-source-acceptance-20261020.md` with both sources, schema digests, checks/skips, unsupported coverage and preserved runtime. Later source verification runs build/typecheck/lint/contracts/boundaries and isolated unit/integration tests; it makes no hosted/provider acceptance claim.

## Architecture and operational boundaries

This milestone does not implement specialist A07/A08. Existing single-controller cognition uses normal authoritative PACT handlers. A07/A08 become prerequisites when persistent resources/diplomacy specialists enter the benchmark; their internal reservations cannot replace authoritative commit checks.

The proposed `reactive-cognition@2` needs Fleet F02–F06. PACT rules and old profiles remain compatible. Six architecture families can have more than six version choices; catalog tests must preserve that distinction.

E1 is the first future operational proposal: two development cells, at most 144 model calls / 5,760,000 reserved tokens, zero helpers and six sequential wall hours. It is **unapproved and unstarted**. All other matrices/thresholds are in design §§6–8. This planning task selects no actual model artifact, launch time or grant.
