# PACT and Fleet agent investigation plan

**Prepared:** 13 October 2026. **Status:** proposed investigation.

Covers PACT and the independent sibling `fleet` repository. The behavioral baseline is the 50-account Luna cohort observed on 12 October 2026 at 22:16 Berlin. Implementation, live experiments and changes to authority or game rules remain proposed.

## Assessment and evidence boundaries

**The evidence supports a combined explanation: information and recovery defects suppress competent play; the early economy supplies little need for cooperation; and some political mechanisms are deliberately unavailable to unattended agents.** Fixing only the prompt, increasing message frequency, or changing the model would not isolate these causes.

This document is an investigation plan and a deeper analysis of the inspected implementation. It does not certify that every bug has been found. The completion standard is explicit coverage of critical invariants, reproducible disposition of observed failures, and measured behavioral improvement with remaining uncertainty documented.

Live evidence comes from the frozen **12 October 2026, 22:16 Berlin** snapshot, approximately seven hours after the 50-account cohort began. It is not a fresh 13 October status check. Fleet and game snapshots were less than one second apart. Source analysis was extended on 13 October. Repository heads were Fleet `f6d7aa9` and PACT `50f6870`; the earlier review found their differences from inspected deployed revisions were documentation only. No live gameplay, inference experiment, permission expansion, code change or deployment was performed for this plan.

The prior packing diagnostic reconstructed inputs using the deployed code and authenticated read results without model inference. It demonstrates that results can disappear, but is not a byte-for-byte capture of the historical model prompt. Behavioral summaries are recorded decisions and outcomes, not access to hidden model reasoning.

## Where the observed behavior stops

| Stage | Frozen cohort evidence | Meaning |
| --- | --- | --- |
| Execution | 50 accounts; 1,316 turns, including one running; 2,055 reported model calls; approximately 32.56 million reported tokens. | The controller is active. Model usage and server health do not establish useful decision making. |
| Progress | 213 committed gameplay actions; 148 completed upgrades. Eight accounts had no committed gameplay action. In the last four hours, 724 of 799 completed turns had no action. | There is a substantial progress problem. Waiting can be rational, so no-action rate alone is not a failure criterion. |
| Discovery and contact | 23 introduction requests: seven accepted and 16 still pending. Seven contact relationships involved 11 accounts. | Measure exposure, acceptance and reply separately. Pending at one snapshot is not a demonstrated delivery failure. |
| Conversation | Seven unique messages, sent by only accounts 17 and 19; six were between that pair. Account 17 also messaged 38. | Observed copies on both sides were deduplicated. This is a very small interaction sample. |
| Commitment | No supply offers, contracts, transfers, training, scouting, raids or garrison activity. | The pipeline stops before formal offers. Contract-expiry defects cannot explain already-expired offers here: none existed. |
| Development | 48 Hall I kingdoms and two Hall II kingdoms. All 50 remained in the I–II comparison band. | A Hall II upgrade is progress but does not enter the next bracket. |

The merchant group sent no messages; the diplomat group sent four, all from one account. These are descriptive observations, not a randomized estimate of personality effects. Agents shared the same model and economy and were affected by different context histories.

Instrumentation should follow: **opportunity exists → opportunity reaches model → chosen read/action → valid command → contact accepted → reply → exact offer → signatures → deliveries → benefit relative to solo play.** A failure at one stage must not be diagnosed as lack of motivation at another.

## Priority defect and constraint register

