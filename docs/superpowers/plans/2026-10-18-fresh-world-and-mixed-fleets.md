# Fresh PACT world and mixed Fleet enrollment plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans for later approved implementation. No delegation. This is a proposed plan; no reset/server access/new accounts/runs are authorized now.

**Goal:** Support a clean new PACT world with100 server Luna and20 local kingdoms while preserving the complete old world and preventing cross-world execution/memory leakage.

**Architecture:** Create and validate a separate empty database/instance rather than overwriting the active database. PACT publishes authoritative immutable world identity and enforces its ordinary authentication/command/lease boundaries; Fleet verifies identity, holds disjoint actor bindings and gates execution under finite renewable windows.

**Tech Stack:** Existing Node24/TypeScript, Fastify, PostgreSQL17, module-owned migrations and shared API/MCP handlers.

**Spec:** Fleet companion `fleet/.worktrees/phase0-engine-baseline/docs/superpowers/specs/2026-10-18-provider-qualification-and-mixed-world-design.md`; [plan from this checkout](https://github.com/safa-safakhou/fleet/blob/master/.worktrees/phase0-engine-baseline/docs/superpowers/plans/2026-10-18-provider-qualification-and-mixed-world.md).

## Global constraints

- Current assignment is planning/documentation only. Server Fleet/game host uncontacted; current local Fleet stays disabled. No new model calls, accounts, resets, enrollment, deployments, pushes or new backlog claims.
- Preserve original identities/history/allocations/receipts/uncertainty and terminal populations. No silent permission/economy/rules/counter change or new human-only authority.
- Fleet's immediate proposed local qualification budget is104 Nemotron executions/4160000 reserved tokens; proposed new world120 actors =100 Luna+four local groups×5. Each later stage needs exact separate scope/start/deadline and caps.
- PACT owns kingdoms/state/visibility/time/effects. One ordinary command path and write lease across surfaces. Core Fleet packages never depend on PACT domain types.

## Review focus

1. Same URL/new database incarnation: old credentials, queued actions/events and memory cannot be rebound.
2. Provisioning failure after uncertain activation: retry same entry key/identity rather than minting replacement kingdoms.
3. World clock paused/suspended: ordinary registration/activation prerequisites remain enforced; no undocumented paused enrollment promise.
4. Fresh database/canonical cutover: all old writers/settlements/auth clients identified and old backup actually restored before switching.
5. Cohort comparison: differing founding ages/model exposure remain visible; no false independent replicas, identical-start or model-presence promises.

### P-Q1: authoritative world identity and adapter acceptance — later source/offline work

**Files:** module-owned world migration and `packages/world/src/service.ts`; additive contracts in `packages/contracts/src/schemas.ts`, `agent-event-schemas.ts`, `agent-outlook-schemas.ts`; authenticated API/MCP profile delivery in existing `services/api/src/server.ts`/public handler interfaces; paired Fleet adapter checks in `src/environments/pact.ts`/`src/games/pact/credentials.ts`. Choose exact new migration sequence after reconciliation; no invented tracker ticket.

**Interface requirement:** an immutable database-owned worldInstanceId, returned by a versioned identity handshake and bound to the new-world credential/receipt/event scope. Distinguish world ID from productScope/rules version/origin. Fixture schemas get explicit independent identities. Existing approved interfaces remain compatible until opt-in/cutover; do not silently rebind old clients.

- [ ] Write failing tests for same-origin/different-instance rejection, old credential/pending-command/event/cursor/private-memory refusal, and same-world read/write compatibility with normal leases/permissions.
- [ ] Add minimum module-owned persistence and shared projections/validation; update adapter capability/digest negotiation. All clients use the same application authorization; no new agent permission bypass.
- [ ] Verify unit/integration/contracts/boundaries/build, migration/restore/idempotence, paired acceptance, privacy and backlog consistency; commit verified source. Default-off event/outlook activation and actual server installation require separate approval.

### P-Q2: clean-world preparation and cutover — later explicit operational approval

**Files:** new narrowly scoped `infra/production/bin/prepare-world-generation.sh` and `docs/operations/world-generation.md` only after approved design; reuse/verify existing `backup.sh`, `restore-drill.sh`, `rollback.sh`, compose configuration and module migrations. Test shell guards with synthetic targets; do not reuse test-schema drop helpers as reset commands.

- [ ] Inventory exact old-world server/database/blob/key/origin identifiers, all Fleet/automation/rules/API writers and pending effects. Verify current backup policy/capacity before any new archive; previous masked/removed backup history is not proof of availability.
- [ ] Require an exact approved retirement/cutover manifest; list existing human-account continuity/deletion scope and whether the public origin changes. Fence/drain old producers only under covering permission, preserving every unknown/pending item. Current server Fleet remains untouched until that permission.
- [ ] Encrypted full snapshot plus separate key/restore proof; provision a distinct empty PostgreSQL database and new world/issuer/key namespace behind a provisional origin. Never TRUNCATE/DROP the old world or restore old seed data into the empty one.
- [ ] Assert clean gameplay state before ordinary enrollment, rules/tick/receipt consistency, scoped OAuth/lease behavior and old-client rejection. Paused-clock enrollment is not assumed supported. Record interleaved founding times/resources, then common inference anchor after enrollment/shadow qualification.
- [ ] Bind all120 new actors through ordinary authorized account/mandate flows under a combined unique roster. New-world actors are explicitly approved test population, not resets/replacements for failed historical accounts. No credential/identity rebind or resource/clock adjustment.
- [ ] Exact new-world shadow qualification and reviewed release gates precede any gameplay execution. Canonical routing/new server Fleet installation/old-producer pause require their own covering authorization. Preserve old archive after cutover; post-cutover writes cannot be undone by replaying old receipts or overwriting new history.

### P-Q3: acceptance and reports — paired with Fleet budget windows

- [ ] Fake100-server+20-local concurrency/lease/identity tests; accepted ordinary commands/receipts/retries do not duplicate effects; unsupported F6 rejected before inference.
- [ ] Scope read-only shadow evidence to actual new world/source/settings and real grants. Keep actual model decisions separate from committed consequences and later outcomes; preserve missing/founding-age/exposure coverage.
- [ ] Observe first3 hourly rounds within the approved24h cap, not extra executions.100 Luna maximum4800/192000000 reservations;20 local maximum960/38400000, helper480. Code must enforce same-identity renewable authorization windows before first persistent-population launch; no automatic seven-day/continuous authority.
- [ ] At cap/window/unknown delivery stop admission, preserve state and require exact recovery or bounded renewal. Existing original populations/allocations stay archived under their original identities, without fabricated usage reviews.

## Current result

Saved design and budgets only; no implementation, server inspection, reset, account creation or real provider run. Dependencies above are proposed/unstarted, not newly done tracker work. Author review only; local documentation commits and backlog/diff validation are the handoff.
