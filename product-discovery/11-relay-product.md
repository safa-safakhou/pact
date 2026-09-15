# Relay

**One sentence:** Explore opposite sides of a failing station with an independent AI partner, and coordinate the discoveries and actions that bring you both home.

Relay is a complete proposed Version 1.0, developed alongside Fieldwise and House Rules for founder comparison. It is not implemented or validated. Scope, price, timings, and targets below are proposed product decisions. Research supports relevant precedents and capabilities, not this game's fun, sales, or engineering feasibility.

## Identity, audience, and reason to exist

**Name direction:** Relay. Alternatives: Other Side, Common Ground, Two Ways Home. Names are not commercially cleared. **Category:** Asymmetric cooperative puzzle adventure for one human and an autonomous partner. **Platform:** Windows PC on Steam, keyboard/mouse and controller. **Audience:** Solo adventure players and people who enjoy asymmetric co-op but do not always have a human partner available.

The core insight is that cooperation can be an enjoyable cognitive activity, not merely a multiplayer feature. Establishing shared understanding, coordinating commitments, and recovering together can be a complete solo-play occasion if the partner independently contributes rather than supplies hints.

The player is a repair specialist entering a chain of disconnected research stations after a network failure. Their agent partner, a compact maintenance automaton called a Relay unit, accesses service passages and local controls. The unit is competent from the start. The player can name and customize it, but the game does not ask them to train basic behavior or nurture it between visits.

**Fantasy:** “We found a way through because we understood each other.” The player's direct exploration and judgment are as important as the partner's investigation. The agent has no all-seeing solution knowledge and does not simply tell the player what to press.

**Visual direction:** Stylized industrial environments with strong spatial landmarks, visible cables and pipes, large readable controls, and restrained environmental storytelling. First-person human view with optional movement comfort settings. The partner appears through windows, at junctions, and in compact schematic reports; a full omniscient second-camera feed is absent during ordinary play because it would remove the information relationship. Replay can reveal both views afterward.

**Audio:** Authored atmosphere and sound effects, concise nonverbal partner signals, optional on-device/system text reading where supported, and persistent text reports. Voice recognition and generated speech are outside 1.0. A player should not need to talk aloud to enjoy the game.

The closest interaction precedent is *Keep Talking and Nobody Explodes*, while adaptive companions such as PUBG Ally show incumbent interest in partnership. Relay's proposed distinction is independent investigation and physical action on the partner's side, with several valid joint plans. A well-scripted companion is the strongest substitute and must be tested fairly. [Landscape](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/01-research.md).

## Human–agent relationship

Each participant has local perception, distinct equipment, and shared goals. The human sees their room, reads instruments, routes physical connections, traverses safe paths, and commits their own actions. The agent inspects its area, operates maintenance systems, transports components, and revises its plan when information changes.

Communication transfers observations and intentions. The agent can initiate a useful question or warn of a conflict. The human can choose to share a discovered fact, ask the partner to inspect a specific object, suggest a route, or reject a plan. The shared notebook distinguishes an observed fact from a hypothesis and records who observed it.

The human role is not “the part the model cannot solve yet.” It is a direct embodied role with meaningful actions, choices about optional objectives, and local discoveries. Better reasoning gives the partner better complementary plans, but not control of the human's body or automatic access to unshared observations. No adversarial anti-cheat system tries to stop a solo player using another tool for help.

## Controls, communication, and UX

| Action | Keyboard/mouse proposal | Controller proposal | Behavior |
| --- | --- | --- | --- |
| Move / look | WASD / mouse | Sticks | First-person exploration |
| Use / carry | E and primary action | South face button / trigger | Direct physical interaction |
| Point / share observation | Hold Q, focus object, choose label | Shoulder plus contextual radial | Sends a grounded observation with a location |
| Request / suggest | Contextual intention list | Same radial | Inspect, route, bring, hold, compare, wait |
| Typed clarification | Enter | Optional on-screen text input | Supplements context controls; never mandatory |
| Notebook / map | Tab | View | Known local connections and shared evidence |
| Ready / commit | Space in coordination state | South face button in coordination state | Starts a specifically previewed joint maneuver |
| Pause / recall | Escape / R | Menu / radial | Suspend simulation or return to a safe state |

