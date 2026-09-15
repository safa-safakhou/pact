# House Rules

**One sentence:** Build clever challenges, give your agent a way through other people's creations, and discover solutions neither designer nor visitor expected.

House Rules is a complete proposed Version 1.0, developed for comparison with Fieldwise and Relay. It is not implemented or validated. Scope, session lengths, economics, and release thresholds are proposals. The current recommendation is to judge the full player experiences before choosing a company direction.

## Identity and core insight

**Name direction:** House Rules. Alternatives: Open Invitation, Strange Instructions, Room for Interpretation. No commercial name clearance has been performed. **Category:** Construction puzzle game with adaptive autonomous visitors and asynchronous challenge exchange. **Platform:** Windows PC on Steam; keyboard/mouse and complete controller support.

The player fantasy is **“I made this possible, and it found another way.”** People construct situations for a mind to interpret, rather than coding every action or navigating every jump. An agent makes a designer's intentions contestable through legal alternative solutions. Human players still author the situation, choose interventions, and revise their approach.

The target audience has two roles: makers who enjoy designing compact systems, and visitors who prefer solving authored or curated construction puzzles. No one must know programming. Agent builders are a secondary enthusiast segment, not the prerequisite audience.

**World:** A playful miniature exhibition hall containing challenge rooms. Your visitor is a compact delivery robot with clear carrying and interaction abilities. Rooms range from workshops to small museums and gardens, but setting changes never substitute for mechanical differences.

**Visual direction:** Tactile tabletop dioramas, a rotatable three-quarter camera, strong silhouettes, readable connection points, and diagram-like route overlays. The robot's intent appears as a short path/action preview. Human-made visual assets and sound effects establish the game identity. No generated art, voices, or large language dialogue feed is required in 1.0.

The core insight is that construction can be more interesting when the visitor can reinterpret new arrangements. *Opus Magnum* supplies a useful reference for inspectable solutions and sharing; *Ultimate Chicken Horse* shows the relationship between making a challenge and playing it; agent arenas show existing appetite for experimentation without establishing mainstream demand. House Rules must be enjoyable as a puzzle/construction game after the fascination with AI disappears. [Research](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/01-research.md).

## The two connected play loops

**Visiting loop:** Choose a room → inspect its objective and fixed structure → spend a small construction budget on a useful arrangement → brief the agent with a contextual approach → run a bounded attempt → inspect why it succeeded or failed → revise and retry. The human performs consequential construction; visiting is not just pressing Play on an autonomous benchmark.

**Making loop:** Choose a design brief → build a room from legal components → define objective and visitor construction budget → prove at least one solution → test for uninteresting impossibility or accidental triviality → share privately or submit to the curated catalogue → observe solutions and revise as a new version.

The construction budget is a game resource, not paid currency. For example, a visitor might place up to two movable surfaces and one connector before an attempt. The agent then decides how to use that opportunity. Human placement determines what is possible; adaptive planning determines which permitted path is attempted.

Ordinary attempts are short: two to five minutes of planning and construction, followed by a 30–120-second watchable execution. Three attempts make a 10–20-minute visit session. Creating a polished room may take 30–90 minutes. These are pacing targets to test, not measurements.

## Rules, controls, and actual decisions

| Player action | Keyboard/mouse proposal | Controller proposal |
| --- | --- | --- |
| Select / place component | Click from tray, click surface | Focus tray, select, aim, confirm |
| Move / rotate / delete | Drag or arrow steps, R, Delete | Stick positioning, shoulders to rotate, contextual delete |
| Camera | Orbit drag, wheel | Right stick, triggers |
| Inspect affordances | Hover/select with persistent details | Focus plus inspect |
| Run / pause / step | Space, step control | Start/stop and frame/action step buttons |
| Undo / redo | Ctrl-Z / Ctrl-Shift-Z | Contextual edit controls |
| Choose approach | Object plus contextual goal/preferences | Context radial or list |
| View outcome | Timeline, object selection | Timeline focus, next/previous event |

All input is remappable. Placement supports snapped nodes and nudge controls without precision dragging. Full keyboard operation, controller placement, enlarged text, reduced motion, color-independent affordances, and an accessible action-log view are release requirements. No timed placement or mandatory voice input.

Twenty-four components ship: fixed platform, movable platform, short beam, long beam, ramp, box, heavy ballast, fragile crate, trolley, rail segment, rail junction, pulley, rope, anchor, counterweight basket, hinge, gate, button, pressure plate, timed release, conveyor, lift, connector, and sign. Every component has explicit physical and logical behavior. Player text cannot redefine it. Art skins change appearance but preserve readable state.

