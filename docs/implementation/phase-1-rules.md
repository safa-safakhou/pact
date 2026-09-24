# Phase 1 — Transactional rules prototype

**27 tickets · 21 completed.** [Backlog overview](README.md) · [Machine-readable tickets](tasks.json)

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

**Status:** done · **Role:** Rules · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-030](phase-1-rules.md#pact-030), [PACT-031](phase-1-rules.md#pact-031)

**Components:** building rules and queues.

**Specification:** [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R01, R02, R04

**Implement / deliver**

- Implement unlock/prerequisite validation, target-level costs, two active slots, one waiting instruction per slot, exact completion times, and 50% active cancellation refunds.
- Preserve paid-resource provenance and call the authority reservation interface on queue/start/cancel; final economic integration is verified in PACT-039.

**Acceptance**

- [x] Hall and dependent upgrades reach every specified level without illegal bypass; the same building cannot occupy both slots.
- [x] Waiting starts in slot order only when funded/authorized; completion or cancellation retries never duplicate level gains, refunds, or spending.

**Assignee:** codex-rules-foundation

**Evidence**

- docs/implementation/reports/building-queues.md — 2026-09-23: 35 legal level-I–VI upgrades, two active/one waiting per slot, ordered funded/authorized starts, provenance refunds, retry/rollback checks. Node 24 npm run build, typecheck, test (90), test:integration (55), lint passed against PostgreSQL 17.

<a id="pact-033"></a>
## PACT-033 — Implement troop identity, training, placement, and capacity

**Status:** done · **Role:** Rules · **Size:** L · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-028](phase-1-rules.md#pact-028), [PACT-030](phase-1-rules.md#pact-030), [PACT-031](phase-1-rules.md#pact-031)

**Components:** unit inventory and training.

**Specification:** [rules](../pact/rules.md) · **Release checks:** R01, R03

**Implement / deliver**

- Add immutable unit IDs and owner/type/Home-Guard/placement fields; implement one training queue, batches up to 40, reserved costs/slots, completion, cancellation, and disbanding.
- Create commitment and battle-eligibility interfaces that reference existing units rather than copy inventories.

**Acceptance**

- [x] Simultaneous training/assignment cannot overfill owned or visiting pools or reuse a unit in exclusive placements.
- [x] Home Guard cannot raid/scout/lend/refund, but can disband for zero; partial training cancellation refunds only uncompleted reserved costs.

**Assignee:** codex-rules-foundation

**Evidence**

- docs/implementation/reports/troop-training.md — 2026-09-23: ordinary-paid sequential batches, immutable UUIDv7 units, capacity/placement locks, Home Guard restrictions, 80% partial cancellation, battle-ID snapshots. Node 24 npm run build, typecheck, test (90), test:integration (60), lint passed against PostgreSQL 17.

<a id="pact-034"></a>
## PACT-034 — Implement upkeep, hunger recovery, and desertion

**Status:** done · **Role:** Rules · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-029](phase-1-rules.md#pact-029), [PACT-030](phase-1-rules.md#pact-030), [PACT-033](phase-1-rules.md#pact-033)

**Components:** upkeep and attrition.

**Specification:** [rules](../pact/rules.md) · **Release checks:** R02, R03

**Implement / deliver**

- Implement food responsibility by current placement, ordinary-before-allowance spending, Hungry state, funded-minute recovery, shortage warning, and desertion schedule.
- Group desertion by food payer/original owner across formations, use fixed type/ID allocation, and emit hooks for host garrison default.

**Acceptance**

- [x] Recovery requires 60 consecutive funded minutes; first desertion is minute 180, then each additional underfunded hour.
- [x] Splitting units across contracts or display stacks changes no losses; operational locks do not create starvation immunity.

**Assignee:** Mohammad Safakhou

**Evidence**

- 23 Sep 2026: docs/implementation/reports/upkeep.md; npm run build, npm run typecheck, npm test (92 passed), npm run test:integration (63 passed), npm run lint all passed locally with PostgreSQL 17. Host default settlement remains PACT-040.

<a id="pact-035"></a>
## PACT-035 — Implement kingdom-wide charges and action limits

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-029](phase-1-rules.md#pact-029), [PACT-031](phase-1-rules.md#pact-031)

**Components:** limits and charges.

**Specification:** [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R02, R04

**Implement / deliver**

- Implement full starting raid/scout pools, serial regeneration clocks, successful-action rolling windows, and shared human/agent/client counters.
- Separate receipt/security-control abuse limits from gameplay reads; expose exact next-regeneration and retry timestamps.

**Acceptance**

- [x] Spend from full starts the timer; further spends do not reset it; capped pools bank no extra time.
- [x] Provider/client swaps and retries cannot refill charges or bypass quotas; rejected/idempotent commands incur no additional fee or successful-action count.

**Assignee:** Mohammad Safakhou

**Evidence**

- 23 Sep 2026: docs/implementation/reports/action-limits.md; npm run build, npm run typecheck, npm test (92 passed), npm run test:integration (65 passed), npm run lint passed locally with PostgreSQL 17. Gameplay handler integration remains with later tickets.

<a id="pact-036"></a>
## PACT-036 — Implement contacts, bounded messages, and direct transfers

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-022](phase-0-connections.md#pact-022), [PACT-027](phase-0-connections.md#pact-027), [PACT-030](phase-1-rules.md#pact-030), [PACT-031](phase-1-rules.md#pact-031), [PACT-035](phase-1-rules.md#pact-035)

**Components:** contacts, messages, transfers.

**Specification:** [rules](../pact/rules.md), [social](../pact/social.md), [runtime](../pact/runtime.md) · **Release checks:** R01, R04

**Implement / deliver**

- Implement accepted contacts, cold request fee/expiry/capacity, bounded private threads, unread counters, message limits, and minimal block/mute state.
- Implement one-off ordinary-resource transfers with recipient overflow, accepted-contact checks, shared limits, and direct-contact invitations for controlled tests.

**Acceptance**

- [x] Full queues reject before charging; blocked pairs cannot send text, new offers, or gifts in either direction.
- [x] A transfer charges once and never guarantees a return payment; notification traffic does not consume player-message allowance.

**Assignee:** Mohammad Safakhou

**Evidence**

- 23 Sep 2026: docs/implementation/reports/social.md; npm run build, npm run typecheck, npm test (92 passed), npm run test:integration (70 passed), npm run lint passed locally with PostgreSQL 17. Later gameplay handlers expose these transaction-bound ports.

<a id="pact-037"></a>
## PACT-037 — Implement supply offers, signatures, bonds, and contract activation

**Status:** done · **Role:** Rules · **Size:** L · **Type:** implementation

**Depends on:** [PACT-019](phase-0-connections.md#pact-019), [PACT-027](phase-0-connections.md#pact-027), [PACT-030](phase-1-rules.md#pact-030), [PACT-035](phase-1-rules.md#pact-035), [PACT-036](phase-1-rules.md#pact-036)

**Components:** supply offers and signatures.

**Specification:** [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R01, R04

**Implement / deliver**

- Build typed offer versions, exact signatures, allowed durations/notices/rates, expiries, incoming/outgoing slot limits, bonds, and atomic activation.
- Wire provisional authority reservation hooks on signature, invalidation, activation, and withdrawal; settlement is PACT-038 and complete exposure integration is PACT-039.

**Acceptance**

- [x] A counteroffer invalidates old signatures; simultaneous acceptances cannot duplicate a contract or exceed bond/contract capacity.
- [x] Half-funded bonds, zero/zero flows, invalid notice, self-contracts, expired offers, and blocked parties fail without partial activation.

**Assignee:** Mohammad Safakhou

**Evidence**

- 23 Sep 2026: docs/implementation/reports/supply-offers.md; npm run build, npm run typecheck, npm test (92 passed), npm run test:integration (76 passed), npm run lint passed locally with PostgreSQL 17. Delivery/default settlement remains PACT-038; production agent exposure adapter remains PACT-039.

<a id="pact-038"></a>
## PACT-038 — Implement independent contract delivery and default settlement

**Status:** done · **Role:** Rules · **Size:** L · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-029](phase-1-rules.md#pact-029), [PACT-030](phase-1-rules.md#pact-030), [PACT-034](phase-1-rules.md#pact-034), [PACT-037](phase-1-rules.md#pact-037)

**Components:** contract settlement and bonds.

**Specification:** [rules](../pact/rules.md) · **Release checks:** R01, R02

**Implement / deliver**

- Implement pre-delivery snapshots, reserve-constrained available balances, proportional allocation with contract-ID remainder order, later incoming credits, and all termination/bond states.
- Settle notice, mutual release, natural expiry, one-sided default, and simultaneous default in the specified tick phases.

**Acceptance**

- [x] A six-hour contract produces exactly 360 installments; incoming funds cannot finance another outgoing obligation in the same tick.
- [x] Partial delivery defaults correctly without reversing an already-funded counterparty; both-default bond transfer, overflow, floor changes, and grant expiry match the rulebook.

**Assignee:** Mohammad Safakhou

**Evidence**

- 23 Sep 2026: docs/implementation/reports/supply-settlement.md; Node 24 build/typecheck/lint, npm test (92 passed), npm run test:integration (84 passed) on local PostgreSQL test schemas. Six-hour delivery, independent funding, proportional shortage, floor/grant changes, all close/bond states and overflow covered. Uncommitted; no VPS deployment or live player validation.

<a id="pact-039"></a>
## PACT-039 — Complete future exposure accounting and human exceptions

**Status:** done · **Role:** Backend · **Size:** L · **Type:** implementation

**Depends on:** [PACT-019](phase-0-connections.md#pact-019), [PACT-020](phase-0-connections.md#pact-020), [PACT-027](phase-0-connections.md#pact-027), [PACT-032](phase-1-rules.md#pact-032), [PACT-037](phase-1-rules.md#pact-037), [PACT-038](phase-1-rules.md#pact-038)

**Components:** authority exposure ledger.

**Specification:** [runtime](../pact/runtime.md), [rules](../pact/rules.md) · **Release checks:** R04

**Implement / deliver**

- Integrate the authorization ledger across signed future flows, bonds, queued construction, immediate costs, troop limits, and visiting-upkeep reservations.
- Move actual outgoing amounts from reserved to spent; release unused exposure on every terminal path; retain exact human-permit commitments separately.

**Acceptance**

- [x] Two concurrent signatures cannot each reserve the last allowance; switching providers never creates a second ledger.
- [x] Refunds/incoming trades do not replenish spent authority; canceled offers release once; lowered mandates and approved exceptions follow the specified existing-commitment behavior.

**Assignee:** Mohammad Safakhou

**Evidence**

- 24 Sep 2026: docs/implementation/reports/future-exposure.md; transaction-bound future exposure, exact human-session/OAuth permits, and real supply-signature consumption passed local Node 24/PostgreSQL 17 npm run build, npm run typecheck, npm test (97), npm run test:integration (99), and npm run lint. Public gameplay command/approval routing is PACT-049; garrison lifecycle is PACT-040. Uncommitted workspace.

<a id="pact-040"></a>
## PACT-040 — Implement garrison contracts, recall, return, and seizure

**Status:** done · **Role:** Rules · **Size:** L · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-033](phase-1-rules.md#pact-033), [PACT-034](phase-1-rules.md#pact-034), [PACT-037](phase-1-rules.md#pact-037), [PACT-039](phase-1-rules.md#pact-039)

**Components:** garrison rules.

**Specification:** [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R01, R03, R04

**Implement / deliver**

- Implement Hall-III lending, host acceptance, garrison bonds/slots, immediate placement, host feeding, durations, expiry/recall/return/default, and explicit human-approved seizure.
- Use a shared battle-lock interface; queue exits behind existing locks and exclude them from new locks. Integrate final overlapping-battle behavior in PACT-044.

**Acceptance**

- [x] Owner and host capacity remain consistent through return/death/seizure; seized units keep IDs and transfer wealth once.
- [x] Underfunded host default and pending return do not extend upkeep exposure beyond the prescribed lock allowance; seizure cannot bypass a lock or human approval.

**Assignee:** Mohammad Safakhou

**Evidence**

- 24 Sep 2026: docs/implementation/reports/garrison.md; uncommitted transaction-bound garrison offers, bonds, visiting upkeep, default/return, mutual release, and exact human-permitted seizure. Node 24/PostgreSQL 17 local npm run build, npm run typecheck, npm test (97), npm run test:integration (103), and npm run lint passed. PACT-044 handles final overlapping combat, PACT-048 computes Fortune from ownership, and PACT-049 supplies public commands. No hosted deployment or external certification.

<a id="pact-041"></a>
## PACT-041 — Implement scouting and private observation reports

**Status:** done · **Role:** Rules · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-029](phase-1-rules.md#pact-029), [PACT-033](phase-1-rules.md#pact-033), [PACT-035](phase-1-rules.md#pact-035), [PACT-039](phase-1-rules.md#pact-039)

**Components:** scout rules and reports.

**Specification:** [rules](../pact/rules.md), [social](../pact/social.md) · **Release checks:** R02, R03, R04

**Implement / deliver**

- Implement charge/ordinary-resource costs, two-Spearman commitment, ten-minute completion, target notice, and report visibility.
- Sample bands and exact wall from post-battle state when deadlines coincide; timestamp reports and expose shareable report records without unrelated private data.

**Acceptance**

- [x] Home Guard, locked units, self-targets, and insufficient resources cannot start a scout; retries never charge twice.
- [x] Band boundary/fractional-stock fixtures pass and no visiting-owner names, private contracts, or offsite troops leak into the report.

**Assignee:** Mohammad Safakhou

**Evidence**

- 24 Sep 2026: docs/implementation/reports/scouting.md; uncommitted timed scout admission/completion, one-charge/ordinary-stock atomic spend, agent troop authority, target notice, post-phase private report bands, explicit sharing, export/retention. Local Node 24/PostgreSQL 17 npm run build, npm run typecheck, npm test, npm run test:integration (106), and npm run lint passed. PACT-044 integrates actual overlapping combat; PACT-049 adds public command routes. No hosted deployment.

<a id="pact-042"></a>
## PACT-042 — Implement raid seed commitments and deterministic dice

**Status:** done · **Role:** Security · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-028](phase-1-rules.md#pact-028)

**Components:** randomness and verification.

**Specification:** [social](../pact/social.md), [rules](../pact/rules.md) · **Release checks:** R05

**Implement / deliver**

- Implement CSPRNG seeds, encrypted storage, RFC-8785 commitment payloads, HMAC rejection-sampling dice, reveal-on-resolution/cancellation, and seed-access audit.
- Publish a small verification routine and the specification’s fixed fixture; keep cryptographic and game-power calculations separate.

**Acceptance**

- [x] The reference seed yields the published commitment and attacker 6 / defender 1.
- [x] Rejection of byte values 252–255, modified seed/raid/version, and pre-resolution read attempts are tested; canceled raids reveal the original seed.

**Assignee:** Mohammad Safakhou

**Evidence**

- 23 Sep 2026: docs/implementation/reports/raid-randomness-combat.md; encrypted seed migration, exact fixture/verifier, access-audited terminal reveal. Local Node 24/PostgreSQL 17 npm run build, npm run typecheck, npm test (97), npm run test:integration (98), npm run lint, and verifier fixture passed; uncommitted workspace.

<a id="pact-043"></a>
## PACT-043 — Implement pure combat, casualties, and loot calculations

**Status:** done · **Role:** Rules · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-028](phase-1-rules.md#pact-028), [PACT-033](phase-1-rules.md#pact-033)

**Components:** pure combat calculator.

**Specification:** [rules](../pact/rules.md) · **Release checks:** R03, R05

**Implement / deliver**

- Build deterministic functions for counters, hunger, Ram wall suppression, dice multipliers, tie/zero branches, casualty grouping, type/ID selection, carrying capacity, and loot priorities.
- Return a complete typed calculation trace for entitled participants without reading live database state inside the calculator.

**Acceptance**

- [x] The worked battle loses 7 attackers and 14 defenders, carries 100 Silver and 44 Iron, and wins 26 of 36 die pairs.
- [x] Reordering/splitting formations preserves results; same-owner troops on opposite sides remain distinct groups; no-negative and zero-power properties pass.

**Assignee:** Mohammad Safakhou

**Evidence**

- 23 Sep 2026: docs/implementation/reports/raid-randomness-combat.md; exact pure calculator matches 7/14 losses, 100 Silver + 44 Iron, and 26/36 wins; formation, owner-side, tie/zero, and no-negative tests pass. Local Node 24/PostgreSQL 17 npm run build, npm run typecheck, npm test (97), npm run test:integration (98), npm run lint passed; uncommitted workspace.

<a id="pact-044"></a>
## PACT-044 — Implement raids, contributors, locks, and overlapping resolution

**Status:** done · **Role:** Rules · **Size:** L · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-029](phase-1-rules.md#pact-029), [PACT-033](phase-1-rules.md#pact-033), [PACT-034](phase-1-rules.md#pact-034), [PACT-035](phase-1-rules.md#pact-035), [PACT-039](phase-1-rules.md#pact-039), [PACT-040](phase-1-rules.md#pact-040), [PACT-042](phase-1-rules.md#pact-042), [PACT-043](phase-1-rules.md#pact-043)

**Components:** raid lifecycle and locks.

**Specification:** [rules](../pact/rules.md), [social](../pact/social.md) · **Release checks:** R02, R03, R05

**Implement / deliver**

- Implement declarations, exact deadlines, two nominated contributors, provisions, acceptance/withdrawal, final locks, and pinned wall/unit snapshots.
- Resolve raids in chronological/declaration order against surviving IDs, apply loot only to the leader, release pending returns, and retain participant/public report variants.

**Acceptance**

- [x] An earlier battle’s casualties are absent from every later resolution; no unit can fight from two placements or be duplicated as reinforcement.
- [x] Same-boundary completion/lock/withdrawal, hunger changes, leader cancellation, pinned visitors, last-second requests, and missing units resolve exactly once.

**Assignee:** Mohammad Safakhou

**Evidence**

- 24 Sep 2026: docs/implementation/reports/raids.md; uncommitted transaction-bound raid declarations, nominations/contributors, provisions and authority, seed commitments, T-5 pinned wall/unit locks, chronological overlapping combat, leader-only loot, pending returns, and audience-specific reports. Local Node 24/PostgreSQL 17 npm run build, npm run typecheck, npm test (99), npm run test:integration (111), npm run lint, and shell syntax checks passed. Docker Compose unavailable locally; no hosted deployment or player pilot.

<a id="pact-045"></a>
## PACT-045 — Build authorized world views and factual forecasts

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-022](phase-0-connections.md#pact-022), [PACT-027](phase-0-connections.md#pact-027), [PACT-032](phase-1-rules.md#pact-032), [PACT-038](phase-1-rules.md#pact-038), [PACT-040](phase-1-rules.md#pact-040), [PACT-041](phase-1-rules.md#pact-041), [PACT-044](phase-1-rules.md#pact-044)

**Components:** authorized state projections.

**Specification:** [rules](../pact/rules.md), [runtime](../pact/runtime.md), [product](../pact/product.md) · **Release checks:** R06

**Implement / deliver**

- Expose current kingdom/production/upkeep/builders/troops/contracts/threats, bounded records, and factual event summaries from committed state.
- Create separate owner, participant, contact, and public projections; show exact time, last committed version, and forecast assumptions.

**Acceptance**

- [x] Unauthorized IDs and public profiles never expose live stocks, building levels, commitments, or model instructions.
- [x] Forecasts label assumed future deliveries, preserve founding-versus-ordinary amounts, and change correctly after default, harvest shift, and overlapping combat.

**Assignee:** Mohammad Safakhou

**Evidence**

- 24 Sep 2026: docs/implementation/reports/world-views.md; uncommitted repeatable-read owner/participant/contact/public projections, bounded event references, current-version metadata, and explicitly conditional exact-unit forecasts. Local Node 24/PostgreSQL 17 npm run build, npm run typecheck, npm test (102), npm run test:integration (114), and npm run lint passed. After the final public-event summary change, kingdom build, targeted integration (3), and lint passed. No hosted deployment or player pilot.

<a id="pact-046"></a>
## PACT-046 — Implement Fortune accounting and provisional standings

**Status:** done · **Role:** Rules · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-030](phase-1-rules.md#pact-030), [PACT-032](phase-1-rules.md#pact-032), [PACT-033](phase-1-rules.md#pact-033), [PACT-038](phase-1-rules.md#pact-038), [PACT-040](phase-1-rules.md#pact-040), [PACT-044](phase-1-rules.md#pact-044)

**Components:** wealth accounting and rankings.

**Specification:** [rules](../pact/rules.md) · **Release checks:** R01

**Implement / deliver**

- Compute exact marked wealth from stock, reserved construction/training, ordinary installed value, owned bonds, and surviving owned troops; keep a season baseline and hourly snapshots.
- Add Hall-band filters and provisional ranking queries without awarding final seasonal prizes yet.

**Acceptance**

- [x] Build/train conversions preserve marked wealth; grants, Home Guard, expected income, borrowed units, and cosmetics never count.
- [x] Transfer, default, cancellation, loot, and seizure fixtures change the correct owner’s wealth once and allow negative Fortune.

**Assignee:** Mohammad Safakhou

**Evidence**

- 24 Sep 2026: docs/implementation/reports/fortune.md; uncommitted exact derived wealth, provisional overall/Hall-band standings, and idempotent game-hour snapshots. Local Node 24/PostgreSQL 17 npm run build, npm run typecheck, npm test (102), npm run test:integration (117), and npm run lint passed. No hosted deployment or season awards.

<a id="pact-047"></a>
## PACT-047 — Implement achievement triggers and earned cosmetic entitlements

**Status:** done · **Role:** Rules · **Size:** M · **Type:** implementation

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-032](phase-1-rules.md#pact-032), [PACT-038](phase-1-rules.md#pact-038), [PACT-041](phase-1-rules.md#pact-041), [PACT-044](phase-1-rules.md#pact-044), [PACT-046](phase-1-rules.md#pact-046)

**Components:** achievements and earned entitlements.

**Specification:** [rules](../pact/rules.md), [product](../pact/product.md) · **Release checks:** R01, L03

**Implement / deliver**

- Add event-driven, once-per-account achievement records, the eight exact triggers, and atomic grants of each ornament plus 25 earned Gems.
- Keep a separate cosmetic entitlement/wallet ledger; provide test event fixtures for future Seal and seasonal triggers without claiming those features are shipped.

**Acceptance**

- [x] Replayed events cannot award duplicate Gems or ornaments.
- [x] Achievements grant no resource/authority/production benefit; a private dev event injector is absent from public HTTP and MCP surfaces.

**Assignee:** Mohammad Safakhou

**Evidence**

- 24 Sep 2026: docs/implementation/reports/achievements.md; uncommitted private event-driven eight-trigger engine, once-only ornaments and +25 earned Gems, complete-week upkeep coverage, and no public injector. Local Node 24/PostgreSQL 17 npm run build, npm run typecheck, npm test (102), npm run test:integration (120), and npm run lint passed. Future Seal/season producer flows not claimed.

<a id="pact-048"></a>
## PACT-048 — Build the plain rules-prototype interface

**Status:** todo · **Role:** Frontend · **Size:** L · **Type:** implementation

**Depends on:** [PACT-023](phase-0-connections.md#pact-023), [PACT-027](phase-0-connections.md#pact-027), [PACT-045](phase-1-rules.md#pact-045), [PACT-046](phase-1-rules.md#pact-046), [PACT-047](phase-1-rules.md#pact-047), [PACT-049](phase-1-rules.md#pact-049)

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

**Status:** in_progress · **Role:** Integrations · **Size:** M · **Type:** implementation

**Depends on:** [PACT-017](phase-0-connections.md#pact-017), [PACT-021](phase-0-connections.md#pact-021), [PACT-027](phase-0-connections.md#pact-027), [PACT-039](phase-1-rules.md#pact-039), [PACT-045](phase-1-rules.md#pact-045)

**Components:** game tool registry, context assembly.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md), [rules](../pact/rules.md), [architecture](../pact/architecture.md) · **Release checks:** R04, R06

**Implement / deliver**

- Replace sandbox-only routing with all permitted typed game command groups, record reads, messages, receipts, and approvals.
- Implement bounded context selection and readable receipt summaries; preserve the same dispatch and authorization behavior in all adapters and MCP.

**Acceptance**

- [ ] A recorded scenario produces equivalent game commands/receipts from web, adapter, and MCP paths.
- [ ] Malicious counterpart text cannot change identity, tool scope, model connection, or mandate; no adapter receives hidden state through a convenience summary.
- [ ] Generated SDK, model-adapter, and MCP commands use the same product-scoped contracts and cannot gain first-party human privileges.

**Assignee:** Mohammad Safakhou

**Evidence**

- 24 Sep 2026: docs/implementation/reports/game-tools-progress.md records dependency correction, scoped HTTP/SDK/MCP world and authorized report reads, social/troop/building/supply/scout/garrison/raid commands including exact human seizure, 107 unit and 134 PostgreSQL integration tests, and remaining PACT-049 acceptance work. Revisions 7eccf06, 75224bf, d1457ed, and report-read increment. Not Done.

<a id="pact-050"></a>
## PACT-050 — Implement gameplay retirement and account-deletion settlement

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-024](phase-0-connections.md#pact-024), [PACT-027](phase-0-connections.md#pact-027), [PACT-038](phase-1-rules.md#pact-038), [PACT-040](phase-1-rules.md#pact-040), [PACT-041](phase-1-rules.md#pact-041), [PACT-044](phase-1-rules.md#pact-044), [PACT-046](phase-1-rules.md#pact-046)

**Components:** kingdom retirement.

**Specification:** [privacy](../pact/privacy.md), [rules](../pact/rules.md) · **Release checks:** R01, R03, R06

**Implement / deliver**

- Add closing/retired kingdom states, immediate access revocation, rejection of new commitments, supply defaults, pending unit returns, existing-engagement settlement, and final asset disposal.
- Decouple identifying-data erasure deadlines from frozen game time and preserve only permitted economic tombstones.

**Acceptance**

- [x] Deletion cannot cancel an already-declared enemy raid or redirect remaining wealth to a friend.
- [x] Both owners closing, locked visiting troops, a long world pause, and repeated retirement jobs settle once while personal data still meets real-time deletion deadlines.

**Assignee:** Mohammad Safakhou

**Evidence**

- 24 Sep 2026: docs/implementation/reports/retirement-progress.md records migration 0034, closing/retired settlement, real-time identity erasure, a real raid resolved after both owners close, long-pause/locked-unit/supply-default/retry checks, and 180-day tombstone pruning. Local build, typecheck, 104 unit, 128 integration, lint passed; uncommitted, no hosted/deployment claim.

<a id="pact-051"></a>
## PACT-051 — Run transaction, replay, and adversarial rules tests

**Status:** in_progress · **Role:** QA · **Size:** L · **Type:** verification

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-029](phase-1-rules.md#pact-029), [PACT-030](phase-1-rules.md#pact-030), [PACT-032](phase-1-rules.md#pact-032), [PACT-033](phase-1-rules.md#pact-033), [PACT-034](phase-1-rules.md#pact-034), [PACT-035](phase-1-rules.md#pact-035), [PACT-036](phase-1-rules.md#pact-036), [PACT-037](phase-1-rules.md#pact-037), [PACT-038](phase-1-rules.md#pact-038), [PACT-039](phase-1-rules.md#pact-039), [PACT-040](phase-1-rules.md#pact-040), [PACT-041](phase-1-rules.md#pact-041), [PACT-042](phase-1-rules.md#pact-042), [PACT-043](phase-1-rules.md#pact-043), [PACT-044](phase-1-rules.md#pact-044), [PACT-046](phase-1-rules.md#pact-046), [PACT-050](phase-1-rules.md#pact-050)

**Components:** rules property/recovery suites.

**Specification:** [delivery](../pact/delivery.md), [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R01, R02, R03, R04, R05, R06

**Implement / deliver**

- Build seeded/property-based economy scenarios, boundary-time fixtures, cross-account authorization tests, and fault injection around every durable command/tick transition.
- Rehearse backup restore and outbox replay; compare recomputed wealth and unit placement to the authoritative state after recovery.

**Acceptance**

- [ ] All R01–R06 assertions have reproducible passing evidence, including overlapping raids and multi-client authority races.
- [ ] No negative stock, duplicate troop, repeated reward, partially published tick, or lost committed receipt survives a generated scenario.

**Assignee:** Mohammad Safakhou

**Evidence**

- 24 Sep 2026: MNI-115 claimed In Progress by Mohammad Safakhou after all 18 dependencies were verified Done in Linear. docs/implementation/reports/rules-verification-progress.md records a passing 120-operation seeded rollback/replay/journal fixture, isolated schema dump/restore rehearsal, and a partial R01–R06 matrix. Broad cross-module fault injection remains, so not Done.

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
