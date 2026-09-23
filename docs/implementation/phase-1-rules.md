# Phase 1 — Transactional rules prototype

**27 tickets · 4 completed.** [Backlog overview](README.md) · [Machine-readable tickets](tasks.json)

Dependencies are completion requirements. Later phases also depend on the preceding gate. Owner roles are disciplines, not assigned people. Size is complexity, not a time commitment.

<a id="pact-028"></a>
## PACT-028 — Encode the versioned rules catalog and exact arithmetic

**Status:** done · **Role:** Rules · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027)

**Components:** pure rules catalog and arithmetic.

**Specification:** [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R01, R02, R05

**Implement / deliver**

- Translate all building/unit/resource/cost/cap/harvest tables into a versioned data catalog with schema validation.
- Implement exact resource-unit and rational-power helpers, UUID tie ordering, rounding, and deterministic fixture loading; reject unsafe numeric serialization.

**Acceptance**

- [x] Every published value has a catalog entry and explicit unit; server rules use no floating-point comparison for combat or settlement.
- [x] Reproduce construction affordability, six-hour food example, and rational power values; API round-trips preserve exact quantities.

**Assignee:** codex-rules-foundation

**Evidence**

- docs/implementation/reports/rules-catalog.md — 2026-09-23: pact-s1-v1 Zod catalog, exact BigInt resource and rational power helpers, grant-first construction, deterministic fixtures, UUID ordering, and API decimal-string round-trip; npm run build, npm test (81), npm run typecheck, npm run lint passed under Node 24.

<a id="pact-029"></a>
## PACT-029 — Implement the authoritative clock and atomic tick coordinator

**Status:** done · **Role:** Backend · **Size:** L · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-028](phase-1-rules.md#pact-028)

**Components:** game clock, rules worker.

**Specification:** [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R02, R06

**Implement / deliver**

- Implement game-time/real-time separation, minute boundaries, unique world-worker lease, phase ordering, command admission against a committed tick, and pause/resume.
- Persist resumable work and publish each tick atomically; define crash recovery without catching up starvation after an outage.

**Acceptance**

- [x] A second worker, lease expiry, duplicate tick, or crash between phases cannot publish mixed-time state.
- [x] Exact-boundary fixtures and outage recovery freeze game windows/harvest together while account expiries continue in real time.

**Assignee:** codex-rules-foundation

**Evidence**

- docs/implementation/reports/world-clock.md — 2026-09-23: PostgreSQL-fenced world lease, committed game-minute clock, atomic ordered tick transaction/outbox, command admission, suspension/resume without catch-up. Node 24 npm run build, lint, typecheck, test (83), test:integration (41) passed against PostgreSQL 17.

<a id="pact-030"></a>
## PACT-030 — Implement the resource ledger, provenance, and storage

**Status:** done · **Role:** Backend · **Size:** L · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-028](phase-1-rules.md#pact-028), [PACT-029](phase-1-rules.md#pact-029)

**Components:** resource ledger, storage.

**Specification:** [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R01, R06

**Implement / deliver**

- Add ordinary/restricted balances, production/sink records, locked funds, installed/training cost provenance, storage limits, and atomic debit/credit primitives.
- Persist explicit overflow and cancellation losses; integrate the minute-production phase and founding-allowance expiry hooks.

**Acceptance**

- [x] Property tests conserve value across debit/credit/overflow operations and reject negative balances.
- [x] Concurrent commands cannot overspend; allowance funds cannot enter trade, bond, unit training, raid provisions, or ordinary cancellation refunds.

**Assignee:** codex-rules-foundation

**Evidence**

- docs/implementation/reports/resource-ledger.md — 2026-09-23: exact ordinary/restricted/locked balances, idempotent movement/provenance records, storage overflow, cancellation loss, grant expiry and atomic production hooks. Node 24 npm run lint, typecheck, build, test (87), test:integration (46) passed against PostgreSQL 17.

<a id="pact-031"></a>
## PACT-031 — Activate real kingdoms exactly once

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-008](phase-0-connections.md#pact-008), [PACT-027](phase-0-connections.md#pact-027), [PACT-028](phase-1-rules.md#pact-028), [PACT-029](phase-1-rules.md#pact-029), [PACT-030](phase-1-rules.md#pact-030)

**Components:** kingdom founding.

**Specification:** [access](../pact/access.md), [rules](../pact/rules.md) · **Release checks:** A01, R01, R02

**Implement / deliver**

- Replace the sandbox activation fixture with the real human-only founding transaction: unique handle, seven starting buildings, two builders, restricted grants, Home Guard, score baseline, and filled charges. Include the minimal unit identity/placement schema needed to persist the founding Home Guard; PACT-033 extends it with training and military behavior.
- Add activation event, one-ranked-kingdom constraint, connection-check expiry validation, and first-tick scheduling.

**Acceptance**

- [x] Concurrent activation attempts return one kingdom, one set of grants, and one activation time.
- [x] The draft is never targetable before commit; activation produces the specified zero ordinary wealth and starts time/charges only once.

**Assignee:** codex-rules-foundation

**Evidence**

- docs/implementation/reports/kingdom-founding.md — 2026-09-23: atomic one-time ranked activation, human-only API, founding state, rollback/retention checks. Node 24 npm run build, typecheck, test (88), test:integration (51), lint passed against PostgreSQL 17.

<a id="pact-032"></a>
## PACT-032 — Implement building upgrades and the two builder queues

**Status:** todo · **Role:** Rules · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-030](phase-1-rules.md#pact-030), [PACT-031](phase-1-rules.md#pact-031)

**Components:** building rules and queues.

**Specification:** [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R01, R02, R04

**Implement / deliver**

- Implement unlock/prerequisite validation, target-level costs, two active slots, one waiting instruction per slot, exact completion times, and 50% active cancellation refunds.
- Preserve paid-resource provenance and call the authority reservation interface on queue/start/cancel; final economic integration is verified in PACT-039.

**Acceptance**

- [ ] Hall and dependent upgrades reach every specified level without illegal bypass; the same building cannot occupy both slots.
- [ ] Waiting starts in slot order only when funded/authorized; completion or cancellation retries never duplicate level gains, refunds, or spending.

<a id="pact-033"></a>
## PACT-033 — Implement troop identity, training, placement, and capacity

**Status:** todo · **Role:** Rules · **Size:** L · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-028](phase-1-rules.md#pact-028), [PACT-030](phase-1-rules.md#pact-030), [PACT-031](phase-1-rules.md#pact-031)

**Components:** unit inventory and training.

**Specification:** [rules](../pact/rules.md) · **Release checks:** R01, R03

**Implement / deliver**

- Add immutable unit IDs and owner/type/Home-Guard/placement fields; implement one training queue, batches up to 40, reserved costs/slots, completion, cancellation, and disbanding.
- Create commitment and battle-eligibility interfaces that reference existing units rather than copy inventories.

**Acceptance**

- [ ] Simultaneous training/assignment cannot overfill owned or visiting pools or reuse a unit in exclusive placements.
- [ ] Home Guard cannot raid/scout/lend/refund, but can disband for zero; partial training cancellation refunds only uncompleted reserved costs.

<a id="pact-034"></a>
## PACT-034 — Implement upkeep, hunger recovery, and desertion

**Status:** todo · **Role:** Rules · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-029](phase-1-rules.md#pact-029), [PACT-030](phase-1-rules.md#pact-030), [PACT-033](phase-1-rules.md#pact-033)

**Components:** upkeep and attrition.

**Specification:** [rules](../pact/rules.md) · **Release checks:** R02, R03

**Implement / deliver**

- Implement food responsibility by current placement, ordinary-before-allowance spending, Hungry state, funded-minute recovery, shortage warning, and desertion schedule.
- Group desertion by food payer/original owner across formations, use fixed type/ID allocation, and emit hooks for host garrison default.

**Acceptance**

- [ ] Recovery requires 60 consecutive funded minutes; first desertion is minute 180, then each additional underfunded hour.
- [ ] Splitting units across contracts or display stacks changes no losses; operational locks do not create starvation immunity.

<a id="pact-035"></a>
## PACT-035 — Implement kingdom-wide charges and action limits

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-029](phase-1-rules.md#pact-029), [PACT-031](phase-1-rules.md#pact-031)

**Components:** limits and charges.

**Specification:** [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R02, R04

**Implement / deliver**

- Implement full starting raid/scout pools, serial regeneration clocks, successful-action rolling windows, and shared human/agent/client counters.
- Separate receipt/security-control abuse limits from gameplay reads; expose exact next-regeneration and retry timestamps.

**Acceptance**

- [ ] Spend from full starts the timer; further spends do not reset it; capped pools bank no extra time.
- [ ] Provider/client swaps and retries cannot refill charges or bypass quotas; rejected/idempotent commands incur no additional fee or successful-action count.

<a id="pact-036"></a>
## PACT-036 — Implement contacts, bounded messages, and direct transfers

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-022](phase-0-connections.md#pact-022), [PACT-027](phase-0-connections.md#pact-027), [PACT-030](phase-1-rules.md#pact-030), [PACT-031](phase-1-rules.md#pact-031), [PACT-035](phase-1-rules.md#pact-035)

**Components:** contacts, messages, transfers.

**Specification:** [rules](../pact/rules.md), [social](../pact/social.md), [runtime](../pact/runtime.md) · **Release checks:** R01, R04

**Implement / deliver**

- Implement accepted contacts, cold request fee/expiry/capacity, bounded private threads, unread counters, message limits, and minimal block/mute state.
- Implement one-off ordinary-resource transfers with recipient overflow, accepted-contact checks, shared limits, and direct-contact invitations for controlled tests.

**Acceptance**

- [ ] Full queues reject before charging; blocked pairs cannot send text, new offers, or gifts in either direction.
- [ ] A transfer charges once and never guarantees a return payment; notification traffic does not consume player-message allowance.

<a id="pact-037"></a>
## PACT-037 — Implement supply offers, signatures, bonds, and contract activation

**Status:** todo · **Role:** Rules · **Size:** L · **Type:** implementation

**Depends on:** [PACT-019](phase-0-connections.md#pact-019), [PACT-027](phase-0-connections.md#pact-027), [PACT-030](phase-1-rules.md#pact-030), [PACT-035](phase-1-rules.md#pact-035), [PACT-036](phase-1-rules.md#pact-036)

**Components:** supply offers and signatures.

**Specification:** [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R01, R04

**Implement / deliver**

- Build typed offer versions, exact signatures, allowed durations/notices/rates, expiries, incoming/outgoing slot limits, bonds, and atomic activation.
- Wire provisional authority reservation hooks on signature, invalidation, activation, and withdrawal; settlement is PACT-038 and complete exposure integration is PACT-039.

**Acceptance**

- [ ] A counteroffer invalidates old signatures; simultaneous acceptances cannot duplicate a contract or exceed bond/contract capacity.
- [ ] Half-funded bonds, zero/zero flows, invalid notice, self-contracts, expired offers, and blocked parties fail without partial activation.

<a id="pact-038"></a>
## PACT-038 — Implement independent contract delivery and default settlement

**Status:** todo · **Role:** Rules · **Size:** L · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-029](phase-1-rules.md#pact-029), [PACT-030](phase-1-rules.md#pact-030), [PACT-034](phase-1-rules.md#pact-034), [PACT-037](phase-1-rules.md#pact-037)

**Components:** contract settlement and bonds.

**Specification:** [rules](../pact/rules.md) · **Release checks:** R01, R02

**Implement / deliver**

- Implement pre-delivery snapshots, reserve-constrained available balances, proportional allocation with contract-ID remainder order, later incoming credits, and all termination/bond states.
- Settle notice, mutual release, natural expiry, one-sided default, and simultaneous default in the specified tick phases.

**Acceptance**

- [ ] A six-hour contract produces exactly 360 installments; incoming funds cannot finance another outgoing obligation in the same tick.
- [ ] Partial delivery defaults correctly without reversing an already-funded counterparty; both-default bond transfer, overflow, floor changes, and grant expiry match the rulebook.

<a id="pact-039"></a>
## PACT-039 — Complete future exposure accounting and human exceptions

**Status:** todo · **Role:** Backend · **Size:** L · **Type:** implementation

**Depends on:** [PACT-019](phase-0-connections.md#pact-019), [PACT-020](phase-0-connections.md#pact-020), [PACT-027](phase-0-connections.md#pact-027), [PACT-032](phase-1-rules.md#pact-032), [PACT-037](phase-1-rules.md#pact-037), [PACT-038](phase-1-rules.md#pact-038)

**Components:** authority exposure ledger.

**Specification:** [runtime](../pact/runtime.md), [rules](../pact/rules.md) · **Release checks:** R04

**Implement / deliver**

- Integrate the authorization ledger across signed future flows, bonds, queued construction, immediate costs, troop limits, and visiting-upkeep reservations.
- Move actual outgoing amounts from reserved to spent; release unused exposure on every terminal path; retain exact human-permit commitments separately.

**Acceptance**

- [ ] Two concurrent signatures cannot each reserve the last allowance; switching providers never creates a second ledger.
- [ ] Refunds/incoming trades do not replenish spent authority; canceled offers release once; lowered mandates and approved exceptions follow the specified existing-commitment behavior.

<a id="pact-040"></a>
## PACT-040 — Implement garrison contracts, recall, return, and seizure

**Status:** todo · **Role:** Rules · **Size:** L · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-033](phase-1-rules.md#pact-033), [PACT-034](phase-1-rules.md#pact-034), [PACT-037](phase-1-rules.md#pact-037), [PACT-039](phase-1-rules.md#pact-039)

**Components:** garrison rules.

**Specification:** [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R01, R03, R04

**Implement / deliver**

- Implement Hall-III lending, host acceptance, garrison bonds/slots, immediate placement, host feeding, durations, expiry/recall/return/default, and explicit human-approved seizure.
- Use a shared battle-lock interface; queue exits behind existing locks and exclude them from new locks. Integrate final overlapping-battle behavior in PACT-044.

**Acceptance**

- [ ] Owner and host capacity remain consistent through return/death/seizure; seized units keep IDs and transfer wealth once.
- [ ] Underfunded host default and pending return do not extend upkeep exposure beyond the prescribed lock allowance; seizure cannot bypass a lock or human approval.

<a id="pact-041"></a>
## PACT-041 — Implement scouting and private observation reports

**Status:** todo · **Role:** Rules · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-029](phase-1-rules.md#pact-029), [PACT-033](phase-1-rules.md#pact-033), [PACT-035](phase-1-rules.md#pact-035), [PACT-039](phase-1-rules.md#pact-039)

**Components:** scout rules and reports.

**Specification:** [rules](../pact/rules.md), [social](../pact/social.md) · **Release checks:** R02, R03, R04

**Implement / deliver**

- Implement charge/ordinary-resource costs, two-Spearman commitment, ten-minute completion, target notice, and report visibility.
- Sample bands and exact wall from post-battle state when deadlines coincide; timestamp reports and expose shareable report records without unrelated private data.

**Acceptance**

- [ ] Home Guard, locked units, self-targets, and insufficient resources cannot start a scout; retries never charge twice.
- [ ] Band boundary/fractional-stock fixtures pass and no visiting-owner names, private contracts, or offsite troops leak into the report.

<a id="pact-042"></a>
## PACT-042 — Implement raid seed commitments and deterministic dice

**Status:** todo · **Role:** Security · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-028](phase-1-rules.md#pact-028)

**Components:** randomness and verification.

**Specification:** [social](../pact/social.md), [rules](../pact/rules.md) · **Release checks:** R05

**Implement / deliver**

- Implement CSPRNG seeds, encrypted storage, RFC-8785 commitment payloads, HMAC rejection-sampling dice, reveal-on-resolution/cancellation, and seed-access audit.
- Publish a small verification routine and the specification’s fixed fixture; keep cryptographic and game-power calculations separate.

**Acceptance**

- [ ] The reference seed yields the published commitment and attacker 6 / defender 1.
- [ ] Rejection of byte values 252–255, modified seed/raid/version, and pre-resolution read attempts are tested; canceled raids reveal the original seed.

<a id="pact-043"></a>
## PACT-043 — Implement pure combat, casualties, and loot calculations

**Status:** todo · **Role:** Rules · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-028](phase-1-rules.md#pact-028), [PACT-033](phase-1-rules.md#pact-033)

**Components:** pure combat calculator.

**Specification:** [rules](../pact/rules.md) · **Release checks:** R03, R05

**Implement / deliver**

- Build deterministic functions for counters, hunger, Ram wall suppression, dice multipliers, tie/zero branches, casualty grouping, type/ID selection, carrying capacity, and loot priorities.
- Return a complete typed calculation trace for entitled participants without reading live database state inside the calculator.

**Acceptance**

- [ ] The worked battle loses 7 attackers and 14 defenders, carries 100 Silver and 44 Iron, and wins 26 of 36 die pairs.
- [ ] Reordering/splitting formations preserves results; same-owner troops on opposite sides remain distinct groups; no-negative and zero-power properties pass.

<a id="pact-044"></a>
## PACT-044 — Implement raids, contributors, locks, and overlapping resolution

**Status:** todo · **Role:** Rules · **Size:** L · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-029](phase-1-rules.md#pact-029), [PACT-033](phase-1-rules.md#pact-033), [PACT-034](phase-1-rules.md#pact-034), [PACT-035](phase-1-rules.md#pact-035), [PACT-039](phase-1-rules.md#pact-039), [PACT-040](phase-1-rules.md#pact-040), [PACT-042](phase-1-rules.md#pact-042), [PACT-043](phase-1-rules.md#pact-043)

**Components:** raid lifecycle and locks.

**Specification:** [rules](../pact/rules.md), [social](../pact/social.md) · **Release checks:** R02, R03, R05

**Implement / deliver**

- Implement declarations, exact deadlines, two nominated contributors, provisions, acceptance/withdrawal, final locks, and pinned wall/unit snapshots.
- Resolve raids in chronological/declaration order against surviving IDs, apply loot only to the leader, release pending returns, and retain participant/public report variants.

**Acceptance**

- [ ] An earlier battle’s casualties are absent from every later resolution; no unit can fight from two placements or be duplicated as reinforcement.
- [ ] Same-boundary completion/lock/withdrawal, hunger changes, leader cancellation, pinned visitors, last-second requests, and missing units resolve exactly once.

<a id="pact-045"></a>
## PACT-045 — Build authorized world views and factual forecasts

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-022](phase-0-connections.md#pact-022), [PACT-027](phase-0-connections.md#pact-027), [PACT-032](phase-1-rules.md#pact-032), [PACT-038](phase-1-rules.md#pact-038), [PACT-040](phase-1-rules.md#pact-040), [PACT-041](phase-1-rules.md#pact-041), [PACT-044](phase-1-rules.md#pact-044)

**Components:** authorized state projections.

**Specification:** [rules](../pact/rules.md), [runtime](../pact/runtime.md), [product](../pact/product.md) · **Release checks:** R06

**Implement / deliver**

- Expose current kingdom/production/upkeep/builders/troops/contracts/threats, bounded records, and factual event summaries from committed state.
- Create separate owner, participant, contact, and public projections; show exact time, last committed version, and forecast assumptions.

**Acceptance**

- [ ] Unauthorized IDs and public profiles never expose live stocks, building levels, commitments, or model instructions.
- [ ] Forecasts label assumed future deliveries, preserve founding-versus-ordinary amounts, and change correctly after default, harvest shift, and overlapping combat.

<a id="pact-046"></a>
## PACT-046 — Implement Fortune accounting and provisional standings

**Status:** todo · **Role:** Rules · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-030](phase-1-rules.md#pact-030), [PACT-032](phase-1-rules.md#pact-032), [PACT-033](phase-1-rules.md#pact-033), [PACT-038](phase-1-rules.md#pact-038), [PACT-040](phase-1-rules.md#pact-040), [PACT-044](phase-1-rules.md#pact-044)

**Components:** wealth accounting and rankings.

**Specification:** [rules](../pact/rules.md) · **Release checks:** R01

**Implement / deliver**

- Compute exact marked wealth from stock, reserved construction/training, ordinary installed value, owned bonds, and surviving owned troops; keep a season baseline and hourly snapshots.
- Add Hall-band filters and provisional ranking queries without awarding final seasonal prizes yet.

**Acceptance**

- [ ] Build/train conversions preserve marked wealth; grants, Home Guard, expected income, borrowed units, and cosmetics never count.
- [ ] Transfer, default, cancellation, loot, and seizure fixtures change the correct owner’s wealth once and allow negative Fortune.

<a id="pact-047"></a>
## PACT-047 — Implement achievement triggers and earned cosmetic entitlements

**Status:** todo · **Role:** Rules · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-032](phase-1-rules.md#pact-032), [PACT-038](phase-1-rules.md#pact-038), [PACT-041](phase-1-rules.md#pact-041), [PACT-044](phase-1-rules.md#pact-044), [PACT-046](phase-1-rules.md#pact-046)

**Components:** achievements and earned entitlements.

**Specification:** [rules](../pact/rules.md), [product](../pact/product.md) · **Release checks:** R01, L03

**Implement / deliver**

- Add event-driven, once-per-account achievement records, the eight exact triggers, and atomic grants of each ornament plus 25 earned Gems.
- Keep a separate cosmetic entitlement/wallet ledger; provide test event fixtures for future Seal and seasonal triggers without claiming those features are shipped.

**Acceptance**

- [ ] Replayed events cannot award duplicate Gems or ornaments.
- [ ] Achievements grant no resource/authority/production benefit; a private dev event injector is absent from public HTTP and MCP surfaces.

<a id="pact-048"></a>
## PACT-048 — Build the plain rules-prototype interface

**Status:** todo · **Role:** Frontend · **Size:** L · **Type:** implementation

**Depends on:** [PACT-023](phase-0-connections.md#pact-023), [PACT-027](phase-0-connections.md#pact-027), [PACT-045](phase-1-rules.md#pact-045), [PACT-046](phase-1-rules.md#pact-046), [PACT-047](phase-1-rules.md#pact-047)

**Components:** functional gameplay UI.

**Specification:** [product](../pact/product.md), [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R01, R05

**Implement / deliver**

- Implement functional Kingdom/Envoy/People/Chronicle navigation with text-first construction, training, contract sheets, troop/garrison/scout/raid controls, and report views.
- Connect all human controls to the shared commands, approval previews, server versions, and live events; keep art and shop out of this stage.

**Acceptance**

- [ ] Two test players can found, develop, negotiate, trade, scout, lend, raid, inspect losses, and rebuild using the UI.
- [ ] Manual actions remain usable with disconnected providers and cannot bypass stock, charge, lock, or shared action limits.

<a id="pact-049"></a>
## PACT-049 — Expose complete game tools to every Envoy route

**Status:** todo · **Role:** Integrations · **Size:** M · **Type:** implementation

**Depends on:** [PACT-017](phase-0-connections.md#pact-017), [PACT-021](phase-0-connections.md#pact-021), [PACT-027](phase-0-connections.md#pact-027), [PACT-039](phase-1-rules.md#pact-039), [PACT-045](phase-1-rules.md#pact-045), [PACT-048](phase-1-rules.md#pact-048)

**Components:** game tool registry, context assembly.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md), [rules](../pact/rules.md), [architecture](../pact/architecture.md) · **Release checks:** R04, R06

**Implement / deliver**

- Replace sandbox-only routing with all permitted typed game command groups, record reads, messages, receipts, and approvals.
- Implement bounded context selection and readable receipt summaries; preserve the same dispatch and authorization behavior in all adapters and MCP.

**Acceptance**

- [ ] A recorded scenario produces equivalent game commands/receipts from web, adapter, and MCP paths.
- [ ] Malicious counterpart text cannot change identity, tool scope, model connection, or mandate; no adapter receives hidden state through a convenience summary.
- [ ] Generated SDK, model-adapter, and MCP commands use the same product-scoped contracts and cannot gain first-party human privileges.

<a id="pact-050"></a>
## PACT-050 — Implement gameplay retirement and account-deletion settlement

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-024](phase-0-connections.md#pact-024), [PACT-027](phase-0-connections.md#pact-027), [PACT-038](phase-1-rules.md#pact-038), [PACT-040](phase-1-rules.md#pact-040), [PACT-041](phase-1-rules.md#pact-041), [PACT-044](phase-1-rules.md#pact-044), [PACT-046](phase-1-rules.md#pact-046)

**Components:** kingdom retirement.

**Specification:** [privacy](../pact/privacy.md), [rules](../pact/rules.md) · **Release checks:** R01, R03, R06

**Implement / deliver**

- Add closing/retired kingdom states, immediate access revocation, rejection of new commitments, supply defaults, pending unit returns, existing-engagement settlement, and final asset disposal.
- Decouple identifying-data erasure deadlines from frozen game time and preserve only permitted economic tombstones.

**Acceptance**

- [ ] Deletion cannot cancel an already-declared enemy raid or redirect remaining wealth to a friend.
- [ ] Both owners closing, locked visiting troops, a long world pause, and repeated retirement jobs settle once while personal data still meets real-time deletion deadlines.

<a id="pact-051"></a>
## PACT-051 — Run transaction, replay, and adversarial rules tests

**Status:** todo · **Role:** QA · **Size:** L · **Type:** verification

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-029](phase-1-rules.md#pact-029), [PACT-030](phase-1-rules.md#pact-030), [PACT-032](phase-1-rules.md#pact-032), [PACT-033](phase-1-rules.md#pact-033), [PACT-034](phase-1-rules.md#pact-034), [PACT-035](phase-1-rules.md#pact-035), [PACT-036](phase-1-rules.md#pact-036), [PACT-037](phase-1-rules.md#pact-037), [PACT-038](phase-1-rules.md#pact-038), [PACT-039](phase-1-rules.md#pact-039), [PACT-040](phase-1-rules.md#pact-040), [PACT-041](phase-1-rules.md#pact-041), [PACT-042](phase-1-rules.md#pact-042), [PACT-043](phase-1-rules.md#pact-043), [PACT-044](phase-1-rules.md#pact-044), [PACT-046](phase-1-rules.md#pact-046), [PACT-050](phase-1-rules.md#pact-050)

**Components:** rules property/recovery suites.

**Specification:** [delivery](../pact/delivery.md), [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R01, R02, R03, R04, R05, R06

**Implement / deliver**

- Build seeded/property-based economy scenarios, boundary-time fixtures, cross-account authorization tests, and fault injection around every durable command/tick transition.
- Rehearse backup restore and outbox replay; compare recomputed wealth and unit placement to the authoritative state after recovery.

**Acceptance**

- [ ] All R01–R06 assertions have reproducible passing evidence, including overlapping raids and multi-client authority races.
- [ ] No negative stock, duplicate troop, repeated reward, partially published tick, or lost committed receipt survives a generated scenario.

<a id="pact-052"></a>
## PACT-052 — Build and run the allowed script baseline

**Status:** todo · **Role:** QA · **Size:** M · **Type:** verification

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-049](phase-1-rules.md#pact-049), [PACT-051](phase-1-rules.md#pact-051)

**Components:** script client and comparison harness.

**Specification:** [delivery](../pact/delivery.md), [runtime](../pact/runtime.md) · **Release checks:** R07

**Implement / deliver**

- Create a deterministic client that uses the same published reads, negotiation primitives, and command limits as Envoys; isolate operator test identities from the real world.
- Run matched scripted and model-driven scenarios with recorded initial state, partner behavior, quotas, outcomes, and API costs when measurable.

**Acceptance**

- [ ] The script cannot use hidden state, private administrative APIs, free resources, or privileged action rates.
- [ ] Publish the actual comparison even when the script wins; a successful execution test is separate from proof that negotiation is fun.

<a id="pact-096"></a>
## PACT-096 — Demonstrate platform-module reuse outside PACT

**Status:** todo · **Role:** Architecture / QA · **Size:** M · **Type:** verification

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-028](phase-1-rules.md#pact-028), [PACT-039](phase-1-rules.md#pact-039), [PACT-049](phase-1-rules.md#pact-049), [PACT-051](phase-1-rules.md#pact-051), [PACT-082](phase-0-connections.md#pact-082), [PACT-083](phase-0-connections.md#pact-083)

**Components:** non-game fixture, module isolation tests.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [delivery](../pact/delivery.md) · **Release checks:** R08

**Implement / deliver**

- Build a small test-only non-game application using identity, model/runtime, exact approvals, and notifications through public package exports and in-memory adapters.
- Use a fake provider and generic synthetic action; prove no PACT-domain/database import, no credential/event sharing across product scopes, and no required deployment-provider dependency.

**Acceptance**

- [ ] The fixture compiles/runs independently and completes a bounded action/approval cycle without kingdom types or production services.
- [ ] PACT’s integrated stock-plus-authority transaction tests still pass; CI blocks prohibited imports and unversioned breaking contract changes.

<a id="pact-053"></a>
## PACT-053 — Accept the transactional rules prototype

**Status:** todo · **Role:** Release · **Size:** S · **Type:** gate

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-028](phase-1-rules.md#pact-028), [PACT-029](phase-1-rules.md#pact-029), [PACT-030](phase-1-rules.md#pact-030), [PACT-031](phase-1-rules.md#pact-031), [PACT-032](phase-1-rules.md#pact-032), [PACT-033](phase-1-rules.md#pact-033), [PACT-034](phase-1-rules.md#pact-034), [PACT-035](phase-1-rules.md#pact-035), [PACT-036](phase-1-rules.md#pact-036), [PACT-037](phase-1-rules.md#pact-037), [PACT-038](phase-1-rules.md#pact-038), [PACT-039](phase-1-rules.md#pact-039), [PACT-040](phase-1-rules.md#pact-040), [PACT-041](phase-1-rules.md#pact-041), [PACT-042](phase-1-rules.md#pact-042), [PACT-043](phase-1-rules.md#pact-043), [PACT-044](phase-1-rules.md#pact-044), [PACT-045](phase-1-rules.md#pact-045), [PACT-046](phase-1-rules.md#pact-046), [PACT-047](phase-1-rules.md#pact-047), [PACT-048](phase-1-rules.md#pact-048), [PACT-049](phase-1-rules.md#pact-049), [PACT-050](phase-1-rules.md#pact-050), [PACT-051](phase-1-rules.md#pact-051), [PACT-052](phase-1-rules.md#pact-052), [PACT-096](phase-1-rules.md#pact-096)

**Components:** rules release gate.

**Specification:** [delivery](../pact/delivery.md) · **Release checks:** R01, R02, R03, R04, R05, R06, R07, R08

**Implement / deliver**

- Collect the playable prototype revision, rules-catalog version, command schemas, replay fixtures, invariant results, and script comparison.
- Review the eight rules acceptance checks without treating design arithmetic as implemented tests.

**Acceptance**

- [ ] R01–R08 pass against the committed implementation, recovery environment, and independent non-game reuse fixture.
- [ ] The release record lists precise reproduction commands and evidence; no unresolved ledger or identity corruption is carried into the social slice.
