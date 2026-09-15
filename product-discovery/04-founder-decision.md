# Three games worth developing further

**Historical shortlist brief.** The founder subsequently asked for all three candidates to be fully developed before choosing. The [complete comparison](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/06-three-game-comparison.md) and linked product specifications now supersede the open release-scope choices below. The original recommendation is not a founder decision.

**Recommendation: develop Apprentice Expedition first, with Relay as the active alternative.** House Rules is the strongest option if the intended company is centered on creators and challenge exchange. This recommendation is provisional because the most important assumptions—enjoyable teaching, reliable transfer, and economical inference—have not been demonstrated with players.

The primary choice is the promise people should buy: **a companion I shaped**, **a partner I adventure with**, or **a world of challenges I create**. Each supports a different full game and a different business. Combining all three would conceal this decision and expand the production burden.

## At a glance

| | Apprentice Expedition | Relay | House Rules |
| --- | --- | --- | --- |
| Explain it in one sentence | Teach an inventive companion, then solve unfamiliar expeditions together | Explore different sides of a dangerous place with an independent AI partner | Build clever challenges and send adaptive agents into one another's creations |
| Human's repeated pleasure | Demonstrate, test, recognize transfer, coordinate | Discover, communicate, commit, recover | Construct, anticipate, observe, revise |
| Agent's essential work | Apply player-shaped approaches to new situations | Investigate and adapt independently during joint play | Interpret and solve unfamiliar player-created arrangements |
| Main attachment | This companion and our shared methods | This partnership and its history | My designs and my agent's approach |
| Initial audience hypothesis | Puzzle/adventure players who enjoy expressive systems and companions | Players who enjoy asymmetric co-op but also want a solo experience | Builders, puzzle creators, and programming-game players who prefer visual tools |
| Session hypothesis | 20–35 minutes, resumable | 25–45 minutes, checkpointed | 10–20 minutes to play; longer construction sessions |
| Suggested starting platform | PC | PC | PC |
| Cold-start requirement | One human | One human | One human if the authored catalogue is complete |
| Main commercial exposure | Training quality plus lifetime inference cost | Authored adventure content plus partner reliability | Creation friction, discovery quality, moderation, and compute abuse |
| Disqualifying result | Training feels like fixing a defective product | The partner supplies hints but adds little independent play | Model exploitation matters more than designing good challenges |

PC is a recommendation for inspectable controls and an initial premium audience, not an assumption inherited from the starting idea. Mobile might fit Away Team or Know Me better, but those concepts were weaker on human agency or durable depth. None of these three requires a persistent public world.

## Candidate A: Apprentice Expedition

### Intended product identity

A tactile expedition game about developing shared methods with a small, expressive, nonhuman companion. Working names: **Apprentice Expedition**, **Fieldwise**, **Small Great Things**. These names have not been searched for trademark or store conflicts.

The world is a set of compact, readable field sites containing connected physical devices, transport tasks, and optional discoveries. A stylized, crafted visual treatment would make actions, tool states, and consequences legible. A nonhuman companion avoids promising adult human competence and offers room for expressive movement; this is an expectation-setting choice, not an excuse for incompetence.

The primary fantasy is: **“We solved that in a way I taught it, and then it surprised me.”** There is no required premise about combat, economies, rankings, or a permanent online world.

### The loop

1. Enter a site with a clear main objective and optional objectives that create genuine tradeoffs.
2. Inspect the environment, try an approach directly, and choose what the companion should learn from it.
3. Compare the companion's interpretation with another possible action in a short practice situation.
4. Undertake the expedition together. The human operates a character and equipment; the companion selects and executes complementary actions.
5. Respond to a changed condition. Decide whether to adapt the lesson, tolerate a different approach, or intervene directly.
6. Finish, inspect one or two consequential moments, and keep or revise a lesson for the next site.

Teaching should occupy useful moments inside play. A long compulsory training room would undermine the product. Practice resets cost no permanent resources. Ordinary locomotion, object detection, and basic tool use are baseline competencies; players should not have to teach the agent how to avoid walking into a wall.

### What learning means here

The player shapes approaches and conventions, not the model's ability to read or press buttons. Examples might teach the companion to reuse an object creatively before consuming a limited tool, preserve an optional artifact when the route is still recoverable, or recognize a family of structures suitable for a particular joint maneuver.

An example contains the situation, the action, and the outcome the player intended. The player can compare two proposed responses and select which better represents the lesson. Optional short language can clarify intent, but the standard interface must work through demonstration, pointing, and choices. “Learned” should mean a behavior change that survives relevant new situations; it must not imply model-weight training unless that actually occurs.