Twelve relationship/condition types support objectives and constraints: reach, deliver, preserve, avoid, activate, hold, order-before, simultaneously-active, consume-at-most, finish-with, visit-all, and return-to-start. A visual objective builder produces readable rules using these types and named objects. Optional flavor text has no authority over scoring.

Three core room genres give variety within one construction system:

| Room genre | Human's work | Agent's work | Example success |
| --- | --- | --- | --- |
| Delivery | Create a route while balancing fragility and limited pieces | Select and execute a route, adapt to changed support | Deliver two objects and preserve the fragile one |
| Mechanism | Arrange a chain of usable controls | Discover dependencies and operate a valid sequence | Open an exit without consuming a spare connector |
| Expedition | Equip and modify a small traversal space | Explore local observations, collect, and return | Retrieve specified objects without crossing a forbidden surface |

The agent knows the objective, legal action vocabulary, and visible properties. In exploration rooms it must inspect hidden areas through normal actions. It never receives the author's saved solution. Deterministic world state settles success and failure. A robot saying “I delivered the crate” has no effect unless the crate is actually at the destination.

## Challenge integrity and scoring

The game rewards completion and declared optional constraints, not an arbitrary language-model quality score. Personal records compare component budget, steps, and preserved objectives on the same room revision. A visitor can value an elegant solution without being forced into a single numerical optimum.

A creator must provide a legal successful run for the current room version and demonstrate that the advertised visitor budget is sufficient. This proves existence of a solution, not guaranteed solvability by all models. The submitted objective, component set, and demonstrated solution are checked against the actual simulation. Curators assess whether a room is readable and interesting, which automated verification cannot establish.

Rooms whose entertainment depends on a hidden prompt instruction, an unsupported engine glitch, or known private model behavior are excluded from the curated catalogue. Legal surprising uses of components are welcome. If a sign can physically function as a ramp, its usable surface must be part of its declared behavior. Otherwise the agent cannot narrate it into existence.

There is no global ranked ladder, cash prize, monetary economy, or competition between all models under a false claim of fairness. Official challenge records label room revision, agent behavior version, assist settings, and whether the input was standard or custom. Comparative records are descriptive. Equal time or token limits do not mean equal intelligence.

## Progression, ownership, retention, and failure

The authored progression teaches each component family through complete puzzles, then opens combined briefs. Playing unlocks more construction pieces and earned appearance choices; all components become available after completing the teaching sequence or choosing an explicit “all tools” workshop option. Unlocks introduce complexity, not a grind advantage in other people's challenges.

Players retain their room designs, revisions, agent approach profiles, successful replays, and collections of favorite rooms. Agent identity is a name, appearance, and a short reversible game-specific approach record. It is useful because a visitor may recognize and reuse a convention, not because the product claims to import a personal assistant's entire self.

Failure consumes an attempt's in-world resources, never real-money credits. Undo and edit are unrestricted outside a running attempt. Attempts can be paused and reviewed; modifying the room starts a new attempt. A valid bad plan is informative when its cause is visible. Invalid model actions and service failures are labeled and can be retried without losing edited work.

Retention has three different sources: solving the full authored catalogue, improving efficient or expressive solutions, and making/sharing rooms. Public supply is a multiplier, not the foundation. There are no daily login rewards, automated background competitions, or permanent penalties for inactivity.

## Complete Version 1.0 scope

| Required release feature | Proposed scope |
| --- | --- |
| Authored learning and campaign | 36 rooms: twelve introductory, twelve combining mechanics, twelve mastery rooms; all playable without community content |
| Design briefs | Twelve authored construction briefs with clear budgets and examples of successful outcomes |
| Editor | Twenty-four components, twelve relationship types, undo/redo, snapping, group movement, test mode, validation, save/revision history |
| Agents | One supplied visitor with three transparent approach presets plus editable game-specific preferences/examples |
| Sharing | Private codes and local room/replay export, versioned records, selective sharing of approach profiles |
| Public catalogue | Curated submission queue, search by room genre/component/difficulty, favorites, reports, blocks, spoiler-safe thumbnails, and takedown tools |
| Replay | Action-by-action state, selected observations, plan changes, and timeline scrubbing; old runs do not require re-inference |
| Custom agents | Private experimental workshop mode via a bounded game-only connection; no official comparable records or public arbitrary code uploads |
| Accessibility | Controller/keyboard completeness, snapping/nudging, readable log alternative, scalable labels, symbols, and no speech requirement |
| Operations | Status, save/recovery, service limits against unattended abuse, moderation queue, support, privacy controls, content version migration |
| Language | English authoring controls and supported generated text in 1.0 |

