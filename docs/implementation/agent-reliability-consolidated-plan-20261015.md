# Consolidated agent reliability and game analysis plan

Planning date: **15 October 2026, Europe/Berlin**. Status: **proposed and unstarted**. Founder authorization covers saving the consolidated plan and verified local documentation commits only. Implementation, deployment and experiments require a subsequent covering assignment.

This programme joins the fifty server Luna and twenty local Nemotron/Laya investigations into one architecture-level proposal: faithful owner intent, closed executable contracts, grounded references, deliverable observations and durable outcomes must work together before conclusions about agent incentives or provider quality are drawn. The [Fleet counterpart](../../../fleet/docs/agent-reliability-plan-20261015.md) owns controller tasks; this document owns PACT tasks and the shared programme boundaries/order. Each task scope has one owning document. Cross-repository dependency links refer to that owner rather than duplicating its acceptance definition.

Local IDs `AR-P01`–`AR-P11` and `AR-F01`–`AR-F11` are proposal IDs, **not Linear issues or active PACT tickets**. The linked task registers are the source of truth for this unactivated proposal. Existing `tasks.json`, Linear statuses/assignments and generated roadmap views remain unchanged; integration into an implementation batch needs its own assignment. No task is in progress or completed by saving this plan.

## Dated evidence and confidence

All evidence below is dated **14 October**, not a fresh 15 October runtime census. The [13 October plan](fleet-agent-investigation-plan-20261013.md) and its checkpoints remain historical context; this proposal does not rewrite them or revive stale runtime claims.

| Evidence population | Inspected release and settings | Established findings | Boundaries |
| --- | --- | --- | --- |
| Fifty original server accounts | Fleet b4ad9db, Luna medium, fifteen-minute stagger/anchor, two decisions/actions, 24,000-byte envelope; no optional cognition | [Causal report](reports/fleet-root-causes-20261014.md), committed 4ac274b; [census](reports/fleet-gameplay-investigation-20261014.md) and [roster](reports/fleet-agent-roster-20261014.md), committed 8450fef. Forecast omitted in 143 Agent 08 deliveries; all 106 sampled building refusals reproduce Iron headroom shortfalls; stale Farm wait, nil receipt loop and restart-related Agent 17 credential block traced. Agent 42 reached Hall III. | Packing/admission mechanisms are reproduced. Stale-note salience and exact historical offer exposure remain incomplete. Current ordinary 1,000-Iron ceilings prevent Hall IV, not Hall III. |
| Twenty original local accounts, ten per arm | Fleet 406d64b; Nemotron 4B, LLM-only versus cognition/Laya, common five-minute anchor 14 October 14:39:05.532 UTC | [Local failure investigation](../../../fleet/docs/fleet-failure-investigation-20261014.md): wrong root ambition lookup/legacy retrieval objective; four bad calls pass the open envelope; Agent 09 minimum reconstruction 24,238 bytes; twenty bad answers target ten outgoing requests and ten nonexistent IDs; all seventeen sampled waiting jobs have real stock/prerequisite gates, and active Mine/Wall complete. | UUID syntax did not explain sampled answers; not every scout refusal was replayed. Outside identities were delivered without successful external contact; no single cause explains all behavior. Closed-schema probe is synthetic, not provider certification. |

The shared API's worldwide discovery release on 14 October did not automatically upgrade the server b4ad9db adapter. Keep local outside-candidate delivery separate from the server's default cohort-name filter. Keep clocks, failure denominators, memory modes and configuration baselines separate. No new snapshots, inference or gameplay are part of this planning assignment.

## Architecture and shared interfaces

| Owner | Responsibility | Shared interface to review |
| --- | --- | --- |
| PACT | Authoritative rules, scoped world/intent/target facts, stock/provenance and spending ledgers, quotes/admission, canonical receipts/events/settlement, OAuth | Versioned owned views, authenticated operation names/schemas/auth conditions, typed references, exact quotes/denials, command versus downstream lifecycle, scoped rotation evidence |
| Fleet | Model inputs, context/memory selection, durable planning/outcome state, tool generation/validation/selection, scheduler/provider integration, credential/recovery coordination | Generic injected game ports consume reviewed facts/contracts and return precise outcomes; PACT types/conversions stay in `src/games/pact/` |