Bindings are remappable. Every essential action has a nonlanguage control. Observations can be selected from instruments rather than manually typed. No color-only puzzles; symbols and labels communicate state. Include camera comfort, reduced motion, adjustable field of view, turn-rate options, text scaling, toggle holds, and timing assists. Pause and saving are supported throughout ordinary missions.

A shared plan is a short visible sequence: “You isolate the lower line → I move the connector → you reopen the bypass.” The player can reject a step, point to conflicting evidence, or perform a different action. Agreement is needed for actions that could close the player's only known route, consume a unique component, or commit to an optional-objective loss. Routine inspections and safe travel do not require approval prompts.

Communication is valuable when it changes work. The partner should not ask for confirmations on facts it already knows, narrate every movement, or repeat praise. Its words can be disabled in favor of symbols and the notebook for supported actions; any reduction in open-ended nuance must be honestly represented.

## Core activity and mechanics

Each mission presents a visible main restoration objective and one optional recovery objective. The stations contain power, transport, pressure, and access systems linked across both spaces. The player and partner first establish which connections matter, then create and execute a joint route.

Eight mechanism families ship in 1.0: power rerouting, pressure balancing, interlocked doors, shared lifts, movable carriers, signal relays, limited connectors, and manually held bypasses. Each has a consistent rule set and visible local instrumentation. The LLM does not invent circuit effects or write puzzle rules. Flexible planning occurs over these authored mechanics.

**Information asymmetry:** Different observations give communication a purpose. Unshared facts are not secretly available to the agent. The shared notebook can contain stale observations; state changes visibly mark them as potentially outdated. The agent must not invent a missing measurement to continue confidently.

**Simultaneous commitments:** Some actions need overlapping holds or a chosen order. A ready state shows the plan and lets the human initiate. Reaction windows are designed around human action and deterministic execution, not waiting for an inference request to return. Untimed alternatives or timing assists retain campaign access.

**Changing conditions:** A subset of encounters changes a route or resource state after a telegraphed event. Conditions are drawn from authored validated alternatives. They create a reason to revise an agreed plan, not an excuse for arbitrary failure. There are no randomly generated impossible missions.

**Plan diversity:** Most encounters should allow at least two feasible routes that trade equipment, exploration, or optional recovery. The agent's role is more substantial when the human can propose a method the writer did not choose as the default.

**Physical truth:** The game simulation enforces doors, resources, safety interlocks, and objective completion. Free text can propose an action but cannot declare success, create a key, modify constraints, or convince a device to ignore its rules.

## Loop, session, progression, and outcomes

The immediate loop is **observe → share → investigate separately → agree a maneuver → act → update understanding**. A mission takes approximately 25–45 minutes and can be resumed from an exact saved checkpoint. A full evening can be one mission with a clear conclusion.

Progression opens stations and new combinations of familiar equipment. You keep a field notebook, earned visual customization, route records, and partner communication preferences. The partner does not gain unexplained intelligence points. Its memory stores shared terminology and explicit preferences, such as short reports or confirming one-way route changes; it does not learn to emotionally depend on the player.

Success means restoring the specified system and bringing both participants to the exit. Optional distinctions track recovered archives, preserved equipment, or completing a declared challenge constraint. There is no global ranking. Mission time is an optional personal record, with assist settings and behavior version visible.

Failure is a recoverable local state: an optional item lost, a connector consumed badly, a route requiring retreat, or a checkpoint reset. There is no permanent companion death or campaign soft lock. Service failure never counts as a fictional mistake. A player can abandon a mission and resume later without off-session deterioration.

Repeat value comes from alternate routes, optional objectives, challenge variants, increasing fluency with a familiar partner, and comparing replays. The campaign can also be finished and put down. This is a premium adventure, not a daily-engagement service disguised as one.

## Complete Version 1.0