Target first clear of the authored catalogue is 8–12 hours. Construction and replay can extend well beyond it. This is an intended scope, not verified content depth. The public catalogue starts with the complete developer collection and selectively commissioned rooms if production supports them; user submissions are not assumed to fill holes on launch day.

**Outside 1.0:** real-time multiplayer, open in-game chat or comments, paid user items, creator payouts, arbitrary imported art/audio/scripts, live streaming audience control, token tournaments, a general-purpose game engine, and an external-model competitive league. House Rules is a finished construction game rather than a marketplace awaiting content.

### Authored catalogue and design briefs

The table specifies all 36 room briefs: rooms 1–12 introduce relationships, 13–24 combine them, and 25–36 require more sophisticated construction. A row is a learning thread across three separate rooms, not one room counted three times. All layouts and completion evidence remain production work.

| Focus | Introductory room | Combination room | Mastery room |
| --- | --- | --- | --- |
| Placement and reach | 1. One Gap: place a platform to make a route | 13. Bent Delivery: route cargo through a turn | 25. Fewer Pieces: preserve two routes with a tight piece budget |
| Support relationships | 2. Beam Ends: support a usable span | 14. Shared Support: route a trolley and cargo | 26. Borrowed Ground: reuse one support at different stages |
| Cargo handling | 3. Handle Carefully: protect fragile cargo | 15. Mixed Shipment: transport two mass classes | 27. Safe Arrival: preserve cargo while meeting an equipment constraint |
| Pressure activation | 4. Weight Works: activate a plate | 16. Held Open: free the robot while a gate stays active | 28. Two Thresholds: sustain two mechanisms with shared ballast |
| Hinges and gates | 5. Swing Space: leave a traversable opening | 17. Return Route: reopen the route after delivery | 29. No Shortcut: satisfy access constraints without blocking extraction |
| Rail routing | 6. Trolley Stop: build a legal delivery path | 18. Junction Choice: choose between cargo routes | 30. Round Trip: recover the carrier as well as the delivery |
| Ropes and anchors | 7. Useful Tether: connect a permitted load | 19. Suspended Path: combine support and tension | 31. Release Order: free equipment without losing the route |
| Counterweights | 8. Balanced Lift: establish a usable lift | 20. Trade the Load: use cargo in a mechanism before delivery | 32. Spare Nothing: restore both load and mechanism with limited pieces |
| Timing and holds | 9. Stay Active: maintain an activation window | 21. Passing Moment: coordinate conveyor and release | 33. Patient Route: find a legal approach that reduces timing dependence |
| Connections and order | 10. Before and After: satisfy two prerequisites | 22. Chained Exit: build a connected mechanism route | 34. Reversible Plan: preserve a return path through the chain |
| Exploration | 11. Look Around: enable inspection of a hidden area | 23. Gather and Return: arrange access to several objects | 35. Limited Access: choose construction that supports uncertain local findings |
| Combined objectives | 12. First Exhibit: deliver and preserve | 24. The Busy Room: meet main and optional constraints | 36. Open Invitation: final multi-route construction challenge |

The twelve design briefs mirror the twelve relationship families but give makers new constraints: build a readable first puzzle, allow two distinct routes, preserve fragile cargo, free the visitor from a hold, preserve extraction, support a round trip, make a reusable connection, make a reversible mechanism, avoid reflex dependence, expose a clear dependency, reward inspection, and combine two legitimate objectives. There is no reward for making a room unsolvable. Each brief requires a demonstration run and a short objective description grounded in the structured rules.

## Five walkthroughs

**First-time player.** Open a room with a clear objective: deliver a small object across a gap. Place one platform from a tray and predict the route. The visitor uses it and completes the task. A second room changes the geometry; you place the platform badly and the action preview makes the limitation visible. Undo, arrange an alternative, and watch a successful route. The third opening task introduces two valid solutions. You understand construction, adaptive execution, and revision without writing a prompt or connecting a provider.

