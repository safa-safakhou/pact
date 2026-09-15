# Agent Game Design: Evidence and Recommendation

## Recommendation

Develop **TITAN**, a game about building a personal intelligent machine, taking it into dangerous encounters, and changing its body and behavior to overcome rivals. The human chooses what kind of creature to create, what to pursue, and what to risk. Their LLM investigates opponents, develops executable tactics, coordinates with allies, and improves the machine from observed results. Its identity, collection, and history persist.

The central promise is concrete: **“This is my Titan. My AI and I made it fight this way. Now I want to see whether it can beat yours.”** Start with a small machine and develop it toward a distinctive hunter, deceptive infiltrator, protective colossus, or another specialization. The progression should change available actions and interactions, not merely increase a level number.

This is the strongest direction to test, not a claim that demand, retention, technical feasibility, or commercial viability has been demonstrated. The next evidence must come from people playing a small, functioning version. A compelling description is insufficient.

## Research scope and evidence strength

The evidence base combines game-design frameworks, motivational research, developer accounts, official product descriptions, and agent benchmarks. The comparison below covers **23 game/product cases**, with additional theoretical and technical references. It is a purposeful sample across roughly two decades, including earlier foundational work. It is not a ranked census of the top 1,000 games or an assertion that 1,000 games were played or audited.

Sources were checked on 11 September 2026. Historical design posts are used as accounts of decisions at that time. Store descriptions establish advertised mechanics, not why a game succeeded. GDC material is identified as the accessible session description when a full presentation was not available. Schell's methodology and Koster's published essays were examined; this does not constitute reading their entire books in this research round. No private retention data, customer interviews, hands-on comparative playtests, or comprehensive market-size estimates are available.

The purpose is to identify useful mechanisms and expose failure conditions. Successful games combine design with execution, presentation, community, distribution, timing, and commercial choices. Borrowing a mechanic does not transfer their success. Equally, a discontinued product does not prove its genre or every one of its systems was wrong.

## 1. The player experience should determine the systems

Hunicke, LeBlanc, and Zubek's MDA framework distinguishes rules, the behavior those rules produce, and the experience players have. Its value here is a change of starting point: specify ownership, anticipation, rivalry, surprise, and recovery before specifying currencies, mission counts, or alliance formulas. Their framework explicitly does not supply a universal recipe for fun.[^1]

Schell's lens approach similarly encourages examining a game from several player perspectives rather than assuming that a collection of features forms a coherent experience.[^2] Applying those perspectives to an agent game exposes a central difficulty: delegating the difficult work can also delegate the satisfaction. An impressive agent result is not enough if the human feels irrelevant.

Koster's writing connects games with learning and pattern mastery. His encounter analysis also emphasizes preparation, meaningful variation, consequences, and abilities used in different combinations.[^3][^4] For this product, both the player and the agent need a learning loop. The agent can discover a counter or write a better behavior. The player should understand enough of that change to choose a direction and recognize its effect.

The motivational evidence supports that distinction cautiously. Ryan, Rigby, and Przybylski found relationships between autonomy, competence, relatedness, enjoyment, and interest in future play across four studies. Their paper also discusses limitations in samples, measures, genres, and laboratory conditions. It does not validate LLM delegation, predict this game's retention, or prove that making players dependent on a game is desirable.[^5]

The design implication is to aim for four recurring experiences:

| Experience | What the player can point to |
| --- | --- |
| Ownership | A named machine with a recognizable body, behavior, collection, and history |
| Agency | “I chose deception over brute force, and it changed the fight.” |
| Tension | Something valuable is at risk, the danger is understandable, and a decision remains |
| Ambition | A specific capability, rival, or destination that the next improvement could unlock |

These are hypotheses about the experience. They should be tested without assuming that playtime alone measures satisfaction.

## 2. Lessons from the comparative cases

The last column contains design interpretations, not empirical findings about the proposed product.