The companion presents its current interpretation through a brief action preview and a compact, editable lesson record. It can say it needs another example. A visible record should identify the selected action and the lesson or observation associated with it, rather than invent an authoritative psychological explanation after the fact.

The open question is whether rich teaching can coexist with a reliable, bounded action vocabulary. If every useful lesson is just one of twelve preset toggles, adaptive agents add little. If the vocabulary is unlimited, promises become impossible to honor. This tension is the leading design risk.

### Why the human remains necessary

The human directly navigates and manipulates their own tools, decides which outcomes matter, and creates examples the agent did not have. Joint maneuvers require two embodied participants with different equipment. A more capable companion can take on richer complementary work without acquiring control of the human's body or deciding the player's preferences.

Role-specific tools are a game rule, like distinct equipment in cooperative games. They must create satisfying human action rather than a sequence of ceremonial approval buttons. A task that a competent companion can complete alone should usually be delegated; the next task should give the human something new to do, not revoke the companion's competence.

### Concrete walkthroughs

**First-time player, first eight minutes.** A short trail introduces moving, pointing, and resetting. You and the companion move a small cargo carrier across a gap using a beam. A second route can be solved by consuming a brace, but you discover that repositioning the carrier gives you the same support. You mark this as an example of reusing available objects before spending equipment. The companion previews two interpretations on a changed layout, you select one, and it performs the helpful action while you hold a release. The first payoff is a visible consequence of your example, not a dialogue compliment. Timing and intelligibility are intended targets, not observed results.

**Normal session, approximately 25 minutes.** At a wind station, you must retrieve a survey instrument and can optionally preserve a fragile specimen. You inspect the available paths, practice a joint maneuver, and set off. A platform shift invalidates your original return route. The companion proposes using the recovered instrument's case as a counterweight, consistent with the reuse lesson, but doing so would leave no protected container for the specimen. You choose the specimen, place a limited brace yourself, and ask the companion to support a longer route. At the end you retain the general reuse lesson while adding a context-specific exception. You return because there is a new site where you want to try a better method.

**Experienced player.** You distinguish a reusable principle from an overfit example. Instead of demonstrating one exact route, you show two arrangements with the same support relationship and a third where it should not apply. In the expedition you recognize when two learned methods can compose, arrange the site to make that composition possible, and time your own action to exploit it. Mastery is economical teaching plus competent play—not writing longer prompts or buying a larger model.

**Social interaction.** A friend shares a compact challenge and an outcome clip. Your companion uses a different approach because of the lessons you retained. You send back a clip that includes the relevant teaching moment, making the difference intelligible. A later private visit could put two humans and their companions on a larger site, but a launch does not need live co-op if asynchronous exchange already serves the primary promise. Adding live co-op would require designing shared control, memory ownership, disconnection behavior, and complete content for it before release.

**Memorable event.** Your companion repurposes a trophy you had left on a cart as ballast to keep an exit mechanism open. The result is funny because it follows your demonstrated reuse preference in a consequential new context. The game must establish that the trophy is a usable object and allow you to preserve or recover it. Inventing a trophy loss in dialogue would not qualify as emergent gameplay.

### Complete-release shape to investigate

A polished, finite sequence of field sites with an ending; a practice area; optional goals and genuinely different solution routes; a saved companion and reversible lesson history; accessible demonstration controls; complete support for pause/save; and replay/challenge sharing. New sites and combinations should provide ongoing mastery after the main journey. A campaign length or site count is not yet chosen because the content unit has not been proven.

A premium purchase with included core agent use is the preferred pricing hypothesis. It only survives if lifetime support and inference can fit inside the realized sale price. Cosmetic additions and authored expansion packs could support the business later, but cannot excuse an underfunded base game. Charging for intelligence or for undoing a bad lesson would undermine trust.

### Adversarial critique and revisions

**Objection: a smart model already knows how to solve these problems.** Correct. The game should test player-selected styles, invented tool relationships, and situated cooperation. It must not manufacture basic stupidity to create the need for training. If generic competence erases the value of taught methods, reject the concept.

**Objection: it is Autonauts with a fuzzier interface.** This is the most serious differentiation challenge. Autonauts-style fixed routines are the comparison condition. The proposed distinction is transfer and joint action in changing circumstances, not faster routine authoring. If that is not more enjoyable, a learning agent is unnecessary.

**Objection: teaching is homework.** Integrate examples into successful play, keep corrections local and reversible, and let players preview interpretation. If most of the audience chooses to skip teaching and use a preset companion, the primary product promise is wrong.