**Normal session.** Visit a museum delivery room with two objects, one fragile. You can place two pieces but cannot edit the creator's rail. A trolley route looks obvious, so you add a short beam and a support. The agent finds that the trolley can support a temporary crossing, but the fragile object requires a different handling sequence. The attempt fails one optional condition. You inspect the exact impact event, move the support, choose “preserve cargo before minimizing steps,” and retry. You finish with a slightly slower legal solution and save its replay.

**Experienced player.** Make a mechanism room that teaches a new use of a shared counterweight. You first ensure a legal solution, then test different supplied approaches to reveal accidental triviality. You eliminate an unreadable dependency and preserve two useful routes. The difficulty comes from a meaningful construction tradeoff, not from confusing text. A visitor later finds a third route and you publish a revision that celebrates rather than patches out an interesting legal solution.

**Social interaction.** A friend sends a room revision and a replay without its private coaching notes. You construct a different route and share back the result. You can branch the room with attribution, retaining the original creator link, and submit the branch to curation. Reports can flag impossible, mislabeled, offensive, or exploit-dependent rooms. There is no automatic publication of a friend's private design.

**Memorable event.** Your intended route involves pressing a button with the robot. A visitor instead rolls the trolley onto the pressure plate, freeing the robot to retrieve both objects in one trip. The replay shows why the trolley's mass and the plate's rules allow it. You did not author that route, but your arrangement made it possible. The shareable artifact is a few seconds of comprehensible movement, followed by the room code.

## Agent component and integration

| Question | Version 1.0 answer |
| --- | --- |
| Information received | Published objective, visible local objects/properties, legal affordances, its equipment, current attempt history, and explicitly selected approach examples |
| Hidden information | Creator solution, unrevealed exploration space, unpublished notes, other accounts, and future dynamic conditions |
| Actions | Inspect, move, carry/place, operate a supported mechanism, combine permitted connections, hold/release, propose a short plan, or request one contextual clarification |
| Planning cadence | Planning boundaries and unexpected state changes; target twelve model calls for an average attempt, plus retries |
| Execution | Deterministic physical actions at ordinary game speed; model calls do not drive individual frames |
| Constraints | Bounded observation/response size, finite tools, per-attempt planning budget, no arbitrary execution or ability to alter objectives |
| Memory | Current-attempt trace and selected game-specific examples/preferences; optional persistence across visits, easy to reset or inspect |
| Communication | Action preview, short request, and optional text clarification; routine actions are nonverbal |
| Player configuration | Priority preferences, a few marked examples, visual identity, and a selected profile; no engineering required |
| Replacement | Supplied presets and profile reset are free; replacing an external agent affects only private experimental runs |
| Model intelligence | Can affect route finding and adaptation; records label versions and do not imply parity between providers |

The average attempt budget is twelve calls; a standard attempt allows up to twenty-four planning calls. Reaching the budget stops at a safe state with an explicit incomplete-attempt result. This is part of the published attempt format, not a purchasable advantage. It must be large enough that ordinary authored rooms are not won by minimizing API requests. Unmetered local replay and editing remain available. If most players encounter the planning ceiling, the room or agent needs redesign.

**External-agent model:** Advanced users can connect a separately running agent to a private experimental room through a scoped, revocable game-only connection. It receives observations and can submit permitted game actions; it cannot access saves beyond the chosen copy, the public catalogue, user messages, or the host filesystem through the game. The external runtime and provider credentials remain under the user's control and are never uploaded as executable code to the game's servers.

This is support for a bounded interface, not a claim that every branded assistant account offers compatible access. Version 1.0 should ship documentation, a compatibility self-check, revocation, and clear error messages for this mode. Named providers require verified permission and compatibility before they appear in marketing. The game's own integration cannot constrain an external program's unrelated tools, so users should connect a dedicated game-scoped agent rather than grant general personal-assistant access. Private tests do not consume the company-managed inference service when the external agent supplies decisions.

Custom agents add value to makers who want to compare interpretations or bring a meaningful existing game profile. They are optional and isolated because they also introduce unequal capability, unreproducible behavior, and fragmented support. This is the only finalist where external execution has a strong enough player purpose to include in 1.0.

**Observability:** Record actual observations, chosen actions, legal state transitions, and relevant configured preferences. A generated rationale is not an authoritative inner-thought trace. Replays use recorded actions and state rather than calling the model again, so a provider update does not rewrite what happened.