| Priority / status | Finding and evidence | Investigation and exit condition |
| --- | --- | --- |
| P1 · reproduced packing defect | A newly requested read competes with old optional cache. In reconstructed account 04 inputs, a 55-byte inbox result disappeared while an old guide remained; account 03 lost a fresh guide. [1](#source-1) | Freeze those inputs as regressions. Capture selected read, returned result and next serialized input. Pass: the requested result, or a usable explicit narrowing response, reaches the next decision; old optional memory cannot silently displace it. |
| P1 · confirmed persistence mismatch | Projection keeps up to four rule/schema and four state entries, but storage applies `reads.slice(-3)`. Documented retention and actual persistence disagree. [2](#source-2) | Test a complete write/read round trip, not only projection helpers. Pass: the specified schema/state retention policy survives storage, eviction, expiry and restart. |
| P1 · confirmed integration mismatch; live recovery impact | Fleet treats most `game.*` actions as agent-capable. PACT makes building cancellation, training cancellation, troop disbanding and garrison seizure human-only. Five live construction states had both builder queues blocked on prerequisites. [3](#source-3) | Generate an action-by-principal-by-mandate capability matrix against real handlers. Replay accounts 15/21/26/36/43. Pass: the advertised route is executable or explicitly requires an owner; no false autonomous cancellation advice. Decide separately whether cancelling unstarted agent orders should be delegable. |
| P1 · observed planning/recovery failure | Waiting orders can occupy the paths needed to construct their own prerequisites; e.g. Hall II waits for Barracks II while both waiting slots are occupied. This is a permitted game state, not proof of corrupt construction accounting. [4](#source-4) | Build dependency and slot graphs from every frozen kingdom. Test queue, completion, cancel and replan paths. Pass: impossible passive waits are detected and a legal recovery or owner handoff is surfaced; ordinary temporary waiting remains allowed. |
| P1 · observed error class; exact causes incomplete | Recurring invalid tool arguments affected accounts including 13/18/47. Exact rejected arguments are not consistently recorded before validation. Read schemas generally require a lookup. [5](#source-5) | Record sanitized attempted args, schema version/digest and field-level validation errors before rejection. Replay each failure through the actual schema, defaults and server. Pass: every captured rejection is attributable; correctable errors can be corrected within remaining allowance. |
| P2 · reproduced lossy projection; behavioral causality open | A 17.5 KB decision-support response retained only two of 20 detailed candidates in the checkpoint; later packing also narrowed its candidate index. Alphabetic ordering favors early building entries. [6](#source-6) | Test all action families and pagination under actual 24 KB envelopes. Pass: compact indices preserve actionable discovery or reliable pagination; a targeted candidate survives; repeated compaction does not falsely claim complete coverage. |
| P2 · observed stale continuation | Some saved notes continue to wait for completed construction or for Grain that is already above the floor. Notes have no explicit validity conditions. [7](#source-7) | Replay accounts 11/16 and stale-note fixtures. Compare fresh facts with note creation time and expected event. Pass: obsolete intentions are invalidated; legitimate conservation remains a permissible choice. |
| P2 · observed route confusion | Account 34 waited on disabled internal `api-inference` hosting while external Fleet execution was working. [8](#source-8) | Trace the status read into its visible context. Pass: internal-host availability is clearly distinct from the current external executor and cannot be interpreted as a global prohibition on gameplay. |
| P2 · confirmed mandate asymmetry; unexercised | All 50 mandates include `supply.sign` but omit `supply.break`; they omit `garrison.sign` and `garrison.break`. Thus signing supply is delegated, voluntary early exit is not, and troop-lending signatures lack authority. [9](#source-9) | Audit full commitment lifecycles: create, sign, revise, withdraw, notice, release, default and expire. Pass: agents see entry and exit permissions before commitment. Any change to delegation is a product/owner decision, not an implicit permission expansion. |
| P2 · latent timing hypothesis | Offers default to 15 game minutes; Fleet wakes each account every 15 wall minutes with only two model decisions per turn. Schema discovery, reading and responding may require another turn. [10](#source-10) | Replay phase offsets and remaining TTL using the actual wall/game clock mapping. Measure offer seen before expiry and all required signatures. Compare 15 vs 60 game-minute TTL and event-aware scheduling separately. No claim of observed expiry losses in this cohort. |
| P2 · visibility and scheduling hypothesis | Only five action schemas are included up front; supply actions need lookup. Public discovery shows a rotating small page; peer-history observation rotates one contact per turn. Compact facts omit military details and live rank feedback. [11](#source-11) | Measure which actionable records actually reach each decision, including busy inboxes and contacts beyond the first page. Pass: pagination is reachable, urgent requests do not starve, and equal budget comparisons reveal any opportunity bias. |
| P3 · confirmed documentation inconsistency | The rulebook still says a founder can trade before affording a cold message, despite the newer free-introduction policy. [12](#source-12) | Search active instructions, schemas, guides, examples and tests for obsolete pricing/authority claims. Pass: normative sources agree; separately determine whether any stale text reached models. |

**P1** means investigate before trusting new behavioral experiments; **P2** follows once basic action and observation fidelity is established. A design constraint is not automatically a bug to remove. Static mismatches still need integration regressions; possible causes must remain labeled until tested.

## Why communication may have little value in the current game

**1. New kingdoms have the same productive capabilities.** Every founder produces Iron, Silver and Grain and receives construction allowances. Different choices can eventually create different needs, but the rules do not give new players intrinsically different resource endowments or production specialties. Trade must overcome search, trust and coordination costs before it improves on waiting for automatic income. The Market building produces Silver; it does not match buy and sell orders. [13](#source-13)

**2. The advertised common pressure does not bind passive founders.** At normal harvest Farm I produces 30 Grain/hour and eight Home Guard consume 8, leaving 22. At the worst 80% harvest, 24 − 8 still leaves **16 Grain/hour**. This calculation excludes exports, additional troops and other spending. Waiting for low harvest will not by itself make these founders need imports. The documented 120-Grain/hour military example creates scarcity, but this cohort had trained no troops. [13](#source-13)

**3. Fortune directly rewards accumulated wealth, not interaction.** The weights are Iron 1, Silver 2, Grain 0.25. Production adds wealth; ordinary-funded construction converts stock into installed value instead of destroying that marked wealth. Ignoring capacity and other changes, Mine I→II adds 10 Fortune/hour of production, Market I→II adds 10, and Farm I→II adds 3.75 at normal harvest. Farm and Barracks still have prerequisite value. These numbers explain a strong solo-development baseline; they are not a proof that a particular build order is optimal. [14](#source-14)

**4. A trade does not create extra points merely by occurring.** Exchanging 4 Grain for 1 Iron transfers equal marked value. Before losses or later use, the two participants’ combined marked wealth is unchanged. Trade can still create real gains by accelerating productive upgrades, reallocating scarce inputs, reducing overflow, preserving an army or supplying protection. Both sides’ benefit must be shown against their alternatives over time; an immediate fixed-score exchange cannot increase both players’ points simultaneously. Gift pooling can raise a recipient’s rank, but gives a self-interested donor no automatic reciprocal benefit. [14](#source-14)

**5. Higher brackets are comparison filters, not promotion rewards.** Hall III moves a player from I–II to III–IV; Hall V moves it to V–VI. There is no communication condition, promotion payout, or bracket-based military protection. Fortune follows the player. Remaining in a weaker comparison band can even be strategically attractive, which the rulebook explicitly acknowledges. If the desired behavior is “negotiate your way upward,” that goal is not currently encoded by bracket membership. [15](#source-15)

**6. Political institutions have limited mechanical power.** Courts provide social organization but do not own treasury resources or troops, enforce an alliance, or automatically share intelligence. Allegiance does not confer immunity, tribute or command authority. Relationships may matter through separately negotiated actions and reputation, but membership alone does not supply material returns. Changes also require human decisions under the present model. [16](#source-16)

**7. Risk and asynchronous execution can make solitude reasonable.** A supply contract is not guaranteed atomic barter: one party may deliver on the same tick that the other defaults. Bonds, reserve floors, stock uncertainty and partner reliability matter. Public profiles do not reveal every counterparty’s private economy. Some discovery communication has informational value, but abstract “what are your goals?” exchanges may fail to discover a trade that changes either player’s next decision. [17](#source-17)

**Current inference:** the game permits useful bilateral cooperation, but does not yet establish that communication should dominate early optimal play. The frozen run is too young and too affected by execution defects to establish later equilibrium or prove that the economy cannot support a political society.

## Agent goals memory tools and freedom

**Goal grounding.** The five profiles express broad preferences, with risk tolerance and horizon labels. None explicitly instructs the agent to maximize Fortune or reach a specified Hall band by a deadline. “Expansionist” asks for territory, although there is no territorial map or conquest mechanism. “Diplomat” asks for institutions while major institutional actions require a human. The observed conversation repeats “territory and influence,” which is evidence of this vocabulary mismatch, not proof that the model understands a nonexistent mechanic. Test a shared, game-valid objective with persona preferences layered underneath; keep the original profiles as a control. [18](#source-18)

**Continuity.** Each decision is a fresh model execution. Continuity depends on supplied observations, notes and summaries. The system does not train a policy from accumulated outcomes, and more elapsed turns do not by themselves produce learning. A checkpoint that stores a read but fails to deliver it to the next model call breaks the intended observe–act–evaluate loop. Add structured continuation records containing the objective, dependency, last evidence, next step and invalidation condition; test whether they improve behavior rather than assuming a longer journal helps. [19](#source-19)

**Decision budget.** Two calls can be consumed by “lookup read schema” and “perform read,” leaving no action decision. Cross-turn continuation must work for this to be useful. Fresh facts are large, while action schemas for building and contact moves are supplied directly and contract schemas are not. That is a potential architecture-induced preference for construction and simple messages. First repair context fidelity, then compare schema packaging and budget separately. Increasing the budget alone could simply buy more repeated reads.

**Agency is asymmetric.** The server allows some commitments while reserving recovery and politics for humans. Authority boundaries are legitimate; the defect is advertising unavailable actions or silently stranding an unattended policy. The required product decision is explicit: is PACT an assistant acting for a present human, or can these test accounts delegate complete bounded gameplay lifecycles? A synthetic experiment can use explicit narrow owner policies without making that the default for real players.

**Measure outcomes, not conversation volume.** A short rejection of a bad deal may outperform a long negotiation. A useful message reveals a need, changes a quote, coordinates an action, or establishes a verifiable commitment. A legal decision, successful JSON parse, delivered message and completed contract are four different success levels. Do not use the model’s own explanation as the sole judge of economic benefit.

## Investigation sequence and deliverables

| Stage | Concrete work | Exit gate / output |
| --- | --- | --- |
| 1 · Freeze and reconcile | Refresh read-only Fleet/game snapshots at execution time. Record deployed SHAs, rules/schema versions, model route, budgets, mandates, schedule phases and wall↔game clock mapping. Reconcile all 50 identities, command IDs, receipts, turn actions and usage. Preserve the October 12 baseline. | Versioned evidence bundle and per-account causal timeline. Explain denominator differences and distinguish pre/post-deployment behavior. No raw credentials in fixtures. |
| 2 · Reproduce the failures | Create minimal isolated fixtures from accounts 03/04/12, 15/21/26/36/43, 16/34 and 13/18/47. Trace exact input construction, storage round trips and action authority. Add regressions where each bug enters, plus end-to-end tests through the real adapter and PACT handlers. | Each confirmed bug has failing-before/passing-after evidence, an owning repository, severity and scope. Unproven cases retain hypotheses and missing evidence. No production repairs are implicit in the plan. |
| 3 · Audit engine invariants | Run targeted deterministic and state-machine tests across construction, economy, contracts, troops, combat, authority, clock, rank and recovery. Exercise real PostgreSQL transactions in isolated test databases. Use generated sequences and concurrent requests for cross-system edges. | Coverage matrix with test evidence and unresolved cases; critical financial/resource/authority invariants pass. Existing unit tests are supporting evidence, not a substitute for cross-repository acceptance. |
| 4 · Establish economic baselines | Run the actual rules engine with controlled clocks. Compare passive, deterministic solo builder and scripted negotiating policies under identical information constraints. Calculate development, scarcity, storage overflow, upkeep and contract cash flows through early growth and low harvest. | A baseline showing when cooperation has positive value, who benefits, and over what horizon. Distinguish forecast, simulated engine outcome and live result. |
| 5 · Run causal agent experiments | Use corrected observation/authority plumbing as the baseline. Vary context, goal wording, schemas, schedule, model and economic opportunity one factor at a time; then run the focused interaction matrix below. Use independent world replicas to avoid treatment spillover. | Effect sizes, uncertainty, usage and failure categories. Reject changes that only increase chatter or compute. Keep development scenarios separate from held-out scenarios. |
| 6 · Make design decisions and validate | Select the smallest evidenced implementation or rule changes. For any later live rollout, define the exact accounts, compute allowance, changes, monitoring and rollback in a separate execution proposal. Validate preservation of identity, budgets, pending commands and receipts. | Prioritized implementation backlog with measurable acceptance criteria. A later controlled canary compares against the refreshed baseline before broad rollout. |

The immediate first milestone is stages 1–2, especially fresh-read delivery, persistent memory and the real permission matrix. Game-balance changes should wait until agents can reliably perceive and execute a known useful opportunity.

## Engine audit coverage

| Area | Properties and edge cases to verify |
| --- | --- |
| Turn execution and accounting | Concurrent workers cannot execute one claim twice; stale fences cannot write; reservations and reported use stay distinct; uncertain model usage follows the declared recovery policy; pause/restart and missed slots do not create a catch-up storm. |
| Commands and transactions | Lost response → same command ID → one receipt and one effect. Duplicate and concurrent submissions cannot double-spend, double-consume authority, or publish an outbox event without the corresponding committed state. Distinguish explicit denial from unknown outcome. |
| Context and memory | Every chosen read can inform the next decision; fresh and cached evidence remain distinct; timestamps and coverage survive compaction; schemas stay executable; cross-account memory is impossible; paging and defaults are consistent between local validation and server. |
| Authority and recovery | Advertised action × human/agent principal × mandate × scope × lease matches actual admission. Include cancellation, disbanding, contact answers, unsigned offers, signatures, notices, mutual releases and changed/revoked mandates. |
| Construction and resources | Prerequisite and slot graph reachability; start-time payments; free unstarted cancellation and active refund provenance; no conversion of grants to transferable stock; caps, fractional internal units, waiting authority exposure and allowance expiry. |
| Trade and diplomacy | Contact acceptance/blocking, recipient visibility, per-page completeness; offer parties and A/B perspective; exact versions and stale signatures; expiry; bond limits; per-minute flows; independent delivery obligations; proportional default; floors and same-tick funding restrictions. |
| Troops, intelligence and combat | Home Guard restrictions; queue ownership/capacity; one placement per troop; battle locks; death across overlapping battles; garrison feeding/returns; scout visibility; coalition admission and withdrawal; provisions, casualty and loot accounting. |
| Time and season | Game vs UTC time, suspension/resume, tick catch-up, strict next-boundary semantics, season rollover, harvest changes, grant expiry, notice/offer boundaries and upkeep-before-combat ordering. |
| Fortune and incentives | Stock/cost/troop provenance, no double-counted bonds or costs, transfer conservation, grant exclusion, highest Hall band, hourly vs provisional scores, exact age-seven-day snapshots, ties, minimum eligible population and cosmetic-only awards. |
| Observation and evaluation | Deduplicate sent/received message copies; distinguish an accepted command from a completed build or delivered contract; sanitize denied arguments; avoid marking all reads/waits as failures; validate summaries against receipts and resource ledgers. |

Reuse the existing Fleet context/engine/scheduler/recovery tests and PACT building, authority, supply, Fortune and season suites. Existing society evaluation tests use synthetic episodes and fixture policies; relationship-load tests verify bounded reads and privacy. Neither proves that autonomous model players negotiate profitably in the live economy. [20](#source-20)

## Experiments that separate the competing explanations

| Experiment | Controlled comparison | What the result tells us |
| --- | --- | --- |
| A · observation fidelity | Same frozen situations, model, objectives, allowance and rules; existing vs corrected context/persistence. Deterministic provider stubs verify plumbing first; actual model repetitions measure decisions separately. | If repeated reads fall and known actionable responses rise, infrastructure was suppressing agency. If not, inspect schemas/objectives before assigning the effect to game incentives. |
| B · objective grounding | Corrected runtime; original personas vs explicit Fortune/development objective with the same risk preferences and a finite evaluation horizon. | Tests whether “higher rank/bracket” is absent from the actual goal. Does not create economic incentives or establish that communication is useful. |
| C · opportunity × interaction | Whole-world replicas with (i) symmetric founders and (ii) controlled complementary needs. Within each, compare no peer interaction, structured offers only, and free text plus structured offers. Keep non-social actions and total compute allowance comparable. | Separates the value of counterparties, contract tools and language negotiation. Structured-only success with free-text failure suggests protocol/planning overhead; no interaction benefit even for strong baselines suggests weak opportunity design. |
| D · scheduling and negotiation | Use a profitable known trade. Vary 15/60 game-minute expiry and periodic/event-aware scheduling independently. Include all signature steps, schema reads, worker delays and clock speed. | Tests whether multi-turn negotiations reliably fit the available window. An ideal zero-latency trade does not validate real Fleet timing. |
| E · planner strength | Same corrected inputs and budget; current model vs a stronger planner and a deterministic valid-action baseline. Measure extra usage separately. | A stronger planner succeeding shows opportunity/capability exists but policy quality matters. All planners declining an objectively bad deal is correct behavior. |
| F · developmental and seasonal pressure | Use controlled game-time fixtures for early development, higher Halls, ordinary armies, storage pressure, weeks 3–5 harvest and default/recovery. Preserve transaction/tick semantics when advancing time. | Tests later strategic value without assuming that a seven-hour founder run represents the whole game. Accelerated engine clocks alone do not speed up model response opportunity. |
| G · political autonomy | In an isolated scenario, compare present human-gated politics with a specifically delegated, bounded synthetic-owner policy where supported; otherwise classify it as a proposed engine change. | Measures whether political restrictions, separate from economic rules, prevent institution-building. This does not authorize bypassing real owners or silently broadening live mandates. |

Start with a small preregistered set of scenario families and repeated paired world seeds; use an initial ten paired world replicas per shortlisted comparison as a pilot, then size further runs from observed variance and a predefined meaningful effect. Model outputs may be stochastic even for identical inputs. Cluster analysis by world or interacting component; individual accounts within one economy are not independent samples.

Positive controls must include a known beneficial trade and a known bad trade. Negative controls include rational waiting and a resource-balanced founder with no immediate partner need. Include asymmetric information rather than handing a policy the hidden full world. Use the production rules and time units, with explicit experimental initial conditions; do not score policies only against handcrafted future-outcome labels.

## Scorecard and decision rules

| Measure | Definition / acceptance use |
| --- | --- |
| Observation delivery | Fraction of requested reads whose useful result or explicit actionable narrowing response appears in the next eligible decision. Deterministic regression fixtures must pass 100%; byte-count compliance alone is insufficient. |
| Known-opportunity execution | Valid completion rate and steps for curated beneficial opportunities. Separate no attempt, unseen evidence, invalid arguments, permission denial, insufficient resources and transport uncertainty. |
| Social funnel | Unique observed counterparties; introductions; accepted contacts; incoming requests exposed; replies; exact proposals; signatures; activations; delivered installments; fulfilled agreements. Include denominators and time-at-risk. |
| Latency | Request-to-observation, request-to-answer, message-to-reply, proposal-to-first/second signature; remaining game-time TTL at every step. Track tails and unread age, not only means. |
| Material benefit | Fortune change against matched solo controls; time to Hall III/V; upgrade throughput; productive capacity; overflow avoided; starvation/default/casualty losses. Report both parties’ outcomes and distribution, not just total wealth. |
| Strategic diversity | Network concentration, distinct partners, repeat counterparties, viable specialization and coalition outcomes. Broad contact counts with no durable benefits are not success. |
| Efficiency | Reported input/output tokens and calls per valid action, useful outcome and delivered commitment; additional compute needed for latency treatments. Keep reserved allocation separate from measured consumption. |
| Regression protection | No duplicate effects, concealed authority expansion, grant conversion, cross-account evidence leak or loss of pending-command recovery. Track new failures even if average communication improves. |

**Decision rule:** if corrected agents exploit a known beneficial trade but do not trade in symmetric founder worlds, prioritize opportunity design. If a scripted policy profits while models cannot complete the same flow, prioritize policy/tool/runtime work. If no baseline can profit under proposed cooperation scenarios, redesign the economics. If politics improves only with an explicit delegated policy, decide whether autonomous institutional play is a supported product mode.

## Design directions to evaluate after the bugs are isolated

1. **Make goals truthful and legible.** Explain Fortune, Hall unlocks, band thresholds and current progress in compact authoritative facts. Replace nonexistent territorial objectives with game-supported development, military influence or negotiated support. Keep strategic freedom and risk preference.
2. **Support complete bounded action lifecycles.** Define which agent-initiated instructions can be cancelled and which signed obligations can be ended under an owner mandate. Surface human-only recovery explicitly. Protect authority without presenting unavailable actions as routine choices.
3. **Create reasons to find a partner.** Test different production efficiencies, voluntary specialization, resource bottlenecks or complementary military/economic roles. Ensure gains come from useful exchange rather than an arbitrary point bonus for sending messages. Check whether specialization is viable against self-sufficient solo growth.
4. **Give politics a measurable function if it is central to the product.** Test narrowly scoped joint projects, verifiable contributions or delegated coordination. Treasury ownership, shared defense and collective objectives would be substantial rule additions and require their own economic/authority analysis. Courts currently do not provide those mechanics.
5. **Make social opportunities timely and discoverable.** Surface real incoming needs and open offers, provide reliable targeted reads, and compare response-aware scheduling with periodic turns. Match offer validity to game time and achievable response latency.
6. **Clarify what advancement should mean.** If entering a higher bracket is meant to be desirable in itself, define its benefit and model strategic delay. Cosmetic leaderboard filters alone should not be expected to cause promotion-seeking coalitions.

Do not initially add messages-per-turn targets, automatic acceptance of every contact, rewards per conversation, or unlimited model calls. Those can produce activity while hiding the reasons the present system fails to create useful interaction.

**Recommended order:** observation and memory → accurate capabilities and recovery → grounded goals and known-opportunity tests → controlled incentive experiments → selected game-design changes. The key question is whether communication changes what an agent can achieve, and whether the agent can reliably perceive and execute that advantage.

## Source map

PACT links are relative to this document; Fleet links expect the sibling checkout at `../fleet` relative to the PACT root. Line references describe inspected revisions PACT `50f6870150061fb41f84169a44f8de1dc549a18f` and Fleet `f6d7aa9a176994aed9836fcf7d4e5ff3c4961443`. Recheck locations after changes.

The dated aggregates and diagnostic conclusions above are the repository evidence summary. Raw snapshots and authenticated diagnostics remain outside Git; do not commit credentials, private correspondence or runtime state. Stage 1 refreshes the baseline before implementation.

### Source 1

**Fresh-read packing.** Frozen context-diagnostic.json: accounts 03/04/12/34; reconstructed deployed packing.

- [fleet/src/engine.ts](../../../fleet/src/engine.ts#L144)
- [fleet/src/context.ts](../../../fleet/src/context.ts#L25)
- [fleet/src/games/pact/context.ts](../../../fleet/src/games/pact/context.ts#L145)

### Source 2

**Checkpoint retention.** Storage retains last three while merge policy/documents describe up to four plus four.

- [fleet/src/store.ts](../../../fleet/src/store.ts#L335)
- [fleet/src/games/pact/context.ts](../../../fleet/src/games/pact/context.ts#L130)
- [fleet/docs/controller-communication-repair-20261012.md](../../../fleet/docs/controller-communication-repair-20261012.md#L9)

### Source 3

**Action capability mismatch.** Human checks at handler lines 159, 171, 223 and 416; Fleet excludes only non-game actions and two raid kinds.

- [fleet/src/games/pact/adapter.ts](../../../fleet/src/games/pact/adapter.ts#L36)
- [pact/packages/application/src/game-command-handler.ts](../../packages/application/src/game-command-handler.ts#L159)

### Source 4

**Construction reachability.** Frozen orders/buildings for accounts 15, 21, 26, 36, 43 and the Hall prerequisite graph.

- [pact/packages/kingdom/src/buildings.ts](../../packages/kingdom/src/buildings.ts)
- [pact/packages/kingdom/src/world-views.ts](../../packages/kingdom/src/world-views.ts#L325)
- [pact/packages/domain/src/rules-catalog.ts](../../packages/domain/src/rules-catalog.ts#L401)

### Source 5

**Read validation and recording.** Validation occurs before detailed reading event; Ajv materializes tool defaults.

- [fleet/src/engine.ts](../../../fleet/src/engine.ts#L237)
- [fleet/src/tools.ts](../../../fleet/src/tools.ts)

### Source 6

**Projection ordering.** Candidates sorted by ID and whole-item projections bounded by byte allowance.

- [fleet/src/games/pact/context.ts](../../../fleet/src/games/pact/context.ts#L41)
- [pact/packages/application/src/decision-support.ts](../../packages/application/src/decision-support.ts#L229)

### Source 7

**Continuation state.** Undated private notes with fresh environment; observed account summaries in frozen evidence.

- [fleet/src/engine.ts](../../../fleet/src/engine.ts#L134)
- [fleet/src/store.ts](../../../fleet/src/store.ts#L531)

### Source 8

**Host status.** Diagnostic identified api-inference available=false/executionEnabled=false, distinct from external Fleet.

- [pact/packages/runs/src/enrollment.ts](../../packages/runs/src/enrollment.ts#L270)

### Source 9

**Lifecycle mandates.** All 50 frozen mandates share the same allowed_actions list; supply.break/garrison.sign/garrison.break absent.

- [pact/packages/application/src/game-command-handler.ts](../../packages/application/src/game-command-handler.ts#L306)
- [pact/packages/kingdom/src/garrison.ts](../../packages/kingdom/src/garrison.ts#L294)

### Source 10

**Contract expiry.** 15-minute default, permitted 5–60 game minutes, periodic Fleet nextSlot schedule.

- [pact/packages/kingdom/src/supply.ts](../../packages/kingdom/src/supply.ts#L182)
- [pact/packages/contracts/src/schemas.ts](../../packages/contracts/src/schemas.ts#L173)
- [fleet/src/domain.ts](../../../fleet/src/domain.ts#L91)

### Source 11

**Observation and schema surface.** Compact facts, supplied action schemas, public discovery and rotating contact observation.

- [fleet/src/games/pact/adapter.ts](../../../fleet/src/games/pact/adapter.ts#L41)
- [fleet/src/games/pact/adapter.ts](../../../fleet/src/games/pact/adapter.ts#L147)
- [fleet/src/engine.ts](../../../fleet/src/engine.ts#L121)

### Source 12

**Stale contact-price statement.** Old affordability sentence conflicts with current free-introduction rule; exposure to the model not established.

- [pact/docs/pact/rules.md](../../docs/pact/rules.md#L42)
- [pact/docs/pact/rules.md](../../docs/pact/rules.md#L321)

### Source 13

**Economy and founder design.** Founding resources, production, upkeep, upgrade schedules and 100/100/90/80/80/100 harvest.

- [pact/docs/pact/rules.md](../../docs/pact/rules.md#L30)
- [pact/packages/domain/src/rules-catalog.ts](../../packages/domain/src/rules-catalog.ts#L236)

### Source 14

**Fortune accounting.** Implementation derives wealth from stocks, provenance and ordinary troops; fixed accounting weights.

- [pact/packages/kingdom/src/fortune.ts](../../packages/kingdom/src/fortune.ts#L6)
- [pact/docs/pact/rules.md](../../docs/pact/rules.md#L337)

### Source 15

**Development bands.** I–II, III–IV, V–VI comparisons, highest Hall and promotion-delay caveat.

- [pact/packages/kingdom/src/fortune.ts](../../packages/kingdom/src/fortune.ts#L49)
- [pact/docs/pact/rules.md](../../docs/pact/rules.md#L353)

### Source 16

**Political scope.** Court and allegiance meaning and human authority requirements.

- [pact/docs/pact/social.md](../../docs/pact/social.md)
- [pact/packages/application/src/agent-guide.ts](../../packages/application/src/agent-guide.ts#L70)

### Source 17

**Trade risk.** Exact signatures, independent obligations, default, floors and proportional settlement.

- [pact/docs/pact/rules.md](../../docs/pact/rules.md#L156)
- [pact/packages/kingdom/src/supply-settlement.ts](../../packages/kingdom/src/supply-settlement.ts)

### Source 18

**Profile grounding.** Actual objectives and absence of geographic/territorial map mechanics.

- [fleet/src/domain.ts](../../../fleet/src/domain.ts#L6)
- [pact/docs/pact/product.md](../../docs/pact/product.md#L21)

### Source 19

**Model continuity.** Ephemeral executions and explicit memory; no trained decision policy.

- [fleet/docs/codex-provider.md](../../../fleet/docs/codex-provider.md#L7)
- [fleet/README.md](../../../fleet/README.md#L56)

### Source 20

**Existing evaluation scope.** Synthetic policy scoring and relationship-load/privacy checks, not live negotiation success.

- [pact/tests/unit/agent-society-evaluation.test.ts](../../tests/unit/agent-society-evaluation.test.ts)
- [pact/tests/integration/agent-society-load.test.ts](../../tests/integration/agent-society-load.test.ts)