**Revision from the initial concept:** Move away from training essential safety skills and routine workers. Focus on player-authored approaches expressed through a small companion in shared expeditions. Keep the challenge exchange from House Rules as a possible supporting feature; do not also build a full public construction platform.

## Candidate B: Relay

### Intended product identity

A cooperative exploration adventure designed for one human and one independent agent. Working names: **Relay**, **Other Side**, **Common Ground**. The player and partner explore connected sections of a place, with local observations, different tools, and consequences that cross the boundary.

The fantasy is **“We figured it out together.”** The agent is capable from the start. Training is optional relationship tuning, not the core activity. This makes the opening easier to explain and puts more pressure on authored situations and reciprocal coordination.

### The loop and controls

Explore directly, mark relevant evidence, exchange an intention, perform complementary actions, and recover when the situation changes. Pointing and contextual requests are the default; typed or spoken dialogue expands expression. Critical information remains in a shared notebook with its origin and uncertainty visible. The player can pause outside agreed challenge modes, inspect a proposed commitment, or recall the partner.

The agent receives its own local observations and information the human elects to share. It can inspect, travel, operate allowed mechanisms, propose a plan, and report uncertainty. It does not read a hidden solution sheet. Physical execution must be reliable and immediate enough that conversational latency is not confused with a slow character animation.

### Concrete walkthroughs

**First-time player.** You can see a gate mechanism but cannot reach its power junction. Your partner is in the service corridor and can route power, but does not know which indicator you see. Point out the indicator, choose a timing signal, and cross together. The next room changes the arrangement so the partner has to ask for a missing observation. This shows reciprocal dependence within minutes.

**Normal session.** Restore a transit station while retrieving an optional archive. Your partner discovers that powering a lift disables a drainage pump on your side. You explore a maintenance passage and find a hand-operated valve. You hold it while the agent retrieves a connector, then exchange roles at the next junction. A stalled carriage changes the timing. You choose to sacrifice a shortcut to preserve the archive and coordinate a slower escape.

**Experienced player.** You communicate the information the partner needs before it asks, maintain a fallback route, and infer which action it is preparing from its visible setup. You intentionally pursue a route with a tighter coordination requirement to avoid consuming a scarce resource. Your own navigation and timing still matter with a stronger model.

**Social interaction.** Two humans and two agents could investigate four connected areas in a private mission. Each human coordinates with their partner and the other human; cross-team commitments require clear consent. The design must prove this creates useful interaction rather than four overlapping conversations. If it does not, keep the complete release focused on solo human–agent partnership and solution sharing.

**Memorable event.** After a planned shortcut becomes unusable, your partner recognizes that the maintenance cart it inspected earlier can reach you through a different passage. It brings the cart while you manually redirect a switch. Neither event alone is remarkable; the rescue is memorable because it uses previously acquired information and a coordinated human action.

### Complete-release shape to investigate

A coherent campaign with a satisfying conclusion, multiple routes through systemic encounters, a stable partner, complete communication and accessibility UX, checkpoint recovery, and replayable expeditions. Private co-op is either a fully supported release mode or explicitly absent; the design should not promise it as an unfinished checkbox.

The likely business is premium campaign sales with authored expansion adventures. There is no empty-world problem and no reason to require ranked PvP, off-session activity, or a trading economy. Repeated paid conversation would be a poor fit for the promise.

### Adversarial critique and revisions

**Objection: replace the agent with a scripted companion.** Many encounters would still work. This finalist survives only if independent investigation, flexible communication, and replanning across multiple valid approaches contribute substantial enjoyment. Its agent-necessity score is deliberately lower than Apprentice Expedition's.

**Objection: it replaces the human friend who made co-op fun.** This product serves the occasion when a person wants cooperative discovery without arranging another person's availability. It does not need to claim that an AI relationship is superior to friendship. Demand for that occasion remains unverified.

**Objection: the agent makes a mistake and wastes 20 minutes.** Use readable commitments, checkpoints, known-safe execution, and local recovery. Outages must suspend consequential actions. The tension should come from the world's changing constraints, not unreliable service.

**Revision from the initial concept:** Avoid an “AI reads the manual” variant of Keep Talking. Give the agent independent physical work and local discoveries, while preserving meaningful direct human play.

## Candidate C: House Rules

### Intended product identity

A challenge construction game in which players design fair situations for adaptive agents, then visit one another's creations through their own coached agents. Working names: **House Rules**, **Strange Instructions**, **Open Invitation**.

The fantasy is **“Look what it found in the thing I built.”** The main manipulated object is the environment. Unlike Apprentice Expedition, the player does not have to embody a second adventurer; the satisfying human actions are constructing, predicting, and revising.

### The loop and rules