| Required release content/system | Proposed scope |
| --- | --- |
| Campaign | 12 complete missions across three station complexes, four per complex; onboarding is integrated in mission one, with an ending in mission twelve |
| Challenge mode | One authored variant per mission, changing constraints or available connectors while preserving solvability |
| Encounter vocabulary | Eight mechanism families and documented rules; each mission combines them into several substantial coordination encounters |
| Partner | One autonomous maintenance unit, name and earned appearance choices, communication preferences, reversible memory records |
| Replay | Both participants' discovered information, commitments, and actions; optional private share code and local export |
| Social | Private replay sharing only; no live human multiplayer, public matchmaking, leaderboards, feed, or chat in 1.0 |
| Accessibility | Full controller support, remapping, nonvoice play, text scaling, symbols, timing assists, and camera comfort options |
| Narrative | Complete station story, authored environmental narrative, introductory setup, and ending |
| Reliability | Checkpoints, save reconciliation, suspended-state recovery, service status, reconnect, privacy controls, and support diagnostics |
| Language | English interface and tested agent communication at launch; additional languages only after equivalent behavioral QA |

The target campaign duration is 7–10 hours with further variant/replay value; this must be measured during production. A mission count is a content commitment, not an assertion that twelve procedurally rearranged rooms are sufficient. Each mission needs a distinct cooperative idea, visual place, and sequence of consequences.

Live two-human/two-agent play was explored and is deliberately excluded from 1.0. It would change pause rules, dialogue coordination, save ownership, mission design, and support scope. Relay is complete as an adventure with an agent partner. The absence of human multiplayer must be prominent in marketing to avoid misleading co-op buyers.

### Campaign content map

Each mission brief below calls for multiple meaningful encounters, a local recovery path, and an authored alternate challenge. These are design requirements, not implemented levels. Locations form a coherent journey from a shoreline service station through a transit hub to the central signal complex.

| Mission | Cooperative idea | What each side uniquely contributes |
| --- | --- | --- |
| 1. Across the Glass | Establish shared understanding | Human sees gate indicators; partner reaches the routing panel |
| 2. Pressure Notes | Observations can become stale | Human reads downstream pressure; partner operates upstream valves |
| 3. One Connector | A single component serves competing routes | Human identifies the return requirement; partner locates and transports the component |
| 4. Shoreline Exit | Combine observation, order, and a shared hold | Human maintains the bypass; partner restores the access sequence |
| 5. Freight Junction | A route choice changes another route's availability | Human explores track controls; partner checks service-passage access |
| 6. Lift and Drain | Two systems compete for power | Human finds the manual bypass; partner moves the connector |
| 7. Stalled Carriage | A prior discovery becomes the fallback | Human redirects tracks; partner retrieves a previously inspected trolley |
| 8. Last Transit | Coordinate a multi-stage evacuation route | Human chooses optional archive recovery; partner sequences local dependencies |
| 9. Broken Signal | Distinguish evidence from hypotheses | Human tests a receiver; partner inspects the separate relay path |
| 10. The Shared Window | Synchronize two reliable actions | Human sets a manual switch; partner holds a mechanism after readiness |
| 11. Route of Record | Trade equipment preservation against extra exploration | Human evaluates the known route; partner investigates an alternate cost |
| 12. Common Return | Integrate all established coordination skills | Both contribute local discoveries, chosen commitments, and a final recovery |

The narrative ending recognizes which optional archives were recovered without requiring them for closure. Challenge variants alter equipment or starting connections and must preserve meaningful contributions by both participants. A variant that simply removes the human's work is not additional cooperative content.

## Five walkthroughs

**First-time player.** After choosing comfort and control options, enter a small station vestibule. You see three indicator symbols; the partner is behind a window beside a routing panel. Point at the active symbol, then ask it to route power. Before you cross, it reports that the powered gate will release another mechanism. You inspect that mechanism and find a safe hold position. Ready together, act, and reunite. A second arrangement asks you to contribute a new observation, so the opening is reciprocal rather than a sequence of instructions from the agent.