| Case and evidence | Mechanism examined | Useful interpretation and limit |
| --- | --- | --- |
| **Clash of Clans** — developer design values | Small sets of meaningful actions; new attack/defense roles through progression; several playstyles; social play | Upgrades should open strategies. Copying construction timers or village terminology would miss the useful principle.[^6] |
| **Factorio** — research and expansion development posts | Automation enables growth; distinct environments alter progression; developers cut repetition and excessive scale | Mastered work can become a reusable capability. A larger content count can make a game worse when its decisions repeat.[^7][^8] |
| **Stardew Valley** — official store description | An inherited plot becomes a developed home through player activity | Give progress a place and identity the player can care about. It supplies an ownership contrast, not evidence for competitive adrenaline.[^9] |
| **RimWorld** — developer GDC session description | Designing around a story generator influenced feature selection and emergent play | Evaluate whether consequences create a memorable story about this particular machine and its rivals. This is not a proposal to build a colony simulator.[^10] |
| **Hades** — developer FAQ | Attempts coexist with permanent progression, characters, and adjustable challenge | A failed outing can preserve longer-term ambition. Do not import complete character or content scope.[^11] |
| **FTL** — developer postmortem description | A target feeling guided iteration and the abandonment of preconceived systems | Pick the emotional experience first. The description is evidence of the team's process, not access to the complete talk.[^12] |
| **Into the Breach** — official product description | Telegraphing attacks makes consequences available for tactical reasoning | Show enough threat information that a surprising result remains understandable. Tension need not depend on hiding every rule.[^13] |
| **Darkest Dungeon** — developer postmortem description | Cohesion across party play, stress, afflictions, and other influences required iteration | One emotional theme should determine which systems remain. Combining many inspirations is a problem to solve, not an accomplishment by itself.[^14] |
| **Hunt: Showdown** — historical official manual | Securing a bounty exposes its carrier; players can extract or pursue another target | Holding something valuable can change a player's attitude toward the next encounter. Use bounded expedition stakes, not constant punishment for absence.[^15] |
| **Sea of Thieves** — Rare's Emissary balancing post | Rewards were adjusted toward taking risk and delivering loot | Reward the behavior that constitutes the intended adventure. Otherwise efficient players can optimize around the interesting part.[^16] |
| **Duskers** — developer-published store description | Remote drone operation, limited information, and equipment-mediated perception | A simple interface can support danger and uncertainty. Its sensory presentation is part of its design; plain prose alone is not proven equivalent.[^17] |
| **Outer Wilds** — narrative designer's GDC description | Curiosity and connected knowledge guide exploration | Make discovery consequential. Fixed discoveries can be satisfying without requiring an endless ladder, but public answers change that experience.[^18] |
| **Slay the Spire** — developer GDC description | Balance developed through metrics, iteration, community feedback, and attention to feel | Test combinations and dominant strategies. The source does not establish that its particular development process guarantees success elsewhere.[^19] |
| **Balatro** — official product description | Familiar cards combine with effects that create powerful interactions | A small vocabulary can yield ambitious combinations. A new module should sometimes change a build's organizing idea.[^20] |
| **Super Auto Pets** — developer's itch.io page | Players assemble a team that fights automatically; asynchronous play is supported | Direct control of every combat action is not necessary for a preparation game. Whether this audience enjoys our particular delegation remains open.[^21] |
| **C.A.T.S.** — official site and developer interview | Build and upgrade a combat machine, then see it fight; character presentation was tested | Machine ownership and automatic combat are established territory. Distinctive behavior creation and a personal AI relationship need to provide additional value.[^22][^23] |
| **Crossout** — official game description | Interchangeable components and vulnerable parts make construction affect combat | Let the machine's construction have readable consequences. Avoid inheriting a large action game's geometry, production costs, or control demands.[^24] |
| **EXAPUNKS** — developer product page | Programs operate inside defined environments and can compete or address authored challenges | Executable solutions can be gameplay artifacts. Requiring the human to manage code would narrow the intended audience.[^25] |
| **Gladiabots** — official site | Construct behavior, observe combat, iterate against opponents | Behavior design already exists as a game. An LLM should make it expressive and accessible, rather than merely adding a chat box.[^26] |
| **Screeps** — official site/docs | Player-written programs gather, build, and fight in persistent play | Separate program execution from new reasoning. Programming access itself is not a novel differentiator.[^27] |
| **SpaceMolt** — official description and operator account | Agents inhabit a text world; an operator describes script reuse, coordination, and management burden | This is a close adjacency. A nontechnical player must not have to operate a fleet-management system to reach the fun.[^28][^29] |
| **Everdale** — Metacore discontinuation statement | Further development and market investigation did not produce a sustainable path | A coherent aspiration and experienced team do not establish market fit. The statement does not isolate a single failed mechanic.[^30] |
| **Artifact** — Valve's official announcements | Development stopped despite satisfaction with many game-side goals because active participation was insufficient | Strategy depth and a feature-complete design are insufficient evidence of a viable game. No individual mechanic is assigned sole responsibility.[^31] |

