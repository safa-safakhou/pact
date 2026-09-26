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
- 24 Sep 2026: revision ca94561 passes router-validated calls to an injected executor, fails closed without one, and checks the exact active run lease. docs/implementation/reports/game-tools-progress.md and docs/api/runs.md record the limits. Node 24 build/typecheck/unit (107)/PostgreSQL integration (137)/lint passed after formatting the earlier related fixture. Full model-dispatch route remains incomplete.
- 24 Sep 2026: revision e1401b3 adds a fake-provider game-command bridge using a generated game-only subset of pact.command.v1, deterministic run/request/call command IDs, server-derived agent identity, the shared dispatcher, and exact MCP-or-PACT-run lease checks. Forged human actor/human-only action, replay/conflict, and post-run denial pass in PostgreSQL. Node 24 build/typecheck, 108 unit, 139 integration, and lint pass. See docs/implementation/reports/game-tools-progress.md. Production worker composition/context/receipt handoff remain incomplete.
- 24 Sep 2026: input admission now estimates the actual assembled messages and tool definitions instead of a fixed 50 tokens; a low-budget PostgreSQL fixture verifies zero provider calls and no in-flight reservation. Node 24 build/typecheck, 108 unit, 141 PostgreSQL integration, and lint pass. See docs/api/runs.md and docs/implementation/reports/game-tools-progress.md. Context selection and production composition are still incomplete; keep In Progress.
- 24 Sep 2026: revision e116fb8 moved the PACT game handler into @pact/application and composed it into the inference worker with the generated game tool, shared world admission, exact run lease, and single-VPS raid seed. A PostgreSQL fake-provider fixture verifies a forged actor cannot replace the run owner and one durable command receipt is committed. Node 24 build/typecheck/lint, 108 unit, and 143 PostgreSQL integration tests pass. See docs/api/runs.md, docs/architecture/modules.md, docs/operations/vps-deployment.md, and docs/implementation/reports/game-tools-progress.md. Real provider credentials, durable tool-result handoff, bounded context, and cross-route certification remain; keep In Progress.
- 24 Sep 2026: revision 1ef8025 adds a run-owned migration that persists bounded server-generated tool receipt summaries atomically with successful step reconciliation, feeds the 16 latest into the next input reservation, exports them to the owner, and cascades deletion with the run. Two-step PostgreSQL fixture proves receipt handoff, retry nonduplication, and cascade; worker fixture proves no message body in summary. Node 24 build/typecheck/lint, 108 unit, and 144 PostgreSQL integration tests pass. See docs/api/runs.md, docs/api/privacy.md, docs/operations/database.md, and docs/implementation/reports/game-tools-progress.md. Real-provider wiring, broad authorized context, cross-route scenario, and actual worker-death recovery remain; keep In Progress.
- 24 Sep 2026: revision 014f4a9 gates network provider registration behind an explicit default-off operator flag and binds inference-only vault credential use to the owner and selected provider. Synthetic injected HTTP, cross-account/provider denial, and default-router tests pass. Node 24 build/typecheck/lint, 110 unit, 146 PostgreSQL integration tests pass; backlog/diff checks pass. See docs/api/runs.md, docs/operations/vps-deployment.md, and docs/implementation/reports/game-tools-progress.md. No live/paid call or deployment; context, cross-route certification, and recovery remain; keep In Progress.
- 24 Sep 2026: revision 70c8597 fails an unresolved model call conservatively on durable-job redelivery, releases its reservation/write lease, and prevents a second provider request. A paused synthetic-call fixture verifies late completion cannot restart the run. Node 24 build/typecheck/lint, 110 unit, 147 PostgreSQL integration tests pass; backlog/diff checks pass. See docs/api/runs.md and docs/implementation/reports/game-tools-progress.md. Actual worker kill and full PACT-049 acceptance remain; keep In Progress.
- 24 Sep 2026: revision 9dc4c46 records a message scenario through authenticated web client/HTTP, fake model adapter, and MCP using the same dispatcher. Three COMMITTED receipts have equal resource charges and server-derived sender; MCP lease conflicts with the active in-app run. The inference worker selects an 8 KiB owner-authorized world snapshot without hostile counterpart prose or another kingdom ID. Node 24 build/typecheck/lint, 110 unit, 149 PostgreSQL integration tests pass. See docs/api/runs.md and docs/implementation/reports/game-tools-progress.md. First Linear acceptance check is met; inbox context, broader route coverage, and other criteria remain; keep In Progress.
- 24 Sep 2026: owner-scoped inbox selector adds at most eight newest metadata records to Envoy user-role context, excluding every event payload. PostgreSQL fixture confirms hostile payloads and another account's event ID are absent. Node 24 build/typecheck/lint, 110 unit, 149 PostgreSQL integration, backlog render/check, and diff check pass. See docs/api/runs.md and docs/implementation/reports/game-tools-progress.md. Conversation reads, broader adversarial checks, and full acceptance remain; keep In Progress.
- 25 Sep 2026: shared pact_inbox_read_v1 schema now drives explicit owner-bound MCP and in-app model inbox reads through InboxService.readBounded. Payloads over 512 UTF-8 bytes are omitted; model result labels third-party prose untrusted. PostgreSQL fixture checks equivalent owner events, paging, cross-account exclusion, strict caller arguments, and read-only grant behavior. Node 24 build/typecheck/lint, 110 unit, 152 PostgreSQL integration tests pass. See docs/api/mcp.md, docs/api/runs.md, docs/api/privacy.md, and docs/implementation/reports/game-tools-progress.md. Other command/read groups and full adversarial acceptance remain; keep In Progress.
- 25 Sep 2026: shared world/report tool schemas now drive explicit in-app Envoy reads through the same domain-authorized projections as MCP/HTTP, with run-derived identity and bounded results. PostgreSQL fixture verifies owner/private versus outsider/public world view and private scout-report exclusion; unit fixtures verify truncation. Node 24 build/typecheck/lint, 112 unit, and 153 PostgreSQL integration tests pass. See docs/api/runs.md, docs/architecture/world-views.md, and docs/implementation/reports/game-tools-progress.md. Full command-route and adversarial acceptance remain; keep In Progress.
- 25 Sep 2026: shared pact_receipt_read_v1 and pact_approval_status_v1 schemas now provide owner-scoped model and MCP readback without human approval authority. Read-only MCP grants can inspect results but cannot list write tools. Cross-account and strict-argument PostgreSQL fixture passes. Local Node 24 build/typecheck/lint, 113 unit, and 154 integration tests pass. See docs/api/runs.md, docs/api/mcp.md, and docs/implementation/reports/game-tools-progress.md. PACT-049 remains In Progress pending full route/adversarial acceptance.
- 25 Sep 2026: inference command-result summaries now retain bounded recordVersions and committedEventIds, with explicit truncation and command-ID fallback. A fake-provider PostgreSQL supply-offer fixture verifies the forged actor cannot replace the run owner and the saved summary carries supply-offer version 1. Local Node 24 build/typecheck, 114 unit, and 155 PostgreSQL integration tests pass; see docs/api/runs.md and docs/implementation/reports/game-tools-progress.md. Full cross-route/adversarial acceptance remains; keep In Progress.
- 25 Sep 2026: shared pact_conversation_read_v1 uses a domain-owned owner-bound projection for read-only MCP and in-app fake-provider routes. At most five messages and 512 UTF-8 bytes per body are returned; model result is bounded with explicit truncation. PostgreSQL fixture checks equivalent owner data, outsider emptiness, strict argument/scope denial, and hostile prose only as user-role result data. Local Node 24 build/typecheck/lint, 115 unit, and 156 PostgreSQL integration tests pass. See docs/api/mcp.md, docs/api/runs.md, docs/api/privacy.md, and docs/implementation/reports/game-tools-progress.md. Run-start conversation selection and full acceptance remain; keep In Progress.
- 25 Sep 2026: in-app Envoy game.message.send now charges the run's default 12/max 24 message cap inside the command transaction; POST /v1/runs accepts maxMessages and owner run status exposes usedMessages. Failed send rolls back count, same-command replay does not recount, and a new over-cap send returns RATE_LIMITED. Local Node 24 build/typecheck/lint, 115 unit, and 157 PostgreSQL integration tests pass. See docs/api/runs.md and docs/implementation/reports/game-tools-progress.md. Conversation selection and full acceptance remain; keep In Progress.
- 25 Sep 2026: human-selected run-start conversation IDs are validated as owner-involved, unique, and within the default 6/max 12 cap before lease acquisition, persisted by migration 0035, and exposed in owner run status. Inference includes only bounded selected excerpts as untrusted user-role data; PostgreSQL fake-provider fixture verifies denial of unrelated, duplicate, and over-cap choices and exclusion of unselected prose. Local Node 24 build/typecheck/lint, 115 unit, and 158 integration tests pass. See docs/api/runs.md, docs/operations/database.md, and docs/implementation/reports/game-tools-progress.md. Broader PACT-049 acceptance remains; keep In Progress.
- 25 Sep 2026: in-app explicit conversation reads now reject owner-visible but unselected threads as NOT_FOUND, preventing a bypass of the human's selected-thread cap; a separate MCP world:read grant retains independent owner-bound access. A second cross-route scenario produces version-1 supply offers and equal COMMITTED/empty-charge receipts through web, fake-provider, and MCP, with server-owned proposer despite forged account fields. Local Node 24 build/typecheck/lint, 115 unit, and 159 PostgreSQL integration tests pass. See docs/api/runs.md and docs/implementation/reports/game-tools-progress.md. Full adversarial/route acceptance remains; keep In Progress.
- 25 Sep 2026: PACT-021 regression correction now rejects HTTP or internal run starts above 15 minutes, 20 calls, or 40,000 tokens, as well as invalid conversation/message limits, before lease/job creation. Local Node 24 build/typecheck/lint, 115 unit, and 160 PostgreSQL integration tests pass. See docs/api/runs.md and docs/implementation/reports/game-tools-progress.md. Full PACT-049 game-tool acceptance remains; keep In Progress.
- 25 Sep 2026: a selected-thread adversarial fake-provider fixture receives hostile counterpart prose as user-role data, then attempts a forged-account Silver transfer and human-only contact request. Neither commits; the run's owner/provider/model stay bound and no transfer, mandate, or contact request is created. Node 24 build/typecheck/lint, 115 unit, and 161 PostgreSQL integration tests pass. See docs/implementation/reports/game-tools-progress.md. This is one server-boundary fixture, not live-model certification or complete acceptance; keep In Progress.
- 25 Sep 2026: a separate inference process is killed after the production-composed game dispatcher commits a fake-provider message but before model-step reconciliation. Replacement claim observes one owner-authored message and receipt, one outgoing-message charge, ambiguous run failure, and no second provider call or invented result. Node 24 build/typecheck/lint, 115 unit, and 162 PostgreSQL integration tests pass. See docs/api/runs.md and docs/implementation/reports/game-tools-progress.md. Other command-group/adversarial acceptance remains; keep In Progress.
- 25 Sep 2026: fixed the blanket agent cold-contact denial to match the execution contract. A contact.request mandate action, sufficient Silver allowance, optional current mandateVersion, and a live run lease now admit the two-Silver request atomically with stock/action/receipt/outbox effects. Fake-provider and MCP fixtures commit one owner-derived request each; MCP replay is idempotent, stale/over-budget attempts leave no third effect, and contact answer remains human-only. Node 24 build/typecheck/lint, 115 unit, and 163 PostgreSQL integration tests pass. See docs/architecture/social.md, docs/api/mcp.md, and docs/implementation/reports/game-tools-progress.md. Remaining PACT-049 acceptance stays In Progress.
- 25 Sep 2026: one recipient human-only contact-answer scenario now denies forged-human fake-model and MCP agent actions, then commits via authenticated web SDK and returns the same receipt on retry. The request remains pending until the human action and creates one accepted contact pair. Local Node 24 build/typecheck/lint, 115 unit, and 164 PostgreSQL integration tests pass. An audit found ApprovalService.createRequest has no production caller, so blocked proposals still lack an approval request/deep link; see docs/implementation/reports/game-tools-progress.md. Keep PACT-049 In Progress.
- 25 Sep 2026: ApprovalService.createRequest now rejects mismatched product/account ownership and changed terms or cross-account reuse of an existing command ID. A PostgreSQL fixture verifies exact replay and both denial cases. Local Node 24 build/typecheck/lint, 115 unit, and 164 integration tests pass. See docs/api/approvals.md and docs/implementation/reports/game-tools-progress.md. This hardens the primitive but does not wire an agent proposal route; PACT-049 remains In Progress.
- 25 Sep 2026: pact_approval_propose_v1 now creates exact cold-contact review requests from a lease-bound fake-model run and MCP game:act session, with server-derived owner/effects, atomic pending approval plus owner inbox/outbox event, HTTPS MCP deep link, and no game debit before human approval. Same-ID replay, changed terms, missing lease, read-only grant, human-only action denial, human-authenticated HTTP commit/duplicate POST, and JSONB-stable action hashing pass. Local Node 24 build/typecheck/lint, 115 unit, and 166 PostgreSQL integration tests pass. See docs/api/approvals.md, docs/api/mcp.md, docs/api/runs.md, and docs/implementation/reports/game-tools-progress.md. Other command-group proposals and full adversarial acceptance remain; keep PACT-049 In Progress.
- 25 Sep 2026: pact_approval_propose_v1 additionally accepts an exact direct transfer. A PostgreSQL fixture verifies no Iron movement before owner approval, changed-amount and outsider denial, one 1,200-unit sender debit/recipient credit and transfer record, and receipt-stable duplicate approval. Local Node 24 build/typecheck/lint, 115 unit, and 167 PostgreSQL 17 integration tests pass. See docs/api/approvals.md and docs/implementation/reports/game-tools-progress.md. Other actions and full acceptance remain; keep PACT-049 In Progress.
- 25 Sep 2026: exact two-Iron approval proposal now also passes through the actual MCP game:act tool after run.open and replays through the same approval service. Local Node 24 build/typecheck/lint, 115 unit and 167 PostgreSQL 17 integration tests pass; see docs/implementation/reports/game-tools-progress.md. Full PACT-049 route/adversarial acceptance remains; keep In Progress.
- 25 Sep 2026: approval resolution now holds the request lock through exact command dispatch and resolution, preventing concurrent rejection from overriding a committed command. Expired approve/reject updates commit before EXPIRED returns. PostgreSQL race fixture verifies duplicate approval receipt, denied concurrent rejection, one command receipt, and one approved inbox/outbox event. Local Node 24 build/typecheck/lint, 115 unit and 168 PostgreSQL 17 integration tests pass. See docs/api/approvals.md and docs/implementation/reports/game-tools-progress.md. Full PACT-049 acceptance remains; keep In Progress.
- 25 Sep 2026: pact_approval_propose_v1 tool description now accurately names both cold-contact and direct-transfer proposals, matching its shared JSON schema in model and MCP listings. Local Node 24 build/typecheck/lint, 115 unit and 169 PostgreSQL 17 integration tests pass. See docs/implementation/reports/game-tools-progress.md. Remaining action groups and full PACT-049 acceptance stay In Progress.
- 25 Sep 2026: exact game.training.queue proposals now share the model/MCP schema and lease-bound approval service. PACT application derives Iron/Silver review effects from the unit catalog. PostgreSQL fixture proves no early training, missing-lease/changed-term/outsider denial, one human commit and stable replay. Node 24 build/typecheck/lint, 115 unit and 170 PostgreSQL 17 integration tests pass; backlog/diff checks pass. See docs/api/approvals.md and docs/implementation/reports/game-tools-progress.md. Other action groups and full acceptance remain; keep In Progress.
- 26 Sep 2026: exact game.building.queue proposals now share the model/MCP schema and lease-bound approval service. PACT application quotes catalog price and explains founding allowance and waiting state; human commit uses the existing exact one-use session permit. PostgreSQL fixture proves no early instruction/permit, changed-slot rejection, failed admission without live human session, one active instruction/consumed permit, and stable replay. Node 24 build/typecheck/lint, 115 unit and 171 PostgreSQL 17 integration tests pass. See docs/api/approvals.md and docs/implementation/reports/game-tools-progress.md. Broader route and approval acceptance remain; keep In Progress.
- 26 Sep 2026: exact game.scout.start proposals now use the shared model/MCP schema and lease-bound approval service, rendering catalog fees, duration, charge, and selected troops. PostgreSQL fixture proves no early scout or troop movement, changed-ID/outsider denial, exact human commit with 10 Silver/5 Grain charge, and stable replay. Node 24 build/typecheck/lint, 115 unit and 172 PostgreSQL 17 integration tests pass. See docs/api/approvals.md and docs/implementation/reports/game-tools-progress.md. Full route/adversarial acceptance remains; keep In Progress.

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