**Normal session.** A 35-minute transit-station mission requires opening a return line and optionally retrieving an archive. Your partner discovers a connector in a service corridor. Powering its lift would disable your drainage pump. You investigate a bypass and find a manual valve. You hold the valve while the partner moves the connector. A carriage blocks the original route; you choose to spend a spare coupling on an alternate connection, preserving the archive at the cost of an optional equipment distinction. You restore the line, exit, and review the critical coordination moment.

**Experienced player.** You recognize a potential circular dependency before asking the partner to act. Share the relevant readings, request one focused inspection, and establish a fallback. The partner discovers a shorter route; you compare its uncertainty with your equipment and choose a high-coordination maneuver. During execution you adjust a switch at the right moment while it follows the agreed plan. Better play means shared understanding and decisive action, not constantly taking over the agent.

**Social interaction.** Send a private replay of the blocked-carriage recovery to a friend. The replay first shows the two local views at the time, then the notebook entry and committed actions. Your friend recognizes another possible route and tries the same variant in their own solo mission. This is meaningful exchange without requiring a live lobby. A recipient cannot send arbitrary instructions into your active agent through a replay.

**Memorable event.** You are stranded across a shut transport gate. The partner recalls the service trolley it inspected earlier, notices that its track joins a nearby hatch, and proposes delivering the connector that way. You reroute the track while it brings the trolley. The recovery uses actual observed objects and a human action. It cannot rely on the partner narrating an unimplemented rescue animation as if it changed the state.

## Agent design

| Component | Player-facing contract |
| --- | --- |
| Observation | Partner-local visible scene and instruments; its inventory; remembered observations with timestamps; shared notebook; current agreed goals |
| Unavailable information | Human's unshared view, future events, hidden puzzle flags/solutions, unrelated account history |
| Actions | Inspect a local object, traverse a known route, operate a permitted control, transport a component, hold/release, propose or amend a joint plan, share an observation, ask a question |
| Planning | Multi-step local and joint plans with explicit dependencies; reevaluate when a dependency changes or the player proposes an alternative |
| Frequency | Target 60 model calls per play hour across communication and planning, plus measured retries; several physical actions per plan |
| Memory | Current-mission facts, short completed-mission summaries, shared names and communication preferences; all visible/reversible at the notebook level |
| Learning | Adapt communication and coordination to the player; no competence grind and no claim that model weights are trained |
| Communication | Contextual requests and grounded text; no generated private messages to other humans; no required speech |
| Configuration | Report brevity, confirmation preference for risky commitments, appearance, name, and memory reset |
| Replacement | Reset or replace the profile without losing campaign access; no random quality rolls or paid stronger partner |
| External integration | No arbitrary external-agent control in 1.0; optional export of game-specific preferences/records only |

A fixed-action executor handles routine travel and interaction. The autonomous planner selects and revises the work. World logic checks prerequisites and commits state changes. This separation is a product requirement for reliable timing, not a detailed engineering architecture.

A model can misunderstand a suggestion or choose a suboptimal plan. Before irreversible commitments the visible dependency/cost check limits surprise. The agent is allowed to say that it does not know. Missing information should trigger a useful investigation request, not invented certainty. If the partner sees that the human changed a relevant state, it updates the plan rather than continuing from stale assumptions.

Do not display fabricated “thoughts” as a faithful explanation. Show the observed fact, proposed action, and recorded commitment. A concise generated rationale is secondary and labeled as the partner's stated plan, not a forensic record of internal reasoning.

**Latency/outages:** Action execution is immediate once committed; no timed maneuver waits on an active model request. Target median planning reply below two seconds and p95 below six seconds under launch load. Required-response waits pause consequential world changes. At ten seconds display a delay state; offer retry, save, or exit after fifteen. Complete only a previously validated safe action during disconnection. Resume from recorded state with no lost items or time penalties.

New adaptive play requires the online service. Saved progress and replays remain local. The store must disclose that the solo game has an online agent requirement. A scripted outage companion is not marketed as equivalent to normal play. Long-term service funding and a credible shutdown transition are required business planning, not promised future magic.