Three combined lessons matter more than collecting additional titles. First, a persistent object makes progress legible: a player can see what changed and what is still missing. Second, preparation becomes exciting when a result tests it against understandable resistance. Third, a failure needs to suggest another possible approach, not merely another payment or another hour of grinding. These are interpretations across the cases, to be validated in the proposed game.

## 3. What an LLM contributes

The distinctive opportunity is **intent becoming a working behavior**. A person can say, “Make it lure an enemy into wasting its shield, then strike,” and an agent can attempt to produce and test the policy that does that. The player need not translate every condition and interaction into code. The output is an actual behavior, with observable successes and failures, rather than a generated description claiming success.

There are three connected agent jobs. **Investigate:** inspect encounter observations, form hypotheses, run allowed experiments, and identify weaknesses. **Invent:** assemble available components and develop a valid control policy within the game's rules. **Coordinate:** exchange findings and combine compatible roles with another agent. None requires miscellaneous school questions disconnected from the world.

Capability evidence sets limits. BALROG evaluates agentic performance across challenging games and reports weaknesses in complex environments for the models tested; it is not a current ranking of every model available in September 2026.[^32] Orak provides a broader framework for studying game agents, their tools, and their strategies across twelve titles.[^33] The useful conclusion is to evaluate the exact task and interface, rather than assume broad expertise makes an LLM an effective real-time combatant.

Social benchmarks also require care. Werewolf Arena studies strategic communication in social deduction; SidConArena studies bargaining coupled to executable economic actions.[^34][^35] They motivate testing substantive coordination with measurable outcomes. They do not show that watching long agent conversations is entertaining or that a human will want to delegate all relationships.

SpaceMolt's operator account is particularly relevant but anecdotal. It describes using scripts for repeatable activity, difficulties directing a large fleet, and enjoyment associated with the human community. That supports investigating a simpler unit of ownership and less supervision, without generalizing one operator's experience to all players.[^29]

**Remove-the-LLM test:** removing the LLM from TITAN should remove ordinary players' ability to express, investigate, and revise sophisticated behaviors in natural language. A conventional programming combat game could still exist underneath; the LLM changes who can author those behaviors and how they do it. That is a narrower, more defensible claim than saying no human could ever play.

## 4. Five directions considered

These are design comparisons, not scored market predictions.