PACT application handlers and transactions stay authoritative across clients/MCP/other admitted interfaces. Fleet may reject a malformed or obviously ineligible proposal locally but cannot grant live permission, derive a second resource ledger or implement a second game engine. Existing fake second-game port coverage remains the portability control. The reviewed public contract export/live catalog is the runtime integration; Fleet never imports the game repository or connects to its database.

AR-02–AR-07 require **joint contract design** because schemas, current state, memory, errors and provenance compete inside one packet and one turn. Agree compatible field/version/coverage/error semantics before implementations diverge. Contract gates may be satisfied by review and faithful fixtures for already compatible interfaces; they do not require unnecessary game redesign. Additive PACT projections or changed semantics remain a cross-repository integration gate.

## Shared dependency order

| Work package | Result | Owning task pairs | Order |
| --- | --- | --- | --- |
| AR-01 | Faithful current owner intent and owned contract | AR-P01 / AR-F01 | First; intent/authority product decisions can be scoped early |
| AR-02 | Closed exact executable catalog/schema | AR-P02 / AR-F02 | After faithful intent; shared contract review |
| AR-03 | Fresh typed semantic references | AR-P03 / AR-F03 | After catalog/schema |
| AR-04 | Measured observations and deliverable memory | AR-P04 / AR-F04 | After grounded references; joint design with AR-05–07 |
| AR-05 | Durable evidence-linked decision state | AR-P05 / AR-F05 | Canonical outcome contract after AR-02; controller integration after AR-04 |
| AR-06 | Complete authoritative admission/quotes | AR-P06 / AR-F06 | After references/observations/outcomes |
| AR-07 | Precise command/auth recovery | AR-P07 / AR-F07 | Outcome/catalog branch; integrate before social lifecycle |
| AR-08 | Neutral actionable complete social lifecycle | AR-P08 / AR-F08 | After observations, admission and recovery |
| AR-09 | Feasible owner goal and authority decision | AR-P09 / AR-F09 | Complete after accurate quotes/social lifecycle; policy discussion may start early |
| AR-10 | Controlled provider/behavior/incentive qualification | AR-P10 / AR-F10 | Deterministic safety first; separately authorized model/world experiments after preceding gates |
| AR-11 | Separately reviewed rollout and preservation | AR-P11 / AR-F11 | After qualification evidence and explicit rollout assignment |

The exact acyclic dependencies are in the two owner registers below. They describe proposed integrated acceptance order, **not an activated execution queue**. Fleet-only contract/packet/state work may use the reviewed existing compatible API and fake providers without waiting for economic redesign. Optional AR-F10-P qualifies the provider protocol after its listed plumbing gates; economic world variants remain AR-P10. No branch implicitly authorizes inference.

## PACT proposed task register