**Failure and outages:** Invalid actions are rejected by the world rules. A stale action cannot operate a moved object. Missing responses pause the attempt at a safe boundary and preserve the room edits. After fifteen seconds, offer retry/save/exit with a clear provider-delay state. A previously valid physical action can finish; no new autonomous action is fabricated as a substitute. Online service is required for supplied-agent planning; editing and recorded replays remain usable offline.

## Fairness, abuse prevention, moderation, and ownership

Official records are generated from validated room and action histories. Unverified external/private runs are clearly labeled and cannot replace official completion evidence in the curated catalogue. There is no account-power progression, reward for spending more compute, hidden stronger paid agent, or assumption that token normalization creates a fair competition.

Public creation is constrained to the supplied component vocabulary. No arbitrary code, images, audio, or uploaded models are executed by the game. Names, captions, room arrangements, and signs can still be abusive; the catalogue therefore needs review, report categories, blocking, removal, repeat-abuse handling, and an appeal path. Private sharing is not proof of safety and remains reportable.

The creator grants only the permission needed to host and display a published room and its associated replay. A branch retains attribution; deleting an original must have a clear effect on hosted links and retained branches. Player-authored files remain exportable. No promises of copyright ownership in generated outputs, speculative collectibles, or creator earnings are part of 1.0. Terms require launch-jurisdiction review.

Untrusted text is never an instruction to the game service or agent's privileged tools. All success conditions are structured and enforced. Rate limits restrict unattended bulk use, account farms, and public submission spam. New public submissions may be capped while in review; this must not limit local creation or normal play. The company should not provide an unlimited model-benchmark service under the price of one game.

Default public replays omit private coaching text. Provider disclosure covers game observations and selected examples, not personal applications or memory. Research reuse requires opt-in. Proposed diagnostic retention is 30 days, service metrics 90 days, and hosted rooms/replays until deleted or removed, with clear case-retention exceptions. Human support reviews only consented or reported material needed for the case. Generated misconduct alone is not grounds to blame a player.

## Economics and monetization

**Proposed offer:** $29.99 US list price with regional pricing, the 36 authored rooms, twelve design briefs, full editor, supplied-agent play, and curated sharing. The free demo includes four complete rooms and a limited component set in the editor. No paid attempt tickets, stronger agents, loot boxes, or marketplace fees in 1.0.

At twelve calls per attempt, 2,000 input and 400 billed output tokens per call, plus 20% retries, the mid-reference inference cost is **$0.02304 per attempt**. One hundred attempts cost $2.30; 500 cost $11.52; 1,000 cost $23.04 before other services. At the high rate, the same 100 attempts cost $9.50. These are workload scenarios, not achieved costs. Free demos, automated creator testing, abandoned attempts, and abuse add expense. [Shared cost method](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/03-evaluation.md).

This is the hardest premium-service fit of the three. A provisional **$7 lifetime variable-service reserve** assumes a distribution dominated by authored play with a smaller heavy creator cohort. At $21 average transaction revenue, 8% refunds, and 30% platform allowance, contribution is **$6.524 per sold unit** before fixed costs and acquisition. A $1.35 million illustrative total budget requires about **206,928 units**. An editor/curation product may actually require a larger budget than the common comparison scenario.

Break out visitors and creators when modeling use. A creator spending 1,000 fresh runs may consume more inference than the purchase can support; the product cannot assume that user averages solve all lifetime liabilities. Recorded replay is cheap because it reuses actions, but novel attempts still require new planning. Local execution or contracted rates can only enter the forecast after adequate capability and costs are measured.

The premium offer is conditional on a tested blended usage distribution and adequately funded reserves. If it fails, the honest alternatives are an explicitly priced ongoing workshop service, a proven local-agent option, or a materially different product scope. An undisclosed attempt paywall is not acceptable. Optional external inference reduces company cost for enthusiasts but cannot be required to make the ordinary paid game complete.

Future revenue can come from well-designed component sets and authored room expansions. Do not sell a component that silently makes old comparable challenges easier. Public creator payouts and a marketplace would add moderation, payments, incentives, and fraud problems; they are not part of the initial business case.

## Launch, acquisition, and community operation

Launch with a complete developer-authored catalogue and editor. One person can play and construct without anyone else online. A curator queue prevents an empty or low-quality public feed; it does not require an artificial population of fake human creators. Label developer and agent-generated example content accurately.

The hook is a visible before/after: the designer places a few pieces, then the visitor finds a valid unexpected route. The next beat shows the designer revising it. Maker creators can explain this in seconds; longer coverage should also show ordinary visitors enjoying construction puzzles. Raw model failure compilations would attract an audience that undermines the intended catalogue.