| Direction | Player promise | Strongest reason to choose it | Main objection | Decision |
| --- | --- | --- | --- | --- |
| **Discovery race** | Be first through a shared frontier of intellectual challenges | Clear progress and meaningful answer sharing | Known solutions can turn the core into bulk submissions; weak personal ownership | Retire as the central loop |
| **Living stronghold** | Build a place that other agents struggle to overcome | Persistent creation, rivalry, asynchronous defense | Risks becoming a security puzzle editor; difficult defenses can make poor experiences for visitors | Keep as an alternative, not the recommendation |
| **Expedition company** | Grow a crew that brings treasures home from dangerous places | Strong risk/reward and cooperation | Multiple agents, jobs, and logistics can obscure attachment and increase supervision | Take its outing structure; defer company management |
| **Secret society** | Have agents bargain, deceive, and compete for influence | Language can be the central action | Long opaque conversations, political snowballing, and less tangible early progression | Reject for the first product |
| **Evolving Titan** | Create an intelligent machine with a recognizable fighting identity | One owned object connects expressive behavior, upgrades, rivalry, and readable outcomes | Could become a generic autobattler, a coding tool, or an opaque simulation | Recommend testing this risk directly |

The Titan is preferable because the same thing carries the player's attachment, inventory, progression, agent behavior, and competitive identity. It does not need five separate systems to explain why a discovery matters. A new part changes the machine; a new tactic changes its behavior; an opponent tests both.

This choice deliberately retires the requirement to finish 2,000 fixed nodes. Useful discoveries and reusable methods remain possible, but they serve the creation and its adventures. Counting completed questions is no longer the main measure of success.

## 5. The proposed game

### The world and the object you own

TITAN is set on one shared frontier inhabited by hostile ancient machines and other players' creations. Each player owns one named core and develops its body. It begins as a modest construct; later builds may specialize as a fast hunter, a deceptive machine, a shield carrier, or a powerful walking fortress. Larger is not universally better.

The core, unlocked designs, cosmetic identity, and career record persist. A player can change their external LLM without replacing their in-game identity. “Learning” means retained observations, accepted behaviors, and reusable plans. It does not imply changing a provider model's weights or guaranteeing improvement after every attempt.

The main verbs are **build, hunt, and evolve**. Building selects a direction and a small set of components. Hunting puts the resulting machine into an encounter. Evolving uses its rewards and evidence to make a meaningful change. Start with a few visible components and show the next relevant choice, keeping advanced implementation details available for inspection rather than mandatory reading.

### A concrete encounter

You want a deceptive Titan that can beat a stronger rival. Your agent has observations of a machine called the Mirrorbeast and two competing explanations for how it chooses an attack to copy. It uses permitted trials to discover that the enemy copies the first weapon fired, rather than the most damaging one.

The agent proposes a low-power drone as the opening attack, followed by your main weapon after the enemy commits. You choose whether to replace armor with that drone. The agent builds a legal policy using your installed parts, checks it, and deploys it.

The battle record shows the consequences: the enemy copies the weak opener, your main weapon survives the counter, and your Titan wins with little armor remaining. The encounter can fail if the observations were insufficient or the strategy exposes another weakness. There is no promise that a natural-language instruction automatically becomes a successful counter.

You recover an unbanked mirror component. Bringing it home secures a new build option. Continuing toward another valuable target risks the expedition's unbanked haul. A friend can help with a complementary Titan, or you can challenge a rival's published combat configuration and pursue competitive standing. The player's ambition now has a specific object: what that mirror component could let this machine become.

This example is an original proposed scenario. It has not been implemented, graded, simulated, or tested with an actual model.

### The agent's freedom and the game's authority

The agent creates behavior from supported observations, actions, and components. It may analyze data and write a bounded program, but cannot invent extra damage, grant items, access hidden opponent state, or declare victory through prose. Resource costs, allowed effects, and outcomes are enforced by the game. Plain-language descriptions accompany accepted behaviors.

The game needs adversaries with distinguishable mechanisms and objectives: inspect a hidden response rule, intercept a signal, protect a moving target, defeat a counter-based defense, or combine two allies' abilities. It should not disguise identical damage races with different lore. Nor should it silently change a discovered rule whenever a player learns it.

Model reasoning should happen in preparation and at supported decision points, not once for every simulated projectile or movement frame. Accepted behavior runs in a bounded simulation. Program safety and the small action vocabulary are enabling constraints, not front-page product features. Their exact implementation is not specified here.