## Fairness, safety, abuse prevention, and support

There is no monetized advantage, player marketplace, competitive currency, wagering, or global ranked comparison. Personal records store timing assists and agent behavior version. External automation in a solo game is not a reason for intrusive anti-cheat; official shareable records need valid event histories if presented as verified.

The agent has game-only tools. It cannot browse, operate the player's computer, communicate through other apps, request payment, or access personal memories. Instructions embedded in object labels, imported records, or replay captions are untrusted data. World conditions and legal actions cannot be altered by persuasion.

Private sharing is opt-in, reportable, and blockable. Free-text messages, identifying details, and internal service credentials are excluded from default replay exports. Default companion language avoids harassment and explicit content; inappropriate generated output is handled as a product incident. Never blame or ban a player solely for a generated line. Human-authored game violence is minimal and stylized; formal rating and region checks precede sale.

Proposed privacy policy: disclose the limited game context sent to the provider; no voice recording; separate opt-in for research reuse; ordinary diagnostics retained 30 days and aggregated/account-linked service metrics 90 days; player saves retained until deletion; explicit exceptions for a reported case. Launch-jurisdiction review remains required. This is product policy, not legal advice.

Support categories include incorrect observation, stale-plan execution, missing state, unclear instruction, refusal, latency, save conflict, and inaccessible control. A consented bundle includes local observations, action history, and model/game version. It must omit raw private notes by default. Checkpoint restoration and memory rollback are accessible to players. Publish incident status and acknowledge ordinary tickets within two business days.

## Monetization and economics

**Proposed offer:** $29.99 US list price with regional pricing, the complete 12-mission campaign, all challenge variants, and included core partner use. A free first-mission demonstration communicates the actual human/agent division and online requirement. No paid hints, cognition tiers, credits, subscription requirement, or purchase interrupting a mission.

This proposal has more frequent live planning and communication than Fieldwise. At 60 calls/hour, 2,000 input and 400 billed output tokens per call, and 20% overhead, mid-reference inference is **$0.1152 per play hour**. Ten hours cost $1.15; forty cost $4.61; 120 cost $13.82. At the high reference, forty hours cost $19.01, before other services. The workload and viable model are unmeasured. [Pricing method](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/03-evaluation.md).

The illustrative cohort reserve is **$6 per sold unit** for lifetime variable services, conditional on a mostly finite-campaign usage distribution. Assume average transaction revenue $21 before refunds and platform share, 8% refunds, and a 30% platform allowance. Contribution is $21 × 0.92 × 0.70 − $6 = **$7.524** before fixed production and acquisition. At an illustrative $1.35 million budget, recovery requires approximately **179,426 units**. This is arithmetic, not a forecast or proof of viability.

A heavy tail of replay, open-ended chat, or larger contexts could invalidate the reserve. The product deliberately limits conversation to useful game contexts, but players must still be able to experiment naturally. Do not impose an undisclosed dialogue cap or bill separately mid-mission. If a suitable model cannot fit the measured economics, revise the offer and scope before sale or stop this direction.

Staffing/capital requirements need technical planning around the encounter production unit and partner reliability. The shared six-person/18-month example is not a promised schedule. A publisher partnership could fund authored content and service reserves, but no deal, subsidy, or acquisition efficiency is assumed.

## Launch, acquisition, and community

The launch hook is visible in seconds: two local views, different discoveries, one coordinated rescue. The longer demonstration shows the human investigating and manipulating systems while the partner does independent work. Clearly state **one human + AI partner**, since the word co-op can otherwise mislead players into expecting conventional multiplayer.

Target adventure and cooperative-puzzle creators, including skeptical reviewers who can assess whether the agent adds meaningful play. Offer a complete early mission and accurate explanations of its limits. The most valuable creator clip shows a human plan, a changed condition, and a valid recovery. A collection of witty chat responses would attract the wrong expectation.

