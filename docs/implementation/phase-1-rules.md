# Phase 1 — Transactional rules prototype

**27 tickets · 27 completed.** [Backlog overview](README.md) · [Machine-readable tickets](tasks.json)

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

**Status:** done · **Role:** Frontend · **Size:** L · **Type:** implementation

**Depends on:** [PACT-023](phase-0-connections.md#pact-023), [PACT-027](phase-0-connections.md#pact-027), [PACT-045](phase-1-rules.md#pact-045), [PACT-046](phase-1-rules.md#pact-046), [PACT-047](phase-1-rules.md#pact-047), [PACT-049](phase-1-rules.md#pact-049)

**Components:** functional gameplay UI.

**Specification:** [product](../pact/product.md), [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R01, R05

**Implement / deliver**

- Implement functional Kingdom/Envoy/People/Chronicle navigation with text-first construction, training, contract sheets, troop/garrison/scout/raid controls, and report views.
- Connect all human controls to the shared commands, approval previews, server versions, and live events; keep art and shop out of this stage.

**Acceptance**

- [x] Two test players can found, develop, negotiate, trade, scout, lend, raid, inspect losses, and rebuild using the UI.
- [x] Manual actions remain usable with disconnected providers and cannot bypass stock, charge, lock, or shared action limits.

**Assignee:** Mohammad Safakhou

**Evidence**

- 26 Sep 2026: In Progress in Linear MNI-112, assigned to Mohammad Safakhou (Codex). Text-first web Alpha increment implemented in a126587 and 23223ef; release alpha-20260926-2 passed VPS verify, browser login/registration rendering, and authenticated owner-view/command/receipt/inbox smoke. docs/implementation/reports/rules-ui-progress.md records local build/typecheck/lint/unit/integration results and the still-unmet two-player browser acceptance.
- 26 Sep 2026: Release alpha-20260926-4 passed VPS verify and Chrome two-account contact/message/supply-offer/sign/active-contract checks; local build, typecheck, lint, 122 unit and 174 integration tests pass for the follow-up UI. Releases alpha-20260926-5 and -6 improved prerequisites, tab/account state, and contract visibility. Briar started and completed a scout, inspected its authorized report, transferred Grain, and hit INSUFFICIENT_STOCK on an overspend. Release alpha-20260926-7 adds a readable scout report. Full garrison/raid/loss/rebuild UI acceptance remains open; see docs/implementation/reports/rules-ui-progress.md and docs/operations/alpha-web.md.
- 27 Sep 2026: Briar and Cinder each queued eight ordinary Spearmen in successive Chrome sessions. Committed receipts exposed a playability gap: the Troops panel had no active queue/progress/ETA. Owner-only world view now returns batch progress, next due game time, and unit duration; the Kingdom panel shows it and permits cancellation. An integration fixture verifies owner visibility, outsider/public exclusion, and removal after cancel. Node 24 build/typecheck/lint, 124 unit, and 180 PostgreSQL integration tests pass. Release alpha-20260927-6 passed public VPS verify; Cinder's live Chrome panel showed 3/8 trained and the next deadline. Same-profile tabs share the login cookie, so simultaneous two-player testing requires separate browser profiles. See docs/implementation/reports/rules-ui-progress.md and docs/architecture/world-views.md. Garrison/raid/loss/rebuild acceptance remains; keep In Progress.
- 27 Sep 2026: Release alpha-20260927-7 passed public VPS verify. Chrome showed Cinder's Hall II waiting in builder slot 1 and Barracks II active in slot 2 with a game-time deadline; a new UI hint explains Hall prerequisites. Cinder finished training eight ordinary Spearmen, selected eight in People, and committed a synthetic raid declaration on Briar (raid ID 9ee49ebf-64be-4f37-9aa6-e6f205f8fc9d). The participant report was not yet available before timed battle resolution. See docs/implementation/reports/rules-ui-progress.md and docs/operations/alpha-web.md. Full raid outcome/loss/rebuild, garrison, simultaneous two-player browser, and accessibility acceptance remain; keep In Progress.
- 28 Sep 2026: Cinder's Chrome participant report for the resolved synthetic raid showed defender victory, seven of eight attacker losses, two of sixteen defender losses, and zero loot. Cinder's home count fell from 16 to 9; seven replacement Spearmen were queued with committed receipt 27e5e491-d9dc-47e5-8805-b3c36becfdf2 and 70 Iron/28 Silver charged. The owner projection and web UI now distinguish Home Guard from ordinary troops, index recent participant raids, and summarize resolved reports with proof collapsed. Node 24 package/web build, typecheck, lint, 124 unit and 182 PostgreSQL integration tests pass. Release alpha-20260928-1 passed public VPS verify; Chrome showed 2 ordinary plus 8 Home Guard Spearmen after one replacement, the resolved raid index, and correct readable loss/loot summary. See docs/implementation/reports/rules-ui-progress.md, docs/architecture/world-views.md, and docs/operations/alpha-web.md. Garrison, simultaneous two-player browser, and accessibility acceptance remain; keep In Progress.
- 28 Sep 2026: Garrison sheet now shows host upkeep, both bonds, seizure/default risk, offer withdrawal, and active mutual-release/recall/return/host-seizure controls via shared commands. Local Node 24 build/typecheck/lint, 126 unit and 182 PostgreSQL integration tests passed. Release alpha-20260928-2 passed public VPS verify; Chrome showed the new warning. Cinder queued Farm III and Barracks III after owner-checked synthetic resource transfers, with real game-time due dates. A focused four-area accessibility smoke found no unlabeled native controls, missing image alternatives, or sub-44px targets, but full WCAG and simultaneous two-player browser/garrison acceptance remain unverified. See docs/implementation/reports/rules-ui-progress.md and docs/operations/alpha-web.md. Keep In Progress.
- 28 Sep 2026: Cinder's Farm III and Barracks III completed. Authenticated owner API calls queued Storehouse II (aa7071f5-e3eb-4b57-a087-f12380865039) and waiting Hall III (e338ff3d-1aec-474c-90e1-e9044ed1ea57); a server read at 11:43 UTC showed Storehouse II complete and Hall III automatically active, due 13:44 UTC. Local DNS resolves the public origin to a Fortinet block page, so no browser acceptance is claimed. See docs/implementation/reports/rules-ui-progress.md. Keep In Progress.
- 28 Sep 2026: After founder changed networks, Chrome reached the live UI but found API 502 from full VPS disk and a raw empty-response JSON parse notice. PostgreSQL recovered after disposable Docker build-cache cleanup; an encrypted backup pruned only archived WAL older than a snapshot cutoff and snapshot 86734927 passed isolated gameplay/outbox restore. The world resumed at its last committed game minute; Cinder signed in through Chrome and inspected People/garrison controls, while Hall III remained active after the clock pause. Web response handling now has three unit cases. Node 24 build/typecheck/lint, 129 unit and 185 integration tests pass. See docs/implementation/reports/rules-ui-progress.md and docs/operations/vps-deployment.md. Full garrison/two-player UI acceptance remains; keep In Progress.
- 28 Sep 2026: Hall III and replacement training completed normally. Successive Cinder/PACT MVP Owner Chrome sessions created and jointly signed a one-hour one-Spearman garrison, observed host visiting placement/upkeep, then mutually released it and observed eight ordinary Spearmen back home. Scout 664d0843-3d7c-43b6-aebf-37ac57d873a8 completed with a readable private report. Release alpha-20260928-4 adds an owner-only bounded scout index/direct report button and supply-only Kingdom card wording; public VPS verify and fresh Chrome report navigation passed. Node 24 build/typecheck/lint, 129 unit and 186 integration tests pass. Evidence and screenshot: docs/implementation/reports/rules-ui-progress.md. Complete UI-only two-player founding/play and broader lock/charge-limit failure checks remain; keep In Progress.
- 28 Sep 2026 UTC: Revision a2ca7b3 fixes stale refresh warnings, player-switch/pending-read races, detected cross-tab kingdom changes and incorrect upgrade targets. Seven new checks bring Node 24 build/typecheck/lint and unit coverage to 154 tests; 225 PostgreSQL 17.11 integration tests pass. Release alpha-20260928-5 passed immutable container deployment/current migrations/privacy replay/public verify. Chrome showed active Cinder tick 4124, Farm III to IV and Market I to II, and stable sign-in after Switch test player; no game write, new account, grant or paid call. Linear progress comment 7e102986-146d-43d4-81ae-1bec3d290f69 and In Progress/assignee readback reconciled. Report: docs/implementation/reports/rules-ui-progress.md. UI-only founding/play and live charge/lock-denial observations remain; keep In Progress. Ten moderate Expo/Xcode/UUID audit findings are documented for review, with zero high/critical and no forced update.
- 29 Sep 2026 (28 Sep UTC): b119d60 adds read-only owner scout/raid charge availability and game-time regeneration to Kingdom/People. Node 24 build/typecheck/lint, 156 unit and 226 PostgreSQL 17.11 integration tests passed. Release alpha-20260928-6 passed immutable builds/current migrations/privacy replay/public verify. Chrome committed four scouts normally; after the first return with two ordinary Spearmen home and scout pool 0/4, a fifth UI submission returned RATE_LIMITED at tick 4154 with no new operation. No clock skip, stock edit, account/grant/credential change or paid call. Linear comment 4b70b5fb-e807-4089-8c8d-e0ea47a9533d and issue description/status/assignee readback reconciled. Report/screenshots: docs/implementation/reports/rules-ui-progress.md. Full UI-only two-player founding/play and meaningful battle-lock/shared rolling-limit observations remain; keep In Progress.
- 29 Sep 2026 (28 Sep UTC): fdc7fb5 adds owner raid roles/stored lock deadlines, confirmed withdrawal, and EXPIRED/pending-tick receipt guidance. Node 24 build/typecheck/lint, 162 unit and 226 PostgreSQL 17.11 integration tests passed. Release alpha-20260928-7 passed immutable builds/current migrations/privacy replay/public verify. Chrome committed 24 one-Grain transfers then received RATE_LIMITED; raid 4a5f394a-c43c-42b6-81a3-73021984df5a was locked at tick 4178, and submitting a confirmation opened before lock returned EXPIRED without withdrawal. No clock skip, stock edit, new account/grant/credential change or paid call. Six dependencies freshly Done; Linear comment 8e94191c-3190-43e1-a712-bcaf86037ef5 and description/In Progress/assignee readback reconciled. Report/screenshots: docs/implementation/reports/rules-ui-progress.md. Complete UI-only two-player founding/play remains; keep In Progress. New battle outcome is not claimed.
- 29 Sep 2026 (28 Sep UTC): 6a4be89 fixes all three Chronicle report paths with latest-selection gating, loaded type/ID, loading/unavailable/transport messages and owner-loss review-only training navigation. Node 24 build/typecheck/lint, 169 unit and 226 PostgreSQL 17.11 integration tests passed. Immutable release alpha-20260928-8/current migrations/privacy replay/public verify passed. Chrome verified exact battle identity, unsent form edits, rebuild navigation, missing report and direct valid scout recovery. Raid 4a5f394a-c43c-42b6-81a3-73021984df5a resolved with 7/8 attacker and 2/12 defender losses, no loot; normal UI training receipt 23c22977-fd63-4769-89f6-a8e5ae74a726 queued seven replacements for 70 Iron/28 Silver, 2/7 observed ready at tick 4193. Whole batch finish not claimed. No clock skip, stock edit, account/grant/credential change or model call. Linear comment 088d1fe7-11aa-409f-b97d-77f0bfbc739f and checklist/status/assignee readback reconciled: manual safeguards criterion checked, full UI-only two-player founding/play unchecked, In Progress. Report/screenshots: docs/implementation/reports/rules-ui-progress.md.
- 29 Sep 2026 (28 Sep UTC): acceptance-only Chrome read at tick 4210 / 12:29 AM confirms all seven replacements from 23c22977-fd63-4769-89f6-a8e5ae74a726 complete, eight ordinary Spearmen home, eight Home Guard and queue free. Screenshot/report: docs/implementation/reports/rules-ui-progress.md. Comment ad606063-edde-422b-a0e2-b94778d6b043 and fresh In Progress/assignee readback reconciled. No new game order, clock/stock edit, account/grant/credential change or model call. Full UI-only founding/play remains; explicit approval for two fresh disposable synthetic accounts, or existing verified unactivated test accounts, is requested before new account setup. No new dependency-ready backlog work; no Done/gate or new deployment claim.
- 29 Sep 2026: Founder explicitly authorized two synthetic signups and test declarations. Chrome registered, verified and founded Amber Testhold and Birch Testhold through normal flows; both queued Farm II and Barracks II. Fresh ordinary stock prevented Birch cold contact (INSUFFICIENT_STOCK); an unaccepted Amber-to-Birch transfer returned FORBIDDEN without movement. Revision 583ba0b explains two ordinary Silver cold-contact cost and disables message/transfer until accepted contact. Node 24 build/typecheck/lint and 171 unit tests passed; integration not rerun. Immutable release alpha-20260929-1 passed builds/migrations/privacy replay/public verify; fresh Chrome confirmed disabled premature transfer. Report/screenshots: docs/implementation/reports/rules-ui-progress.md. Full fresh-pair negotiation/trade/scout/garrison/raid/loss/rebuild remains; keep In Progress.
- 29 Sep 2026: Fresh Amber/Birch UI sessions completed the naturally funded cold contact and acceptance, two-way message exchange, one-Grain direct transfer, version-1 one-hour Grain/Silver offer with both signatures and active contract. Farm II/Barracks II completed for both; both Hall II orders are waiting, not finished. Amber's tick 4266-to-4268 owner balances match production/upkeep plus two contract installments (inference). Linear comment 99c727f1-b186-4028-9dfe-15184be62d6d and In Progress/assignee/checklist readback reconciled. Exact IDs/screenshots: docs/implementation/reports/rules-ui-progress.md. Fresh-pair troop/scout/garrison/raid/loss/rebuild remains; no full acceptance or PACT-053 gate closure.
- 29 Sep 2026: c526bcd adds owner-projection-based Scout guidance for two home ordinary Spearmen, 10 ordinary Silver, 5 ordinary Grain and an available charge, all exact units and non-self target. Node 24 build/typecheck/lint, 172 unit tests pass; integration not rerun. Immutable alpha-20260929-2 passed builds/migrations/privacy replay/public verify; Chrome Birch tick 4276 showed only Home Guard and Scout disabled after selecting accepted Amber. Linear comment c65d5f8c-df81-4a09-abd9-1cac4fac828a and In Progress/assignee/checklist readback reconciled. See docs/implementation/reports/rules-ui-progress.md. Full two-founder troop/scout/garrison/raid/loss/rebuild remains.
- 29 Sep 2026: Birch naturally reached 10 ordinary Iron at tick 4282, queued one ordinary Spearman through Chrome for 10 Iron/4 Silver (receipt f2bd27cf-2f70-43b3-804a-f635b7d3f65e), and showed 0/1 due at 1:46 AM game time with queue occupied. At tick 4287 Chrome showed one ordinary Spearman home beside eight Home Guard, batch absent and training queue free. Screenshots/report: docs/implementation/reports/rules-ui-progress.md. Linear comment 9e09c9e2-caf8-4674-8209-a2502ce2b1e8 and In Progress/assignee/checklist readback reconciled. No clock/stock edit, existing-account funding or full Scout/battle-loop claim.
- 29 Sep 2026: Completed paired-session capability matrix and both acceptance items; report docs/implementation/reports/rules-ui-completion.md. Amber/Birch founded/developed, negotiated and traded, Birch completed a scout and resolved raid, both read losses and completed ordinary replacement training. Earlier Cinder/PACT MVP Owner paired Chrome sessions completed Hall III garrison offer/sign/host/mutual release; the report explicitly distinguishes that pair from the new founders. 77fc403 separated raid and garrison force controls; 2143d92 removed fixed Home Guard count after actual casualties. Node 24.19 build/typecheck/lint and 175 unit tests passed for final code; 226 PostgreSQL 17 integration tests passed for the preceding UI change, not rerun for the final two-string display edit. Immutable alpha-20260929-4 passed builds/migrations/privacy replay/public verify; Chrome confirmed corrected hint and completed Amber training. Linear MNI-112 Done, both criteria checked, assignee readback Mohammad Safakhou; completion comment 1a3a8042-25e5-46d0-bea4-8455d8d43991. Backlog render/check and git diff --check passed (98 tickets, acyclic dependencies, source snapshots and generated views consistent). No simultaneous same-pair pilot, full accessibility, fun, PACT-053 gate, paid provider call or clock/stock bypass claimed.

<a id="pact-049"></a>
## PACT-049 — Expose complete game tools to every Envoy route

**Status:** done · **Role:** Integrations · **Size:** M · **Type:** implementation

**Depends on:** [PACT-017](phase-0-connections.md#pact-017), [PACT-021](phase-0-connections.md#pact-021), [PACT-027](phase-0-connections.md#pact-027), [PACT-039](phase-1-rules.md#pact-039), [PACT-045](phase-1-rules.md#pact-045)

**Components:** game tool registry, context assembly.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md), [rules](../pact/rules.md), [architecture](../pact/architecture.md) · **Release checks:** R04, R06

**Implement / deliver**

- Replace sandbox-only routing with all permitted typed game command groups, record reads, messages, receipts, and approvals.
- Implement bounded context selection and readable receipt summaries; preserve the same dispatch and authorization behavior in all adapters and MCP.

**Acceptance**

- [x] A recorded scenario produces equivalent game commands/receipts from web, adapter, and MCP paths.
- [x] Malicious counterpart text cannot change identity, tool scope, model connection, or mandate; no adapter receives hidden state through a convenience summary.
- [x] Generated SDK, model-adapter, and MCP commands use the same product-scoped contracts and cannot gain first-party human privileges.

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
- 26 Sep 2026: release mvp-20260926-1 deployed the current gameplay backend after revision 99cf2fa fixed clean Docker workspace build ordering and added a dependency guard. Public deployment verification passed; the host-only synthetic account activated one kingdom and submitted a committed Farm II construction command via the gateway. Local lint/typecheck, 115 unit and 172 PostgreSQL 17 integration tests pass. See docs/operations/vps-deployment.md and docs/implementation/reports/game-tools-progress.md. Web gameplay and full PACT-049 route/adversarial acceptance remain; keep In Progress.
- 26 Sep 2026: workers/inference/src/run-context.test.ts adds owner-context boundary checks: hostile counterpart prose stays user-role data, arbitrary inbox payload does not enter metadata summary, non-owner projection stops all later private reads, and oversized conversation text is omitted with a truncation marker. Node 24 typecheck/lint and focused three-test unit suite pass. See docs/implementation/reports/game-tools-progress.md. This is one context-construction fixture, not full cross-route/adversarial acceptance; keep In Progress.
- 26 Sep 2026: PostgreSQL fake-provider/MCP matrix denied all seven human-only game actions with forged human/other-account envelopes and no committed receipts or exact human permits. Unit contract fixture locks all 28 game action kinds to generated web, MCP, and model schemas; model schema excludes sandbox actions. Node 24 build/typecheck/lint, 119 unit and 174 PostgreSQL 17 integration tests pass. See docs/api/runs.md and docs/implementation/reports/game-tools-progress.md. At this checkpoint broader acceptance review remained open.
- 26 Sep 2026: final acceptance review in docs/implementation/reports/game-tools-completion.md (revision 0b0ca8a) matches all three PACT-049 criteria to recorded web/model/MCP message and versioned supply-offer scenarios, hostile-context/private-read isolation, shared 28-action schemas, and seven-action human-only denial. Node 24 build/typecheck/lint, 119 unit and 174 PostgreSQL 17 integration tests pass. Linear MNI-113 is Done. No live paid-model/consumer-host certification or playable PACT-048 UI is claimed.

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

**Status:** done · **Role:** QA · **Size:** L · **Type:** verification

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-029](phase-1-rules.md#pact-029), [PACT-030](phase-1-rules.md#pact-030), [PACT-032](phase-1-rules.md#pact-032), [PACT-033](phase-1-rules.md#pact-033), [PACT-034](phase-1-rules.md#pact-034), [PACT-035](phase-1-rules.md#pact-035), [PACT-036](phase-1-rules.md#pact-036), [PACT-037](phase-1-rules.md#pact-037), [PACT-038](phase-1-rules.md#pact-038), [PACT-039](phase-1-rules.md#pact-039), [PACT-040](phase-1-rules.md#pact-040), [PACT-041](phase-1-rules.md#pact-041), [PACT-042](phase-1-rules.md#pact-042), [PACT-043](phase-1-rules.md#pact-043), [PACT-044](phase-1-rules.md#pact-044), [PACT-046](phase-1-rules.md#pact-046), [PACT-050](phase-1-rules.md#pact-050)

**Components:** rules property/recovery suites.

**Specification:** [delivery](../pact/delivery.md), [rules](../pact/rules.md), [runtime](../pact/runtime.md) · **Release checks:** R01, R02, R03, R04, R05, R06

**Implement / deliver**

- Build seeded/property-based economy scenarios, boundary-time fixtures, cross-account authorization tests, and fault injection around every durable command/tick transition.
- Rehearse backup restore and outbox replay; compare recomputed wealth and unit placement to the authoritative state after recovery.

**Acceptance**

- [x] All R01–R06 assertions have reproducible passing evidence, including overlapping raids and multi-client authority races.
- [x] No negative stock, duplicate troop, repeated reward, partially published tick, or lost committed receipt survives a generated scenario.

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
- 26 Sep 2026: encrypted Restic snapshot 2ba99a33 of the new single-VPS gameplay deployment booted in isolated PostgreSQL 17; recovered kingdom, eight home guards, Farm II instruction, committed receipt, ledger balances, and deduplicated outbox replay all passed. The live data volume was untouched. Local lint/typecheck, 115 unit, 172 PostgreSQL 17 integration tests and sh -n passed. See docs/operations/vps-deployment.md and docs/implementation/reports/rules-verification-progress.md. This is one representative physical restore, not the generated all-command fault matrix; keep In Progress.
- 26 Sep 2026: tests/integration/troops.test.ts adds a seeded 12-step R03/R06 training lifecycle with replayed queue IDs, cancellation, one/two-unit settlement, disbanding, independent ordinary-unit counts, eight Home Guards, unique troop IDs and placement after each step. An injected settlement exception rolls back troop rows, all resource balances, and movement count before retry. Local Node 24 build/typecheck/lint, 115 unit and 173 PostgreSQL 17 integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Wider all-command matrix remains; keep In Progress.
- 27 Sep 2026: world-clock.test.ts records all nine tick phases in durable transaction order after pause/resume, then verifies one game-minute advance, one tick/outbox event, and no duplicate publication on immediate retry. Focused clock suite 8 passing; Node 24 typecheck/lint, 124 unit, and 179 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Synthetic handlers do not close the real-domain phase trace or generated all-command matrix; keep PACT-051 In Progress.
- 28 Sep 2026: world-clock.test.ts injects a pre-commit fault at each of nine synthetic tick phase boundaries. All attempts roll back phase effects, tick, and event; clean retry publishes once. Focused clock suite 9 passing; Node 24 typecheck and 183 PostgreSQL integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Real-domain phase ordering and the all-command generated fault matrix remain; keep In Progress.
- 28 Sep 2026: world-domain-order.test.ts proves Market-I production can fund a same-minute supply installment through the real clock, then injects a post-production fault and observes zero harvest, installment, or tick until clean retry. Focused fixture, Node 24 typecheck/lint, and 184 PostgreSQL 17 integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Battle/scout ordering and the generated all-command fault matrix remain; keep In Progress.
- 28 Sep 2026: raids.test.ts verifies real same-minute battle then scout sampling; an injected post-battle tick fault rolls back casualties, reports, and tick, while retry samples the surviving troop band and commits once. Focused fixture, Node 24 typecheck/lint, 126 unit and 185 PostgreSQL 17 integration tests pass. See docs/architecture/rules-verification.md and docs/implementation/reports/rules-verification-progress.md. Combined all-domain phase trace and generated all-command fault matrix remain; keep In Progress.
- 28 Sep 2026: Single-VPS full-disk incident recovery produced encrypted base/WAL snapshot 86734927 after archive-cutoff cleanup. The snapshot booted in an isolated PostgreSQL 17 container; recovered balances matched the ledger journal, Cinder's eight home guards, Hall III build instruction and committed receipt were present, and synthetic outbox replay deduplicated. Last live tick/outbox matched before no-catch-up resume. Local Node 24 build/typecheck/lint, 129 unit and 185 integration tests pass; sh -n and an older/newer archive cutoff fixture pass. This strengthens physical recovery evidence but does not complete the generated all-command fault matrix; keep In Progress.
- 28 Sep 2026: revision ae5c534 shares the actual rules-worker composition with a combined real-domain hourly-boundary fixture. Faults after all nine phase positions restore every durable table; fresh-runtime retry commits construction/training, production/upkeep, supply delivery/default/bonds, battle/scout, Fortune and rewards once, with pre-publication read isolation and journal reconciliation. Season rollover is intentionally a no-op until PACT-069. Generated combat compares 32 seeded rosters across 36 dice pairs under detachment splitting/reordering. Authenticated HTTP cookie/CSRF and hash-introspected OAuth MCP signature races retain one contract/bond debit/future commitment and two receipts; exhausted mandate and invalid/revoked credentials fail. Node 24.19.0 build/typecheck/lint, 130 unit and 188 PostgreSQL 17.11 integration tests pass. See docs/implementation/reports/rules-runtime-batch.md and docs/architecture/rules-verification.md; Linear progress comment a90206f4-08cd-4481-b29a-f3efaf22d95a. Broader generated command-fault/value/placement/revocation matrix remains; keep In Progress. No new deployment or hosted CI.
- 28 Sep 2026: revision c96b293, tests/integration/game-command-faults.test.ts covers all 28 published gameplay action kinds via real world admission, handler and dispatcher. Post-handler and deferred post-receipt COMMIT failures (56 checks) restore every durable base table, then one clean commit and stable receipt replay survive. Independent exact resource/category arithmetic covers costs, fractional refunds, bonds, provisions and compensation; exact troop IDs/owners and current placement references pass. Forged-owner attempts fail without mutation for 19 private object/party-bound kinds; outsider receipt reads/retries and changed-payload replay are checked for all 28. The process-death fixtures now wait for the specific job's database-clock lease deadline rather than a flaky fixed 150 ms host delay, and verify reclaimed run identity and fenced completion. Local Node 24.19.0 build/typecheck/lint, 130 unit and 216 PostgreSQL 17.11 integration tests pass. See docs/implementation/reports/game-command-fault-matrix.md and docs/architecture/rules-verification.md; Linear progress comment 388b9922-55f0-47e8-b652-6189feef728f. Mixed command sequences, agent-specific mandate/revocation interleavings and consolidated acceptance remain; keep PACT-051 In Progress. No deployment, provider call, new physical restore or hosted CI.
- 28 Sep 2026: revision 5a748a2, tests/integration/game-command-faults.test.ts adds seeds 0x51a17e, 0xc0ffee and 0xdecaf (85 mixed commits/replays, 29 injected rollback checks) with independent per-category stock and exact identity/placement models, including seized units explicitly joining a raid before withdrawal. Three real-MCP-lease agent garrison cases prove PostgreSQL-confirmed revocation-first denial, prior-signature survival with new-command denial, competing-offer troop caps and exact host upkeep-plus-five-minute-extension reservation (1300 succeeds, 1299 fails). Final Node 24.19.0 build/typecheck/lint, 130 unit and 222 PostgreSQL 17.11 integration tests pass. An initial concurrent-build run failed one existing process-kill case; isolated and final full reruns passed, cause unconfirmed. See docs/implementation/reports/mixed-gameplay-authority.md and docs/architecture/rules-verification.md. Linear progress comment 6b92ed91-9b75-464d-ac96-3f594f65fd4f records this revision and evidence. Consolidated R01-R06 acceptance review remains; keep PACT-051 In Progress. No production code, deployment, live provider, new physical restore or hosted CI changed.
- 28 Sep 2026: completed in revision e6e55cd after consolidated R01-R06 review. Added uncertain caller timeout/recovery (one receipt/contact/two-Silver debit), exact harvest input transitions and fresh schema restore with independent marked wealth 64 plus all stock categories and exact troop placements/receipt/outbox replay. Prior physical VPS snapshot 86734927 recovery remains dated evidence. All 18 dependencies freshly Done; final Node 24.19.0 build/typecheck/lint, 130 unit and 224 PostgreSQL 17.11 integration tests, restore and planning/diff checks pass. Report docs/implementation/reports/rules-verification-completion.md; Linear completion comment 36a1d2d5-2171-46a8-a50a-9ed12e98677f; readback Done. This closes Phase 1 verification, not PACT-053 or automatic season rollover (PACT-069). No new deployment, paid provider, hosted CI or whole-VPS drill.

<a id="pact-052"></a>
## PACT-052 — Build and run the allowed script baseline

**Status:** done · **Role:** QA · **Size:** M · **Type:** verification

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-049](phase-1-rules.md#pact-049), [PACT-051](phase-1-rules.md#pact-051)

**Components:** script client and comparison harness.

**Specification:** [delivery](../pact/delivery.md), [runtime](../pact/runtime.md) · **Release checks:** R07

**Implement / deliver**

- Create a deterministic client that uses the same published reads, negotiation primitives, and command limits as Envoys; isolate operator test identities from the real world.
- Run matched scripted and model-driven scenarios with recorded initial state, partner behavior, quotas, outcomes, and API costs when measurable.

**Acceptance**

- [x] The script cannot use hidden state, private administrative APIs, free resources, or privileged action rates.
- [x] Publish the actual comparison even when the script wins; a successful execution test is separate from proof that negotiation is fun.

**Assignee:** Mohammad Safakhou

**Evidence**

- 28 Sep 2026: MNI-116 claimed In Progress by Mohammad Safakhou after PACT-027, PACT-049 and newly completed PACT-051 were freshly read Done. Implementing a deterministic public-tool client and isolated baseline harness; no completion evidence yet.
- 28 Sep 2026: revision 57701ac, bounded public MCP script and matched isolated fake-provider policy comparison implement normal discovery, Farm II, message/offer/sign, exact uncertain-command receipt reconciliation and session closure. Both normally founded/produced kingdoms finish with identical category balances and 120 settled supply installments; no live resources or model API calls. Node 24 build/typecheck/lint, 139 unit and 225 PostgreSQL 17 integration tests pass. See docs/operations/script-baseline.md and docs/implementation/reports/script-baseline-progress.md. Matched real-model strategy/cost comparison remains; keep In Progress, no fun claim. Linear progress comment 8b8fd319-7453-4402-8939-cf04f3932e27; assignee/status freshly read back.
- 29 Sep 2026 (28 Sep UTC): Tracker cleanup only. Fresh Linear read showed stale no-implementation description despite 57701ac/report. Updated it to the verified bounded public-tool baseline and isolated fake-provider comparison, retaining the missing separately authorized matched real-model trial. Full integration rerun passed 226 tests, including unchanged matched Farm II/120 installments/both-player balances. Comment ecebb589-a008-413d-b44d-e4911ca997fa and description/status/assignee readback confirm In Progress. No new model-performance/fun evidence or paid call; docs/implementation/reports/script-baseline-progress.md records reconciliation.
- 29 Sep 2026 (28 Sep UTC): focused baseline rerun passed 9 unit tests and 1 matched PostgreSQL 17.11 integration scenario on Node 24.19; unchanged Farm II/120 installments/identical both-player balances. First no-hidden-state/admin/free-resource/privileged-rate acceptance checked in Linear, comment 96b2c786-b4d7-4402-a20e-f02b979f2bf1 and checklist/status/assignee readback reconciled. Second actual matched real-model comparison remained unchecked at that checkpoint. No new code, live model/HTTP certification, paid call or kingdom reset. docs/implementation/reports/script-baseline-progress.md.
- 29 Sep 2026: `0b144c5` implements optional loopback-hosted real-model comparison; `40433c8` publishes docs/implementation/reports/script-baseline-completion.md and rerun instructions. Matched disposable PostgreSQL 17 worlds, normal founding/production/upkeep, same accepted partner and conditional exact signing: script Farm II + one expired contract/120 installments in 10 public MCP calls; Qwen3-4B-GGUF Q4_K_M local model Farm II only, 8 provider calls/13,795 reported tokens, one COMMITTED and seven BUILDING_BUSY receipts, no offer/contract/installment. Identical initial stock and both final category balances in report. External API USD 0, hardware cost unmeasured; no fun or hosted-provider claim. Node 24 build/typecheck/lint, 175 unit, 226 PostgreSQL integration and focused 2-test actual local-model comparison passed. Linear MNI-116 both acceptance boxes checked and Done/assignee read back; completion comment a5e8e73e-186c-437f-96d9-b7dc0c537e2b. No live kingdom/VPS inference change.

<a id="pact-096"></a>
## PACT-096 — Demonstrate platform-module reuse outside PACT

**Status:** done · **Role:** Architecture / QA · **Size:** M · **Type:** verification

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-028](phase-1-rules.md#pact-028), [PACT-039](phase-1-rules.md#pact-039), [PACT-049](phase-1-rules.md#pact-049), [PACT-051](phase-1-rules.md#pact-051), [PACT-082](phase-0-connections.md#pact-082), [PACT-083](phase-0-connections.md#pact-083)

**Components:** non-game fixture, module isolation tests.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [delivery](../pact/delivery.md) · **Release checks:** R08

**Implement / deliver**

- Build a small test-only non-game application using identity, model/runtime, exact approvals, and notifications through public package exports and in-memory adapters.
- Use a fake provider and generic synthetic action; prove no PACT-domain/database import, no credential/event sharing across product scopes, and no required deployment-provider dependency.

**Acceptance**

- [x] The fixture compiles/runs independently and completes a bounded action/approval cycle without kingdom types or production services.
- [x] PACT’s integrated stock-plus-authority transaction tests still pass; CI blocks prohibited imports and unversioned breaking contract changes.

**Assignee:** Mohammad Safakhou

**Evidence**

- 28 Sep 2026: MNI-117 claimed In Progress by Mohammad Safakhou after fresh Done readbacks of all seven dependencies.
- 28 Sep 2026: revision 58e6373 implements public portable identity/runtime/approval/notification exports, isolated non-game application and dependency/contract guards. Independent compile/runtime proof passes with database configuration unset; product credentials/events/leases/approvals remain isolated. Local Node 24 build/typecheck/lint, 147 unit and 225 PostgreSQL 17 integration tests pass, including integrated stock-plus-authority atomicity. See docs/architecture/portable-platform.md and docs/implementation/reports/platform-reuse.md. Linear completion comment 87d6c4ef-d035-4f21-a9fb-53676579255d; both acceptance items checked and Done/assignee read back. No hosted CI, deployment or real-provider claim.

<a id="pact-053"></a>
## PACT-053 — Accept the transactional rules prototype

**Status:** done · **Role:** Release · **Size:** S · **Type:** gate

**Depends on:** [PACT-027](phase-0-connections.md#pact-027), [PACT-028](phase-1-rules.md#pact-028), [PACT-029](phase-1-rules.md#pact-029), [PACT-030](phase-1-rules.md#pact-030), [PACT-031](phase-1-rules.md#pact-031), [PACT-032](phase-1-rules.md#pact-032), [PACT-033](phase-1-rules.md#pact-033), [PACT-034](phase-1-rules.md#pact-034), [PACT-035](phase-1-rules.md#pact-035), [PACT-036](phase-1-rules.md#pact-036), [PACT-037](phase-1-rules.md#pact-037), [PACT-038](phase-1-rules.md#pact-038), [PACT-039](phase-1-rules.md#pact-039), [PACT-040](phase-1-rules.md#pact-040), [PACT-041](phase-1-rules.md#pact-041), [PACT-042](phase-1-rules.md#pact-042), [PACT-043](phase-1-rules.md#pact-043), [PACT-044](phase-1-rules.md#pact-044), [PACT-045](phase-1-rules.md#pact-045), [PACT-046](phase-1-rules.md#pact-046), [PACT-047](phase-1-rules.md#pact-047), [PACT-048](phase-1-rules.md#pact-048), [PACT-049](phase-1-rules.md#pact-049), [PACT-050](phase-1-rules.md#pact-050), [PACT-051](phase-1-rules.md#pact-051), [PACT-052](phase-1-rules.md#pact-052), [PACT-096](phase-1-rules.md#pact-096)

**Components:** rules release gate.

**Specification:** [delivery](../pact/delivery.md) · **Release checks:** R01, R02, R03, R04, R05, R06, R07, R08

**Implement / deliver**

- Collect the playable prototype revision, rules-catalog version, command schemas, replay fixtures, invariant results, and script comparison.
- Review the eight rules acceptance checks without treating design arithmetic as implemented tests.

**Acceptance**

- [x] R01–R08 pass against the committed implementation, recovery environment, and independent non-game reuse fixture.
- [x] The release record lists precise reproduction commands and evidence; no unresolved ledger or identity corruption is carried into the social slice.

**Assignee:** Mohammad Safakhou

**Evidence**

- 29 Sep 2026: MNI-118 claimed In Progress by Mohammad Safakhou after all 27 dependencies were read Done in Linear. R01–R08 gate audit and release record under way; no gate acceptance claimed yet.
- 29 Sep 2026: e8a2be8 records the R01–R08 gate acceptance and precise reproduction at docs/implementation/reports/rules-gate.md. Reviewed playable VPS alpha-20260929-4/2143d92, catalog pact-s1-v1, command/event/API v1 schemas and 14 fingerprint guards, R01–R06 replay/fault/conservation fixtures, R07 actual local-model script-win comparison, R08 independent non-game fixture, PACT-048 Chrome matrix, fresh local restore and prior physical VPS Restic restore. Node 24.19 build/typecheck/lint, 175 unit and 226 PostgreSQL 17.11 integration tests, npm run check:non-game, node scripts/rehearse-rules-restore.mjs, and read-only VPS verify.sh passed. No known ledger/identity corruption; no pilot/fun/production certification. Linear both acceptance items checked and Done/assignee read back; comment 76c9b9f2-ff1e-4777-973a-e942455f04c0.