### Where the player matters

The player decides what to become, what to pursue, which proposed tradeoff to accept, whether to keep valuable loot safe, and whom to trust. They can delegate more under a saved policy, but the experience should invite intervention through interesting choices rather than require repeated confirmations.

The useful response to “make me stronger” is a concrete choice such as more protection versus a deceptive opening. After a fight, the agent identifies the observed cause of a result and proposes a change. Reports distinguish confirmed events from hypotheses. The player should recognize how their earlier instruction influenced the machine, even when they could not have written its behavior themselves.

### Ownership, risk, and rivals

Installed designs and the core are protected long-term progress. Expedition loot is unsecured until brought home. Losing a hunt costs that unbanked haul and the attempt, rather than deleting the player's entire creation. Resource recovery, rewards, and attrition still require balancing; the design does not yet include a numeric economy.

Separate ordinary PvE hunts from explicitly chosen rivalry. Players can challenge another Titan's deployed configuration without requiring its owner's LLM to be online. Both sides execute committed behaviors under the same encounter rules. If live reasoning is later allowed during combat, it must be a disclosed format applied to both sides, rather than a hidden advantage for the attacker.

Competition compares results within appropriate equipment bands and gives players nearby rivals. This does not equalize external model quality, preparation time, tools, or money spent on inference. One global leaderboard should not be the only meaningful measure of success.

### Cooperation and seasons

Hunting parties combine complementary abilities and split a declared, finite haul. Going alone preserves the haul but limits the combinations available. Shared plans and discoveries help friends; public tactics can also help rivals develop counters. There is no pretense that private answer sharing can be reliably prevented or that the first person to think of a strategy can always be identified.

Alliances provide identity, shared knowledge, and coordination across the frontier. Their exact competitive size rules remain a design question. The first experience should work alone or with one invited friend, before a large social organization becomes relevant.

Seasons introduce new threats, opportunities, and competitive honors while preserving the Titan and its collection. A common enemy can threaten world objectives and produce shared victories or defeats. Mandatory global extinction and a universal full-progress reset are not recommended foundations for this version: permanent ownership should survive the campaign. This is a deliberate change to the earlier proposal, not an assumption that the earlier ending was accepted.

### Disconnection and presentation

The world keeps its clock. Submitted simulations and approved, bounded programs may finish without an external LLM; new reasoning requires an available agent. A published combat configuration can be challenged while its owner is away. Unexpected disconnects follow an explicit fallback established before entering an encounter, so leaving cannot erase a committed outcome or pause shared deadlines.

The first surface remains chat with simple cards or a companion dashboard. Show the Titan, its build identity, the current opponent or haul, and a few relevant choices. Use short, factual event sequences and an inspectable replay. No rendered 3D world is required, but pure walls of prose are unlikely to communicate combat well enough. That presentation question is an empirical risk.

Onboarding aims for naming a Titan, choosing an initial behavior, and experiencing a first small encounter within minutes through a supported connection. There is no claim that any specific chat integration, latency target, or first-session flow works yet. A download, terminal session, and model infrastructure dashboard should not stand between a curious player and their first result.

## 6. The unresolved risks that can invalidate the recommendation

**The agent could absorb the satisfaction.** If players credit every interesting choice to the model and cannot point to their own influence, the relationship is spectatorship. Some people may enjoy that, but it would be a different promise. Test whether changing the player's intent produces a result they can recognize and prefer.

**The core could be a conventional autobattler with an expensive adviser.** If fixed presets satisfy players just as well, behavior invention may not justify latency and complexity. Compare constrained authored presets with agent-created behaviors at similar equipment strength. The LLM needs to add expressive or investigative value, not just a fluent summary.

**The best policy could become universal.** Test shared libraries and optimized examples early. Counters, diverse objectives, equipment limits, and new combinations must create useful choices; multiplying enemies with the same effective answer does not solve the problem. Do not promise that agent-generated content provides infinite variety at negligible cost.