No active population is required. One purchaser can play every mission on launch day. Private replays encourage discussion without turning the game into a public content network. Community events can invite alternate-route solutions with no attendance rewards or expiring progression. Forums need ordinary moderation and spoiler controls; they are not integrated into agent memory.

Launch day includes the full campaign and ending, variants, accurate store page and AI disclosures, first-mission demo, controller/comfort testing, checkpoint recovery, verified capacity during launch peaks, status/support channels, and accessible language coverage. The launch date follows demonstrated reliability and complete content, not a promise to fix the partner after release.

Post-launch order: reliability and accessibility fixes; new authored side missions; an expansion complex with a new coordination mechanic; then evaluation of a separate two-human/two-agent mode if community demand justifies a complete design. Partnership opportunities are narrative/puzzle publishers and contracted inference capacity. No esports, real-money economy, or broad agent SDK is needed for this business.

## Analytics and acceptance criteria

The north-star behavior is **a completed mission in which the human and agent each contributed independent useful work, with the player wanting another mission**. Track mission completion and return alongside enjoyment and agency evidence. A model that solves more missions while the human disengages is a regression.

Instrument relevant observations shared, useful versus redundant questions, proposed/accepted/rejected plans, human-originated alternatives, simultaneous commitments, recovery actions, unexplained idle time, retries, checkpoint use, assistance settings, repeat variants, shares, refunds, and support reasons. Service metrics include per-hour cost, billed reasoning, latency percentiles, invalid actions, stale-state attempts, and restore success. Raw conversation should not be the default analytics payload.

Proposed release gates: 80% of representative new players can complete the opening mutual maneuver and explain both roles without help within ten minutes; in most test missions players can identify an independent contribution from each participant; flexible coordination wins a clear repeated qualitative comparison against a polished scripted partner; no known progress-loss or campaign-blocking bugs; 100% of tested illegal/unauthorized actions rejected; checkpoint restoration passes all interruption scenarios; planning latency and cost fit the stated budgets at peak load. These are proposed targets, not achieved results.

The high-value qualitative question is whether the player felt they were cooperating or simply collecting data for an answer engine. Test players across several missions and compare with a strong conventional companion, not an intentionally poor baseline.

## Risks, unresolved questions, and vision

Primary risks: scripted companions may be enough; information sharing may become clerical; model confidence may conflict with reality; content may be expensive to make; and a small number of long-playing customers may create large service liabilities. The game also needs people to value the occasion of cooperative solo play rather than regard the missing human friend as a deficiency.

Open questions include the right amount of independent agent initiative, how much pause preserves tension, whether typed dialogue adds enough over contextual requests, and how memories can improve fluency without exposing private data or repeating stale behavior. These are concrete validation needs, not promises that the partner will “feel human.”

Long-term Relay could become a series of authored adventures with a familiar, increasingly fluent game partner. Expansion should improve joint activity and world interactions. A general assistant that plays any existing game is a different product, already pursued by larger organizations.

## Founder and investor pitch

Relay delivers the pleasure of cooperative discovery in a solo-play session. The human and an autonomous partner explore connected station spaces, see different evidence, and operate different tools. They exchange discoveries, commit to joint maneuvers, and recover when conditions change. The partner contributes independent work; the human still explores, reasons, chooses objectives, and acts.

Version 1.0 is a $29.99 PC adventure with twelve finished missions, twelve challenge variants, a complete ending, accessible nonvoice interaction, and private replay sharing. It works for a single purchaser on an otherwise empty launch day. The acquisition story is a recognizable rescue built from two partial views, rather than a promise of unlimited AI conversation.

The investment case depends on demonstrating that flexible cooperation is materially more enjoyable than a well-scripted companion and that its service use fits the included-price offer. At the illustrative assumptions, budget recovery is roughly 179,000 units; no sales forecast or funding commitment has been validated. A focused team would invest in encounter design, partner behavior, environment art, interaction UX, QA, and service reliability. If the core comparison succeeds, authored expansions offer a coherent growth path. If it does not, adding more dialogue or model providers will not fix the product.