Choose a brief, arrange components and constraints, state an objective using supported relationships, run a visitor, inspect the outcome, and revise. A separate visit loop offers another creator's challenge: choose a kit and a short approach, observe a bounded attempt, then coach between retries.

The world enforces the rules. Agent text cannot create items, grant success, rewrite objectives, or override permissions. Solvability checks establish only a legal solution, not that every model will find it. Unknown solvability, model version, and creator revisions must be visible.

Success compares completion, resource use, and declared design goals. A creator is not rewarded simply for making an agent fail. Visitors can use a consistent supplied agent for comparable runs; custom external agents belong in clearly marked exploratory play. Equal tokens do not establish equal capability, so a mixed-provider global skill ladder would be misleading.

### Concrete walkthroughs

**First-time player.** Receive a small authored delivery scene with a damaged bridge. Place two components from a limited tray, predict the visitor's route, and run it. The agent finds a legal alternative. The replay makes the difference visible. You edit the scene and can immediately see what your change did.

**Normal session.** Play two curated challenges, then build a museum delivery task with fragile cargo and two transport methods. Your solution uses a trolley. The visitor instead uses the trolley as a movable support for a shorter crossing. You inspect the action sequence, discover your objective allowed that interpretation, and decide whether the surprising solution is worth preserving. Publish a private challenge link with an example successful run.

**Experienced player.** Design a problem with multiple reasonable routes whose efficiency depends on reading a contextual clue. Test against several approved behavioral profiles to detect an accidental loophole. Make a harder revision by changing the tradeoff rather than hiding an obscure model instruction. Expertise is design clarity and depth, not prompt hacking.

**Social interaction.** A friend plays the same revision with a differently coached agent. You compare the exact state and actions, then collaborate on a version where both approaches remain useful. A public discovery system would need curation, duplication controls, reporting, and manageable compute limits as complete launch features.

**Memorable event.** A visitor completes a challenge using a large sign as a physical ramp instead of reading it for the intended route. This only works if signs are explicitly usable physical components and the solution respects the objective. A verbal declaration that it “used the sign as a ramp” does not count.

### Complete-release shape to investigate

A welcoming visual editor, a substantial authored challenge collection, reliable replays, private sharing, versioned content, searchable curated discovery if public publishing ships, and accessible agents that work immediately. A complete solo design-and-solve loop must carry the game before community supply exists.

A premium base game plus optional component/content expansions is plausible. An unlimited public-agent-testing service at a low one-time price is not. Usage design must distinguish ordinary creative play from large-scale automated evaluations without making creators afraid to experiment.

### Adversarial critique and revisions

**Objection: it is a model benchmark with a game skin.** Reject any scoring built primarily around defeating a model. Evaluate whether the human enjoys construction even with a familiar agent and whether visiting is more than pressing Play.

**Objection: the editor is the product and most people will never use it.** The authored visit loop has to stand alone, but strong visit content cannot compensate forever for a creation tool that produces little worthwhile material. This is the finalist with the largest ecosystem risk.

**Objection: portability makes it distinctive.** It may, for builders, but not necessarily for purchasers. A robust built-in agent is still required. Importing behavior histories is more coherent than promising any personal assistant's general identity will transfer.

**Revision from the initial concept:** Replace failure-maximizing arenas with design briefs, verified world outcomes, and readable alternative solutions. Begin with authored and private challenge exchange before committing the product to public-network growth.

## Why these are alternatives, not a bundle

Apprentice Expedition requires the best teaching experience and the clearest personal history. Relay requires the best encounter design and reciprocal partner behavior. House Rules requires the best editor, replay system, and content discovery. A shared agent capability could support all three, but that is an implementation observation, not a reason to combine their launch scopes.

The useful combination is narrow: retain short, contextual communication from Relay and compact challenge sharing from House Rules inside Apprentice Expedition. Do not inherit Relay's full separate-side campaign or House Rules' public platform.

## Founder decision

The evidence favors exploring **Apprentice Expedition** first, but it cannot decide the company’s creative identity. The choice is between an emotional ownership product, a cooperative adventure product, and a creator product. That choice changes the audience, visual expression, production discipline, acquisition channel, and defensibility.

**Decision to make together:** Which primary promise should lead the next design round? A preference for another direction can outweigh the narrow numerical ordering. No expenditure, publication, integration, or implementation is awaiting approval here; this is a product preference question.

After that choice, the work proceeds to a full specification: controls, exact session structure, agent inputs/actions/memory, progression, content scope, all required launch systems, economics, launch plan, and pitch. Unresolved capability claims remain marked as such. Choosing a direction is not the same as claiming that it has passed validation.