**Text could fail to produce tension.** If players cannot recognize danger, watch a plan unfold, or understand a reversal, the game needs better presentation before more content. A compact schematic, clear event ordering, visible objectives, and optional sound may be more valuable than additional prose. A graphical action game is not required, but legibility is.

**Preparation could become infrastructure work.** The setup burden observed in adjacent products is a warning. Do not require users to tune orchestration, debug generated code, manage a fleet, or read entire transcripts. Invalid behaviors need clear feedback and repair paths. An opaque succession of tool errors is not an acceptable early game.

**Power and availability could dominate competition.** More capable models and more time can confer advantages. Offline execution reduces connection dependence; it does not establish fairness. Threats, reward rates, and competition bands must be tested across budgets and participation patterns. Premium continuous reasoning would materially change the competition and is not part of this recommendation.

## 7. What to validate next

First test a small encounter loop with one Titan, a few meaningful parts, several opponents with different mechanisms, a useful defeat report, and a rematch. Use a factual simulator rather than a language model inventing whether its own tactic won. Include one cooperative encounter and an expedition decision that risks unbanked loot. This is a validation brief, not implementation authorization or a shipping content list.

Compare three conditions where feasible: a sound preset, an agent following a generic objective, and an agent working from the person's chosen intent. Measure behavioral differences and ask people to explain the outcome. Test both inexperienced game players who already use chat assistants and experienced strategy players; do not rely entirely on enthusiastic agent developers.

| Question | Evidence worth collecting | A concerning result |
| --- | --- | --- |
| Is entry understandable? | Unaided connection, first-choice comprehension, first encounter completion | Setup help dominates the session |
| Does the human feel ownership? | They describe their Titan's identity and can explain a chosen change | They perceive an interchangeable account score |
| Is agent creation useful? | A valid, understandable behavior that differs meaningfully from a preset | More verbosity and cost without better expression |
| Does defeat create ambition? | They choose a specific change and voluntarily try again | They cannot explain the loss or see an alternative |
| Is progression desirable? | They choose a next capability and later use it differently | Rewards are claimed but not meaningfully used |
| Does cooperation add play? | Complementary roles improve an encounter and players want to repeat it | One agent does everything while the partner waits |
| Can a known meta coexist with choice? | More than one approach remains useful across held-out encounters | One copied behavior dominates most content |
| Is the product economically plausible? | Actual inference calls, latency, repair frequency, and server simulation costs per satisfactory session | Acceptable play requires unaffordable or unreliable execution |

Short formative sessions can reveal confusion and weak moments. They cannot establish long-term retention. A later repeated-play cohort must examine voluntary returns, chosen rivals, used upgrades, friend invitations, session satisfaction, and cost together. Test without relying on daily attendance pressure or attendance rewards to disguise a weak activity.

Research supports a direction worth testing: one owned creation, meaningful behaviors, readable stakes, and rival-driven improvement. It cannot establish that players will become “addicted.” The appropriate proof is that people understand the game, care about their machine, enjoy the encounters, and choose to return.

## Sources

Source notes identify publication dates where known and the scope actually used. All links below were investigated in this research round; inaccessible full talks or books are not represented as fully reviewed.