| Local plan ID | Proposed deliverable | Dependencies for integrated acceptance | Status |
| --- | --- | --- | --- |
| [AR-P01](#ar-p01-faithful-owned-intent) | Faithful owned intent | None | Proposed / unstarted |
| [AR-P02](#ar-p02-canonical-operations-and-schemas) | Canonical operations and schemas | [AR-P01](#ar-p01-faithful-owned-intent) | Proposed / unstarted |
| [AR-P03](#ar-p03-scoped-semantic-reference-facts) | Scoped semantic reference facts | [AR-P02](#ar-p02-canonical-operations-and-schemas) | Proposed / unstarted |
| [AR-P04](#ar-p04-executable-compact-observation-sections) | Executable compact observation sections | [AR-P03](#ar-p03-scoped-semantic-reference-facts) | Proposed / unstarted |
| [AR-P05](#ar-p05-canonical-outcomes-and-lifecycle-evidence) | Canonical outcomes and lifecycle evidence | [AR-P02](#ar-p02-canonical-operations-and-schemas) | Proposed / unstarted |
| [AR-P06](#ar-p06-complete-admission-and-construction-quotes) | Complete admission and construction quotes | [AR-P03](#ar-p03-scoped-semantic-reference-facts), [AR-P04](#ar-p04-executable-compact-observation-sections), [AR-P05](#ar-p05-canonical-outcomes-and-lifecycle-evidence) | Proposed / unstarted |
| [AR-P07](#ar-p07-precise-authentication-and-recovery-evidence) | Precise authentication and recovery evidence | [AR-P02](#ar-p02-canonical-operations-and-schemas), [AR-P05](#ar-p05-canonical-outcomes-and-lifecycle-evidence) | Proposed / unstarted |
| [AR-P08](#ar-p08-actionable-social-lifecycle-views) | Actionable social lifecycle views | [AR-P04](#ar-p04-executable-compact-observation-sections), [AR-P05](#ar-p05-canonical-outcomes-and-lifecycle-evidence), [AR-P06](#ar-p06-complete-admission-and-construction-quotes), [AR-P07](#ar-p07-precise-authentication-and-recovery-evidence) | Proposed / unstarted |
| [AR-P09](#ar-p09-goal-and-authority-feasibility) | Goal and authority feasibility | [AR-P06](#ar-p06-complete-admission-and-construction-quotes), [AR-P08](#ar-p08-actionable-social-lifecycle-views) | Proposed / unstarted |
| [AR-P10](#ar-p10-controlled-world-and-incentive-evaluation) | Controlled world and incentive evaluation | [AR-P09](#ar-p09-goal-and-authority-feasibility), [AR-F09](../../../fleet/docs/agent-reliability-plan-20261015.md#ar-f09-feasible-owner-goals) | Proposed / unstarted |
| [AR-P11](#ar-p11-reviewed-game-rollout-and-preservation) | Reviewed game rollout and preservation | [AR-P10](#ar-p10-controlled-world-and-incentive-evaluation), [AR-F10](../../../fleet/docs/agent-reliability-plan-20261015.md#ar-f10-controlled-provider-and-behavior-evaluation) | Proposed / unstarted |

## PACT task scope and acceptance

### AR-P01 Faithful owned intent

Owner: PACT. Status: **Proposed / unstarted**. Shared work package AR-01. Counterpart: [AR-F01](../../../fleet/docs/agent-reliability-plan-20261015.md#ar-f01-faithful-owner-guidance).

Document and version the authenticated owned-view contract containing the actual root `world.ambition`, its absence semantics and freshness. Identity/portrait in `world.profile` must not be confused with owner intent. Review faithful sanitized real-response fixtures with Fleet; replace identifiers and prose without moving fields or changing types. Preserve historical objectives/notes as provenance-labelled history.

Acceptance:

- A real-layout fixture exposes root ambition; a wrong-profile fixture cannot certify intent delivery. Empty/missing intent is explicit, not a fabricated strategy.
- Contract tests cover a changed owner objective, owner/audience scoping and compatible older responses. Changes propagate to the inputs checked in AR-F01.
- Documentation identifies the owning projection and version policy without changing a live account's ambition or authority.

### AR-P02 Canonical operations and schemas

Owner: PACT. Status: **Proposed / unstarted**. Shared work package AR-02. Counterpart: [AR-F02](../../../fleet/docs/agent-reliability-plan-20261015.md#ar-f02-closed-executable-decisions).

Publish a reviewed canonical operation registry through shared contracts and the authenticated live catalog: exact names, argument schemas, contract versions and authorization requirements. All interfaces continue invoking the same application handlers. Distinguish capability advertisement from live admission; do not expose unauthorized private operations. Agree the closed-generation and error contract with AR-F02 before adopting new versions.

Acceptance:

- Export/catalog parity covers admitted reads/actions and their exact required fields, additional-property policy and version requirements. Compatible old clients retain documented behavior; unsupported versions fail precisely.
- Four archived synthetic bad calls and a legitimate building command remain a shared acceptance corpus. Fleet rejects the bad calls at its generation/validation boundary while PACT independently rejects any that reach it.
- Invented conversation names, extraneous action `summary` and missing message body yield bounded field/schema-specific diagnostics. No transport implements a second permission gate or game engine.

### AR-P03 Scoped semantic reference facts

Owner: PACT. Status: **Proposed / unstarted**. Shared work package AR-03. Counterpart: [AR-F03](../../../fleet/docs/agent-reliability-plan-20261015.md#ar-f03-grounded-typed-references).

Provide caller-authorized facts for Request, Kingdom, Unit, Offer and Receipt references, including role, direction, status, version and observation time. Keep the server's existing ownership/state checks authoritative. An incoming pending introduction eligible under delegation differs from an outgoing request. Ordinary eligible Spearmen differ from Home Guard and unavailable committed units.

Acceptance:

- Controls cover outgoing, nonexistent, expired, wrong-type and stale-version targets; revoked delegation; unavailable/incorrect troops; and a valid incoming answer/scout target.
- UUID syntax and semantic eligibility are tested separately. Nil/placeholder receipt IDs do not establish a command, uncertainty or ownership.
- Authorized projections expose sufficient follow-up references without leaking another account's requests, units, private offers or receipts. Fake-ID enumeration has no private-state oracle.
- Shared fixture roles/direction agree with AR-F03; no bad reference is silently replaced with a guessed valid one.

### AR-P04 Executable compact observation sections

Owner: PACT. Status: **Proposed / unstarted**. Shared work package AR-04. Counterpart: [AR-F04](../../../fleet/docs/agent-reliability-plan-20261015.md#ar-f04-measured-observation-and-memory-envelope).

Design semantic, scoped narrow/paged reads for forecasts, construction state, incoming requests and agreement terms. Expose exact usable selectors/cursors and coverage with observation time, record identity and version. A generic instruction to request an unsupported section is not a usable API. Agree minimum current facts and field priorities with Fleet's measured packet contract, rather than relying on response object order.

Acceptance:

- Forecast-only and construction/request/agreement reads are executable against their published schemas. Agent 08's requested forecast can reach AR-F04 under the existing 24,000-byte full-envelope allowance.
- Paging/omissions distinguish unknown records from empty collections; required terms, parties, direction, versions, deadlines and signature status remain whole when delivered.
- Ownership, revoked access, stale cursor/version and privacy controls pass. Older broad reads remain compatible under a reviewed additive/versioned contract.
- Large shared histories are read selectively; compact views do not create a new private message store or misleading complete-coverage claim.

### AR-P05 Canonical outcomes and lifecycle evidence

Owner: PACT. Status: **Proposed / unstarted**. Shared work package AR-05. Counterpart: [AR-F05](../../../fleet/docs/agent-reliability-plan-20261015.md#ar-f05-durable-decision-state-and-outcomes).

Define the authoritative event/receipt fields needed for durable replanning: exact command reference, outcome classification, explicit denial, committed effects and downstream job/contract state. Keep shared transaction/outbox processing and the canonical receipt ledger. Command processing is separate from building completion or contract settlement. Coordinate these fields with AR-F05's persisted decision state.

Acceptance:

- A committed queue receipt can coexist with waiting/active work; a later completion is separately observed. Agreement signatures, activation and fulfillment/end are distinct states.
- Known rejection, ordinary failed read, absent receipt and genuinely unresolved command remain distinct. An absent receipt does not fabricate a commit or uncertain-command record.
- Duplicate events, lost acknowledgment, expired cursors and replayed receipt reads converge without duplicate effects. Existing IDs/history remain usable.
- Outcomes are scoped and versioned; migration/retention plans preserve existing receipts and registered data classes, without logging private prompts.

### AR-P06 Complete admission and construction quotes

Owner: PACT. Status: **Proposed / unstarted**. Shared work package AR-06. Counterpart: [AR-F06](../../../fleet/docs/agent-reliability-plan-20261015.md#ar-f06-consume-authoritative-admission-quotes).

Provide server-owned scoped quotes separating usable stock and founding/ordinary provenance; prerequisites; builders and ordinary-unit availability; reserve floors; rolling 24 GAME-hour authority; outstanding reservations; human-only requirements; release boundaries; and state/mandate/rules versions. Recheck atomically at commit. Preserve `INSUFFICIENT_ALLOWANCE` and other precise denial causes instead of collapsing them into generic FORBIDDEN. Fleet consumes these facts; it cannot authorize from a cached quote.

Acceptance:

- Reproduce all 106 historical Luna quota refusals with correct spend/reservation/game-time accounting; include Agent 02/32 reservation cases and within-limit positive controls.
- Reproduce all seventeen local waiting orders: twelve LLM-only and five cognition orders, with overlapping stock/prerequisite counts. ZERO Iron/Silver reserve floors are not labelled a positive restriction. Completed Mine/Wall controls establish normal start/settlement.
- Waiting reserves authority, not stock. Concurrent construction can consume usable stock; queue admission, waiting, active and completed are distinct. Show all limiting conditions and conditional game-time release/ETA, including paused-clock behavior.
- Stale/racing quotes fail safely at admission without duplicate stock/spend/receipt effects. No cancellations, ceiling relaxation, new economy or second client permission system is inferred from legitimate waits.

### AR-P07 Precise authentication and recovery evidence

Owner: PACT. Status: **Proposed / unstarted**. Shared work package AR-07. Counterpart: [AR-F07](../../../fleet/docs/agent-reliability-plan-20261015.md#ar-f07-precise-command-and-credential-recovery).

Review OAuth rotation/receipt recovery semantics with Fleet. Where supported, provide scoped evidence distinguishing confirmed pre-rotation nonexecution, confirmed rotation, unknown rotation and revocation. Keep grants/scopes, refresh-family security and server-derived principals intact. Any evidence endpoint must avoid token exposure or a public credential-validity oracle.

Acceptance:

- Fixtures cover connection refused before processing, generic 502 with ambiguous processing, rotation with lost acknowledgment, concurrent refresh, revoked grant/family and stale fences.
- Agent 17's dated incident retains the connection-refused/unused-token evidence. A generic 502 alone is not proof of nonexecution and cannot authorize retry.
- Only confirmed nonexecution permits a bounded safe retry under the same account. Unknown rotation requires quarantine/reconnect preserving identity/history; unknown commands use original pending receipts, without replay or fabricated usage.
- Ordinary not-found reads and explicit denials are precise noncommit outcomes. Shared OAuth/receipt services remain authoritative; recovery evidence is minimal, scoped and retained under policy.

### AR-P08 Actionable social lifecycle views

Owner: PACT. Status: **Proposed / unstarted**. Shared work package AR-08. Counterpart: [AR-F08](../../../fleet/docs/agent-reliability-plan-20261015.md#ar-f08-neutral-actionable-social-attention).

Provide compact authorized parties, requests, offers, signatures and obligations with direction, complete terms, version, GAME-time expiry and lifecycle references. Preserve neutral world discovery and privacy. Support discover/contact/propose/respond/sign/activate/fulfill/end observation through existing handlers. Coordinate urgency/opportunity coverage with AR-F08 without prescribing whom an agent must contact.

Acceptance:

- Scripted isolated beneficial and bad trades exercise delivery, response, signatures, activation, fulfillment/end and valid decline/solo play; compare material benefit to a stated solo baseline.
- Deadline controls cover two-decision cross-turn handoffs, game-clock pauses and opportunity delivery before expiry. Seeing a peer-read notice alone cannot count as full actionable offer delivery.
- Fake IDs, wrong participants, stale terms/version, revoked access and private outsider data fail safely. Public presence does not promise a reply.
- Preserve the 13 October 19-to-17 gift's four eligible turns and unresolved full-term delivery. Six-hour/zero-notice terms are valid; the exact malformed fields in Agent 03's failed offers remain unknown. No settlement bug, outreach quota, autoaccept, partner class or advertising is inferred.

### AR-P09 Goal and authority feasibility

Owner: PACT. Status: **Proposed / unstarted**. Shared work package AR-09. Counterpart: [AR-F09](../../../fleet/docs/agent-reliability-plan-20261015.md#ar-f09-feasible-owner-goals).

Produce a rules-derived progression/authority table and explicitly identify objectives unsupported by current mechanics or delegated authority. Hall III costs 540 Iron and can fit the original 1,000 ceiling when headroom permits; Hall IV 1,260, V 2,700 and VI 4,500 exceed it. Define the owner decision among a constrained goal, exact human approvals or reviewed bounded higher ceilings; derive a proposed limit from intended actions/cadence/reservations rather than silently granting unlimited authority.

Acceptance:

- Every declared test goal is feasible under its actual stock/prerequisite/authority path or has an explicit unresolved owner decision. Prohibited objectives are not scored as agent failure.
- Quote arithmetic distinguishes whole resource units from ledger units, full ceiling from rolling headroom, and I–II/III–IV/V–VI comparison bands from promotion payouts.
- Unsupported territory expansion and autonomous Court lifecycle are labelled unavailable. Political/economic rule changes require a separate reviewed product/specification assignment.
- An approved authority alternative would need scoped fixtures, versions and rollback; this plan changes no mandate, rules, account or permission.

### AR-P10 Controlled world and incentive evaluation

Owner: PACT. Status: **Proposed / unstarted**. Shared work package AR-10. Counterpart: [AR-F10](../../../fleet/docs/agent-reliability-plan-20261015.md#ar-f10-controlled-provider-and-behavior-evaluation).

Specify isolated independent world replicas and fixed seeds for symmetric self-sufficient founders, complementary needs, overflow, profitable/bad trades and later development. Deterministic providers first prove plumbing and safety. Separately approved bounded model qualification and behavior runs follow, varying one factor at a time before focused interactions: schema, delivery, state, owner intent, attention, protocol/sampling/model, decision allowance/cadence and economics.

Acceptance:

- Scenario definitions, independent units of comparison, randomization/replication and held-out cases are fixed before results. Shared-world interference is not presented as independent-agent causal evidence.
- Measure legal goal completion, material kingdom benefit versus solo, fulfilled obligations, justified waits, latency, stage-specific failures and denominators, and token/call cost per useful outcome. Message count is not a target.
- Farm I's 30 Grain/hour minus eight Guard upkeep and absence of a promotion payout are baseline facts, not proof that profitable cooperation is impossible or Luna intrinsically fails.
- Future privacy-safe instrumentation records field paths, schema IDs and delivery coverage with minimal retention, not raw private prompts/secrets. Exact invalid-offer fields and historical model-visible term coverage remain unresolved until new authorized evidence exists.
- Any economic/political variant requires explicit reviewed specifications and bounded experiment authorization; no rule change or live run is a plan default.

### AR-P11 Reviewed game rollout and preservation

Owner: PACT. Status: **Proposed / unstarted**. Shared work package AR-11. Counterpart: [AR-F11](../../../fleet/docs/agent-reliability-plan-20261015.md#ar-f11-reviewed-controller-rollout).

Prepare a future release proposal with exact source versions, cross-repository compatibility, migration/retention review, scoped canary accounts, call/token limits, deadlines, monitoring, stop conditions and rollback. Quiescence includes credential activity as well as in-flight model calls and commands. Coordinate the controller release and preservation checks with AR-F11.

Acceptance:

- Rehearsed migrations/rollback preserve account/kingdom bindings, mandates, receipt IDs, jobs, history, original schedules/anchors/models/budgets and unknown allocations. Rolling back code does not undo committed game effects or restore an old database over newer transactions.
- Canary acceptance includes multiple rounds with growing memory and authoritative progression/obligation readback, rather than first-round delivery alone. Results are separately recorded for fifty Luna and twenty local agents.
- Pending/unknown states retain originals and their required review. Terminal populations remain terminal; no new accounts or restart is implicit.
- Implementation, hosted tests, experiments, deployment and push each require their covering assignment. Saving this plan authorizes none of them.

## Authorization migration and rollback gates

Preserve the fifty Luna and twenty local account/kingdom bindings, original schedules/anchors, selected models/thinking/provider settings, mandates, budgets, history, unknown compute allocations and exact pending command/receipt IDs. Preserve older Mac and terminal experiments separately. No implementation, provider/account migration, configuration change, gameplay command, cancellation/replay, reconnect, unknown-usage review, account enrollment or execution start is authorized here.

Any future data/contract change needs version compatibility, migration, registered retention and rollback review in its owning task. Dry-run with synthetic data; compatible older views must be explicit. Restore/revert cannot discard later committed transactions, resurrect terminal runs, clear uncertainty or replace identities. Actual deployment requires a reviewed quiescent boundary covering credentials, calls and commands, then independently bounded cohort-specific canaries. Push and hosted acceptance remain separate authorization/evidence.

Current economics are preserved. Hall-band filters and cosmetic awards are not promotion payouts; scarce military food demand is absent in the inspected passive founder state. Complementary bottlenecks, overflow and later development may still reward cooperation. Economic/political changes wait for reliable perception/execution and explicit specification review, not a default goal to increase chat. Exact malformed offer fields, complete historical model-visible terms and the contribution of provider/attention/notes to observed behavior remain open research questions.

## Planning verification

Before committing these documents, resolve cross-repository links/anchors and every dependency ID, check acyclicity and complete eleven-package coverage, compare requirements to both dated investigations, confirm proposed/unstarted status and unchanged tracker/specification files, run the existing PACT backlog consistency check and scoped `git diff --check`. Those checks validate a saved plan, not proposed runtime acceptance. Application/hosted tests, paid generation, world simulations, release rehearsal and canaries are future gated work.