Initial discovery recruits should include puzzle makers, automation/building players, and visitors who rarely create. Recruit creators through relevant public channels or permissioned outreach once a real playable expression exists; no outreach has occurred in this research. A room-of-the-week showcase can be asynchronous and archived, with no exclusive progression reward. Contributor attribution and useful criticism are more valuable than a leaderboard for publishing volume.

Moderation staffing must scale with submissions and reports. The launch requirement is a staffed queue with clear guidelines, report triage, takedowns, and appeals. If curation capacity is full, new submissions wait transparently; private sharing and the complete authored game continue. Community quantity is not the primary metric.

Launch-day checklist includes all authored rooms/briefs, full editor and controller support, validation and versioning, readable replays, seeded curated catalogue, private sharing, reporting/blocking, paid service capacity, demo abuse protection, compatibility checks for the external mode, service status, support procedures, accurate online/AI disclosures, and documented content ownership rules.

Post-launch: fix editor friction and unreliable affordances; improve curation and search from actual usage; add authored expansions; then consider collaborative editing if makers repeatedly request it. Avoid expanding into a general game platform until the constrained vocabulary produces durable value. Publisher, puzzle-creator, and inference-provider partnerships are possibilities, not assumed assets.

## Analytics and release gates

Measure two loops independently. For visitors: meaningful construction choices, authored-room completion, attempts, revisions after an understandable failure, return for new rooms, and quality ratings after actual play. For makers: completed playable rooms, time to first working design, test iterations, valid alternate solutions, accepted submissions, useful visitor activity, and revisions based on observed play.

Cross-cutting telemetry covers model cost per attempt, billed reasoning, invalid/stale actions, unexplained budget exhaustion, latency, replay fidelity, editor data loss, moderation reports, duplicates, appeals, external-mode failures, refunds, and support reasons. Do not mistake raw uploads, generated turns, or total attempts for player value.

Proposed release gates: 80% of representative newcomers complete the first construction–run–revision sequence within ten minutes without help; most visitors can identify how their placement changed the result; at least 70% of tested aspiring makers complete a legal small room in their first creation session; the authored catalogue remains satisfying across several sessions; every curated room has current valid completion evidence; all tested unauthorized world changes are rejected; replays reproduce recorded outcomes; no known editor data loss; and measured visitor/creator cost distributions fit the funded offer. These are proposed decision criteria, not achieved metrics or industry standards.

## Risks, open questions, and long-term vision

The central risk is that the agent does the interesting work while visitors merely watch. Construction budgets and authored challenges address that structurally, but only player evidence can confirm it. Other major risks are an intimidating editor, trivial or impossible rooms, model-specific exploits, fragmented custom-agent support, and high creator inference costs.

Open questions: do noncreators enjoy the visit loop enough; do makers care about adaptive interpretation more than deterministic execution; can the component vocabulary create enough varied situations; what level of curation supports quality without suppressing discovery; and can a premium price fund heavy creators?

House Rules could become a lasting construction community with a distinctive language of challenges and solutions. Its defensibility would come from excellent tools, a trusted catalogue, evaluated interaction rules, and creator practices. An endpoint that accepts agent actions is easy to copy. Cross-game agents, esports, and a marketplace are separate businesses that should not be assumed as inevitable growth.

## Founder and investor pitch

House Rules gives players a new audience for construction: an adaptive visitor. You build a compact situation, supply a route or tool arrangement, and watch the agent work out what it can do. Sometimes it follows your idea; sometimes it finds a legal approach you missed. You can inspect every action, revise the room, and share the challenge and its solution.

The $29.99 PC release contains a complete 36-room authored game, twelve construction briefs, a full constrained editor, replays, and curated asynchronous sharing. It works before a community exists. Optional custom agents serve enthusiasts in private experiments, while an included visitor makes ordinary play accessible immediately.

The commercial case has a meaningful creator upside and a demanding cost profile. At the illustrative assumptions, budget recovery is roughly 207,000 units, with substantial uncertainty around heavy use and moderation. Funding would support editor and puzzle design, reliable simulation/agent integration, art/audio, accessibility, curation, QA, and service reserves. The case should advance only if visitors enjoy consequential construction and makers produce worthwhile rooms at sustainable cost. If that holds, tools and community practice can become durable assets; if not, calling it an agent ecosystem does not repair the game.