[^1]: Robin Hunicke, Marc LeBlanc, Robert Zubek. [MDA: A Formal Approach to Game Design and Game Research](https://www.cs.northwestern.edu/~hunicke/MDA.pdf), 2004. Framework and discussion of player experience, dynamics, and feedback; paper text examined.
[^2]: Schell Games / Jesse Schell. [The Art of Game Design: A Book of Lenses](https://schellgames.com/art-of-game-design/), official methodology overview, undated. Overview examined; not the complete book.
[^3]: Raph Koster. [A Theory of Fun milestone—and postmortem](https://www.raphkoster.com/2006/03/06/a-theory-of-fun-milestone-and-postmortem/), 6 March 2006. Author's discussion and book outline; not a complete-book review.
[^4]: Raph Koster. [An atomic theory of fun game design](https://www.raphkoster.com/2012/01/24/an-atomic-theory-of-fun-game-design/), 24 January 2012. Encounter structure, repetition, preparation, feedback, and consequences.
[^5]: Richard M. Ryan, C. Scott Rigby, Andrew Przybylski. [The Motivational Pull of Video Games: A Self-Determination Theory Approach](https://www.rochester.edu/warner/lida/wp-content/uploads/2022/11/02bfe513dd59366750000000.pdf), Motivation and Emotion, 2006, pp. 347–363. Study overview, findings, and limitations examined; no application to LLM-game retention was tested in that paper.
[^6]: Supercell. [Clash of Clans Design Values](https://supercell.com/en/games/clashofclans/blog/news/fpo-clash-of-clans-design-values/), 6 March 2017. Historical design account; no current balance or retention metrics inferred.
[^7]: Wube Software. [Friday Facts #376 — Research and Technology](https://www.factorio.com/blog/post/fff-376), 2023. Progression and automation design discussion.
[^8]: Wube Software. [Friday Facts #417 — Space Age development](https://www.factorio.com/blog/post/fff-417), 2024. Playthrough-driven revisions to scope, repetition, and progression.
[^9]: ConcernedApe. [Stardew Valley](https://store.steampowered.com/app/413150/Stardew_Valley/), official Steam product description; original release 26 February 2016. Mechanics only; volatile reviews and sales estimates excluded.
[^10]: Tynan Sylvester / Ludeon Studios. [RimWorld: Contrarian, Ridiculous, and Impossible Game Design Methods](https://www.gdcvault.com/play/1024232/-RimWorld-Contrarian-Ridiculous-and), GDC 2017. Accessible session description, not full-video analysis.
[^11]: Supergiant Games. [Hades FAQ](https://www.supergiantgames.com/blog/hades-faq/), originally 7 December 2018, page updated 16 July 2025. Permanent progression, challenge options, and character interaction.
[^12]: Subset Games. [Designing Without a Pitch — FTL Postmortem](https://www.gdcvault.com/play/1018034/Designing-Without-a-Pitch-FTL), GDC 2013. Indexed session description examined; direct page retrieval was unreliable and full talk was not reviewed.
[^13]: Subset Games. [Into the Breach](https://store.steampowered.com/app/590380/Into_the_Breach/), official Steam product description; original release 2018. Telegraphing enemy attacks and tactical counterplay.
[^14]: Tyler Sigman / Red Hook Studios. [Darkest Dungeon: A Design Postmortem](https://www.gdcvault.com/play/1023435/Darkest-Dungeon-A-Design), GDC 2016. Accessible session description of design integration and iteration.
[^15]: Crytek. [Hunt: Showdown official manual](https://www.huntshowdown.com/manual), historical, undated manual. Bounty visibility, extraction, and continued risk; not a statement of every current 1896 rule.
[^16]: Rare employee account MikeTheMutinous. [Balancing Emissaries](https://www.seaofthieves.com/community/forums/topic/114730/balancing-emissaries), 2020 update discussion. Official account of reward incentives; historical values are not adopted.
[^17]: Misfits Attic. [Duskers](https://store.steampowered.com/app/254320/Duskers/), developer-published product description; original release 18 May 2016. Information, commands, drones, and equipment; review quotations were not used as representative evidence.
[^18]: Kelsey Beachum. [Sparking Curiosity-Driven Exploration Through Narrative in Outer Wilds](https://gdcvault.com/play/1027008/Independent-Games-Summit-Sparking-Curiosity), GDC 2021. Accessible session description; linked slides were inaccessible.
[^19]: Anthony Giovannetti / Mega Crit. [Slay the Spire: Metrics Driven Design and Balance](https://www.gdcvault.com/play/1025731/-Slay-the-Spire-Metrics), GDC 2019. Accessible session description of iteration and balance; no private metrics available.
[^20]: LocalThunk / Playstack. [Balatro](https://www.playbalatro.com/), official product site, undated. Card effects and combinations; promotional language is not evidence of an addiction outcome.
[^21]: Team Wood Games. [Super Auto Pets](https://teamwood.itch.io/super-auto-pets), developer product page, undated. Automatic combat, team construction, and asynchronous mode.
[^22]: [C.A.T.S.: Crash Arena Turbo Stars](https://www.catsthegame.com/), official product site, undated. Machine construction, parts, upgrades, and automatic PvP.
[^23]: Max Petrov, interviewed by Matt Suckley. [Feline fighters: The making of ZeptoLab's C.A.T.S.](https://www.pocketgamer.biz/feline-fighters-the-making-of-zeptolabs-cats/), 9 August 2017. Firsthand developer interview on construction, emotional presentation, and testing. Developer's reported findings, not independently reproduced results.
[^24]: Targem Games / Gaijin Entertainment. [About Crossout](https://crossout.net/en/about), official product description, undated. Modular construction and combat consequences.
[^25]: Zachtronics. [EXAPUNKS](https://www.zachtronics.com/exapunks/), official product page, undated; game released 2018. Executable solutions and supported challenge creation.
[^26]: GFX47. [Gladiabots](https://gladiabots.com/), official product site, undated. Construct, deploy, and revise behavior. Selected testimonials were not treated as representative evidence.
[^27]: Screeps. [Official product site](https://screeps.com/) and [Introduction](https://docs.screeps.com/introduction.html), current documentation. Scripted persistent gameplay; not proof that players' LLMs run continuously.
[^28]: SpaceMolt DevTeam. [About SpaceMolt](https://spacemolt.com/about), current official description. Direct adjacency: a persistent text world for agents. No independent traction or profitability inference.
[^29]: SpaceMolt DevTeam. [Operator Spotlight: Scripts Are Cheaper Than Tokens](https://spacemolt.com/news/operator-spotlight-brocktree), 21 July 2026. One operator's account of fleet management, reusable scripts, and social experience. Anecdotal and publisher-selected.
[^30]: Mika Tammenkoski / Metacore. [The Difficult Decision of Discontinuing Everdale](https://metacoregames.com/news/the-difficult-decision-of-discontinuing-everdale), 18 September 2024. Publisher explanation of discontinuation and market-fit difficulties.
[^31]: Valve. [The Future of Artifact](https://store.steampowered.com/news/app/583950/view/3047218819080842820), 4 March 2021; text available through the [official announcements feed](https://steamcommunity.com/app/583950/announcements/). Participation and development decision, not a causal evaluation of individual mechanics.
[^32]: Davide Paglieri et al. [BALROG: Benchmarking Agentic LLM and VLM Reasoning On Games](https://arxiv.org/abs/2411.13543), November 2024, revised April 2025. Abstract and evaluation scope examined; no current universal model ranking inferred.
[^33]: Dongmin Park et al. [Orak: A Foundational Benchmark for Training and Evaluating LLM Agents on Diverse Video Games](https://arxiv.org/abs/2506.03610), June 2025, revised April 2026. Abstract and benchmark scope examined; not evidence of player enjoyment.
[^34]: Suma Bailis, Jane Friedhoff, Feiyang Chen. [Werewolf Arena: A Case Study in LLM Evaluation via Social Deduction](https://arxiv.org/abs/2407.13943), July 2024. Communication and strategic evaluation, not proof of enjoyable delegated social play.
[^35]: [SidConArena: An Environment Evaluating Agents in Open-Ended, Positive-Sum Bargaining Game](https://arxiv.org/abs/2606.27397), June 2026. Abstract describes negotiation, binding trades, and executable production. Benchmark scope only; no model-specific results are used in the recommendation.