- 24 Sep 2026: MNI-115 remains In Progress. Revisions 7eccf06, 804198c, b38c5f5. docs/implementation/reports/rules-verification-progress.md records a passing 120-operation seeded rollback/replay/journal fixture, isolated schema dump/restore rehearsal, simultaneous cross-account supply signatures with same-ID receipt recovery, and a revocation-first agent transfer race with no stock or receipt effect. Node 24 typecheck/lint and 138 PostgreSQL integration tests passed. The R01–R06 matrix remains partial; broad cross-module fault injection is not Done.
- 24 Sep 2026: revision f7febfc injects a deterministic failure after a fake-provider game command commits but before run reconciliation; one recoverable receipt/message remains, the run fails conservatively, and a repeated model step is not invoked. Node 24 lint and 140 PostgreSQL integration tests passed. See docs/implementation/reports/rules-verification-progress.md. This is one R06 interleaving, not complete process-death, transition, or VPS recovery evidence.
- 24 Sep 2026: overlapping-raid resolution fixture injects a pre-commit failure after two battles and verifies unchanged troop placement, stock, locked raids, and zero resolution events; retry commits two reports/events exactly once. Node 24 build/typecheck/lint, 108 unit, and 142 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. R01–R06 matrix and full VPS recovery remain incomplete; keep In Progress.
- 24 Sep 2026: revision 1ef8025 adds R06 run-tool handoff fixtures proving one persisted receipt summary reaches the next provider step, finished-run replay does not duplicate it, and run deletion cascades it; a shared worker fixture proves the summary omits message prose. Node 24 build/typecheck/lint, 108 unit, and 144 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Actual worker-death recovery and full R01–R06 matrix remain incomplete; keep In Progress.
- 24 Sep 2026: revision 014f4a9 adds R06 credential-boundary fixtures: owner/provider-bound vault use, one bounded synthetic adapter response without network, and wrong-provider denial before transport. Node 24 build/typecheck/lint, 110 unit, 146 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Full R01–R06 matrix, process death, and VPS base/WAL restore remain; keep In Progress.
- 24 Sep 2026: revision 70c8597 adds a deterministic R06 redelivery fixture: an unresolved model call becomes failed/ambiguous, reservation and lease clear, late completion does not restart, and no second provider request occurs. Node 24 build/typecheck/lint, 110 unit, 147 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Actual worker kill, full R01–R06 matrix, and VPS restore remain; keep In Progress.
- 24 Sep 2026: revision 9dc4c46 adds an R04/R06 cross-route scenario with authenticated web, fake model, and MCP. MCP write-lease acquisition fails during the in-app run and succeeds after completion; all three message receipts are sender-owned. Node 24 build/typecheck/lint, 110 unit, 149 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. This is one interleaving, not full R01–R06, actual process kill, or VPS restore; keep In Progress.
- 24 Sep 2026: a separate Node ledger writer killed with SIGKILL before COMMIT leaves no stock movement; killed after COMMIT leaves exactly one durable movement and an idempotent replay. The isolated game-command fixture also avoids a real-minute rollover during the full suite. Node 24 build/typecheck/lint, 110 unit, 150 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Inference-worker death, full base/WAL restore, and full R01–R06 remain; keep In Progress.
- 25 Sep 2026: tests/integration/run-process-death.test.ts kills a separate inference executor after durable job claim and in-flight model reservation, then reclaims the expired job and runs conservative recovery. It observes ambiguous failure, zero reservation, released write lease, completed job, no second provider request or tool result. Node 24 build/typecheck/lint, 110 unit, 151 PostgreSQL integration tests pass. See docs/api/runs.md, docs/architecture/rules-verification.md, and docs/implementation/reports/rules-verification-progress.md. Production binary restart, death after game-command commit, full base/WAL restore, and full R01–R06 remain; keep In Progress.
- 25 Sep 2026: PACT-049 inbox-read fixture adds partial R06 cross-account evidence: fake-model and read-only MCP return only owner event IDs, reject caller accountId, and omit oversized payload. Node 24 build/typecheck/lint, 110 unit, 152 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Generated cross-account and full restore matrix remain; keep In Progress.
- 25 Sep 2026: PACT-049 world/report read fixture adds R04/R06 cross-account evidence: owner model result contains balances and a completed scout report, outsider model result has public-only view and NOT_FOUND for private report; MCP rejects supplied accountId. Unit fixtures check bounded truncation. Node 24 build/typecheck/lint, 112 unit, 153 PostgreSQL integration tests pass. See docs/implementation/reports/rules-verification-progress.md. Generated cross-module and full restore matrix remain; keep In Progress.
- 25 Sep 2026: additional R04/R06 owner-scoped receipt and approval-status model/MCP reads reject outsider and caller-supplied owner IDs. A fixed-clock retirement fixture now aligns synthetic ledger/closure timestamps so 180-day retention checks remain reproducible. Local Node 24 build/typecheck/lint, 113 unit, and 154 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Full generated transition and VPS recovery matrix remain; keep In Progress.
- 25 Sep 2026: fake-provider versioned supply-offer fixture retries a finished run and observes exactly one offer, command receipt, and run-tool result with version 1; forged model actor cannot change proposer. Local Node 24 build/typecheck/lint, 114 unit, and 155 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Full generated transition and VPS base/WAL restore remain; keep In Progress.
- 25 Sep 2026: PACT-049 conversation-read fixture adds bounded R04/R06 cross-account evidence: model and read-only MCP see only owner-involved direct messages, reject caller account ID/excess limit/no scope, and keep hostile prose in user-role data. Local Node 24 build/typecheck/lint, 115 unit, and 156 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Full generated matrix and VPS base/WAL restore remain; keep In Progress.
- 25 Sep 2026: R06 in-app message-allowance fixture verifies failed noncontact send rolls back its run counter, successful send commits one count, same-command replay does not recount, and a second new send hits RATE_LIMITED. Local Node 24 build/typecheck/lint, 115 unit, and 157 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Full generated transitions and VPS base/WAL restore remain; keep In Progress.
- 25 Sep 2026: R04 run-context admission fixture rejects unrelated, duplicate, and over-cap conversation selections before a run lease; a valid persisted selection sends only owner-involved excerpts to the fake provider, with hostile prose outside the system role. Local Node 24 build/typecheck/lint, 115 unit, and 158 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Full generated matrix and VPS base/WAL restore remain; keep In Progress.
- 25 Sep 2026: R04/R06 fixture denies an in-app conversation read outside the human's selected set without exposing its prose to the next model step, while a separate owner MCP grant reads it; another fixture compares version-1 supply offers and receipts across web, model, and MCP with server-derived owner. Local Node 24 build/typecheck/lint, 115 unit, and 159 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Generated all-transition matrix and VPS base/WAL restore remain; keep In Progress.
- 25 Sep 2026: R06 run-ceiling fixture rejects over-budget and invalid numeric starts without a run, write lease, or inference job; exact Version 1 maxima still start. An R02/R06 world-clock ordering fixture now waits on PostgreSQL's due timestamp instead of a host timer after a first full-suite run observed not_due; focused clock and rerun of all 160 integration tests pass. Local Node 24 build/typecheck/lint and 115 unit tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Generated transitions and VPS base/WAL restore remain; keep In Progress.
- 25 Sep 2026: one R04 selected-thread adversarial fixture injects hostile counterpart prose and confirms forged-account transfer and human-only contact attempts leave no committed effect or authority change. Node 24 build/typecheck/lint, 115 unit, and 161 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Generated all-command authority and VPS restore evidence remain; keep In Progress.
- 25 Sep 2026: R06 local SIGKILL fixture now covers inference death after a committed game message but before tool-result reconciliation. The replacement claimant retains one command receipt/message and charged allowance, fails the run ambiguously, and does not invoke the provider again. Node 24 build/typecheck/lint, 115 unit, and 162 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Other transition fault injection and full VPS base/WAL restore remain; keep In Progress.
- 25 Sep 2026: R04/R06 mandated cold-contact fixture sends requests through fake-provider and MCP routes. Exactly two Silver authority and stock debits accompany each committed request; exact MCP replay does not duplicate them, and stale-version/allowance-exhausted attempts leave no third request, authority spend, stock debit, or action count. Agent contact answer is FORBIDDEN. Node 24 build/typecheck/lint, 115 unit, and 163 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Generated all-command transitions and full VPS recovery remain; keep In Progress.
- 25 Sep 2026: R04/R06 contact-answer fixture denies forged-human fake-model and MCP agent calls without mutating the request, then an authenticated human web SDK call accepts it and exact retry returns one receipt/contact pair. Local Node 24 build/typecheck/lint, 115 unit, and 164 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. All-command generated fault matrix and full VPS base/WAL restore remain; keep PACT-051 In Progress.
- 25 Sep 2026: R04/R06 lease-bound cold-contact proposal fixture keeps game stock/contact state untouched until human approval; MCP replay creates one request/inbox event, changed terms, missing lease, read-only scope, and human-only action fail. Authenticated human HTTP approval commits once and duplicate POST returns the original receipt; a paused-world noncommitting receipt leaves approval pending. Local Node 24 build/typecheck/lint, 115 unit, and 166 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Generated all-command fault matrix and full VPS base/WAL restore remain; keep PACT-051 In Progress.
- 25 Sep 2026: R04/R06 exact transfer proposal fixture leaves sender stock unchanged until owner approval, denies changed amount and outsider approval, and commits one 1,200-unit transfer with duplicate approval returning the original receipt. Local Node 24 build/typecheck/lint, 115 unit, and 167 PostgreSQL 17 integration tests pass. See docs/implementation/reports/rules-verification-progress.md. Generated all-command matrix and VPS base/WAL restore remain; keep PACT-051 In Progress.
- 25 Sep 2026: enhanced single-VPS restore-drill.sh verified pg_basebackup manifest/WAL, booted Restic snapshot 9a320c36 in an isolated PostgreSQL 17 container, and committed/replayed one synthetic outbox delivery without duplicate. Live PostgreSQL remained healthy and temporary volumes/container were removed. Snapshot predates gameplay tables, so full recovered stock/unit/receipt comparison is not established. MCP direct-transfer proposal route passes; local Node 24 build/typecheck/lint, 115 unit, 167 PostgreSQL 17 integration tests, and sh -n on the restore script pass. See docs/operations/vps-deployment.md and docs/implementation/reports/rules-verification-progress.md. Keep PACT-051 In Progress.
- 25 Sep 2026: R04/R06 approval race fixture holds dispatch open while duplicate approval and rejection compete. One command receipt and approved inbox/outbox resolution survive; rejection receives ALREADY_RESOLVED. Expired approve/reject now persist expired state. Local Node 24 build/typecheck/lint, 115 unit and 168 PostgreSQL 17 integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Generated transition matrix and VPS gameplay-state restore remain; keep PACT-051 In Progress.
- 25 Sep 2026: R01/R06 seed 0x51c0ffee now runs 30 direct-transfer attempts across three mutually contacted kingdoms through the shared world-admitted dispatcher, checking every balance and total against an independent BigInt model after each step. Unaffordable spends leave no transfer/receipt, successful retries retain one receipt, and final balances equal journal sums. Local Node 24 build/typecheck/lint, 115 unit and 169 PostgreSQL 17 integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Broader cross-module faults and VPS gameplay-state restore remain; keep PACT-051 In Progress.
- 25 Sep 2026: R04/R06 training-approval fixture proves lease-bound proposal has no batch or stock debit, exact human approval creates one charged batch and stable replay, and an unaffordable later proposal leaves approval pending with no second batch. Node 24 build/typecheck/lint, 115 unit and 170 PostgreSQL 17 integration tests pass. See docs/implementation/reports/rules-verification-progress.md. Generated all-command matrix and full VPS gameplay-state restore remain; keep In Progress.
- 26 Sep 2026: R04/R06 construction approval fixture verifies no instruction or permit at proposal time, changed-slot rejection, missing human-session denial without resolving approval, exact permit creation and consumption on human commit, and receipt-stable replay. Node 24 build/typecheck/lint, 115 unit and 171 PostgreSQL 17 integration tests pass. See docs/implementation/reports/rules-verification-progress.md. Generated all-command matrix and VPS gameplay-state restore remain; keep In Progress.
- 26 Sep 2026: R04/R06 exact scout approval fixture verifies no operation or troop placement change at proposal, changed selected IDs and outsider denial, one owner-approved scout moving two specified Spearmen and charging 10 Silver/5 Grain, and duplicate approval returning the original receipt. Node 24 build/typecheck/lint, 115 unit and 172 PostgreSQL 17 integration tests pass. See docs/implementation/reports/rules-verification-progress.md. Generated all-command matrix and VPS gameplay-state restore remain; keep In Progress.

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
