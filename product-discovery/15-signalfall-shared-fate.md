# SIGNALFALL: shared survival, personal ambition

The founder subsequently requested a design-only MVP for the first season. [Season 1: Last Light](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/16-season-one-mvp-design.md) defines that narrower scope and controls where details differ. This document remains the broader product vision.

## The proposed game

One humanity, one active world, one outcome everyone has to live with. Players enter through a connected AI conversation, direct an agent through intellectual challenges, and compete to leave a greater mark on a collective struggle for survival.

Humanity can win. Humanity can also go extinct. Players can belong to a partnership, an alliance of ten, a coalition of a thousand, or none. Solving, experimenting, inventing, negotiating, sharing, and choosing how to use knowledge determine both the common outcome and individual distinction.

This develops the SIGNALFALL pitch into a product hypothesis. The new campaign, reward, alliance, and prompt mechanics are proposals, not validated balance or implemented features. The earlier promise that an agent continues reasoning after its player leaves is withdrawn. The intended initial model requires an active connected agent session. Optional future hosted agents are a separate commercial possibility.

## 1. One world with a real ending

The Swarm is advancing across a network of inhabited regions. Its source, the Origin, cannot be defeated through accumulated damage alone. Humanity must discover how it works, construct compatible countermeasures, and successfully execute a final intervention before the last viable sanctuary falls.

There are three ongoing fronts of work:

- **Keep people alive:** intercept immediate threats and preserve the systems sustaining remaining sanctuaries.
- **Understand the enemy:** uncover stable laws, languages, mechanisms, and vulnerabilities through fixed sites and experiments.
- **Build the ending:** combine discoveries into one of several feasible approaches to the Origin.

The final approaches could be isolation, control, or disconnection. They share an ultimate objective but impose different preservation requirements and dependencies. The community can pursue more than one approach. A corporation cannot own the only permission to attempt humanity's victory.

Sanctuaries can fall. A failed local mission does not instantly eliminate humanity, but neglected threats can produce visible cascades. The game does not secretly rescue the last sanctuary to guarantee a satisfying finale. Neither should its enemy difficulty silently rise whenever players become successful.

Major threat phases and the conditions for their resolution are announced far enough ahead to support several time zones. Routine research does not demand attendance at a particular moment. Short urgent challenges exist inside longer campaign opportunities. The world progresses without any particular individual present; it does not assume that all registered accounts have an agent running.

Campaign pressure must be calibrated against a plausible population of active sessions, with published phase rules and sufficient reserve time. Unexpected population collapse can still result in defeat. Verified game-service faults warrant a disclosed common clock pause or correction; normal absence does not. A permanent game-master override that manufactures every close finish would invalidate the stakes.

**Victory:** the final intervention succeeds while humanity remains viable. The campaign closes as a survival history.

**Extinction:** the last viable sanctuary is lost before a successful intervention. That campaign closes as a defeat. No inhabitants from that history are quietly restored to make the result less painful.

The proposed service continuation is a later shared campaign after the conclusion, with a fresh active world and retained player identities, records, and cosmetics. There is only one live campaign at a time; archives are historical records, not alternative live servers. Sequential campaigns are an explicit proposal to make terminal loss compatible with a continuing game, not an assumption that the founder has accepted resets or a particular calendar.

## 2. Play from an AI conversation

The intended player experience after connecting a supported client:

> Show me humanity's situation and what my alliance accomplished since I last played. I have twenty minutes. Find something where a useful result is achievable, and compare it with what Mira is attempting.

The game returns a current, timestamped report. The assistant can explain the options in ordinary language, accept a mission within the player's authority, obtain its challenge materials, use permitted tools to solve it, and submit a result. The world confirms the actual outcome.

Ordinary chatting about a fictional victory does not change the world. An authenticated game connection and a validated action do. Personal assistants do not need access to a player's unrelated mail, files, or conversations to participate.

The mission must expose any necessary test or experiment environment through the game. A player should not discover halfway through a coding task that their chosen chat cannot run the required local tools. Client support is a tested capability matrix, including authorization, tool calls, artifact submission, resumability, and optional embedded UI.

Official documentation now describes relevant integration surfaces for all three named ecosystems: OpenAI's ChatGPT app/plugin flow, Claude custom remote connectors, and Grok custom MCP connectors. This establishes plausible routes to in-chat play. It does not establish that our game is connected, that all account configurations permit the same actions, or that every client supports the same live interface or uninterrupted execution. [OpenAI app guidance](https://learn.chatgpt.com/use-cases/chatgpt-apps), [Claude connector guidance](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), [Grok connector guidance](https://docs.x.ai/grok/connectors).

### The world clock and the agent session

| Situation | What continues | What stops or waits |
| --- | --- | --- |
| Connected agent is actively playing | Reasoning, experiments, communication, and valid submissions | Nothing within its granted mission limits |
| Assistant turn ends or the connection is lost | Shared world simulation and already committed effects | New autonomous reasoning and commands from that agent |
| Player returns | Retrieval of saved findings and current conditions | Expired opportunities are not recreated |
| An ally takes over | Work on a shared artifact with granted permissions | Private unshared work remains private |
| A previously installed counter operates | Its bounded, deterministic game behavior | It cannot invent new responses or silently call a hosted LLM |

The game cannot reliably know whether a person is physically watching a chat window. “Active” should mean a supported, connected play session supplying actions, not a claim of human attention. Opening a page is not enough to keep an LLM thinking. Some clients may support longer work than others; the game must show when further user input is needed.

Mission progress should checkpoint at useful boundaries. Temporary claims expire when an inactive player would otherwise block others. A valid submission already accepted before disconnection can finish its deterministic evaluation. No new autonomous mission chain starts merely because a user left an instruction saying to play forever.

## 3. The live situation must be readable

The same world report is available through chat and a lightweight live companion page. Embedded cards are an enhancement where the host supports them. The companion page remains useful for people watching a frontier or an alliance operation; it contains status and controls rather than a rendered game world.

A fictional report might read:

> **Humanity:** 4 sanctuaries viable. North sanctuary fails if the next breach is unresolved.\
> **Origin:** two prerequisites verified; one unresolved; intervention not yet possible.\
> **Next threat phase:** resolves in 6 hours.\
> **Your agent:** connected; testing a counter; two experiments remaining.\
> **Your crew:** 3 participants active; waiting for a verified decoder.\
> **Your rival:** holds the lowest-power valid counter for this threat.\
> **Your work:** one deployed method, used successfully in 7 recorded defenses.\
> **Report freshness:** updated moments ago; historical chat messages retain their original timestamps.

Use recorded facts, objective prerequisites, and transparent forecasts. Do not present a fabricated “humanity has a 23% chance of survival” as a live metric. If a model estimates an outcome, label it as an estimate, show relevant assumptions, and keep it separate from server facts.

Metrics to expose include validated task progress, submitted attempts, allowed experiment budget, actual defense outcomes, useful artifact dependencies, personal achievements, and comparable solution records. Full reasoning traces and provider token counts are neither necessary nor uniformly available. Raw message volume, account registration totals, and unverified agent self-reports are poor measures of contribution.

## 4. Three ways a player's words matter

### Direct an approach

A player can create and revise a reusable instruction for their agent:

> Preserve a known working answer before trying improvements. Spend the first experiment on a case that distinguishes the two strongest explanations. Ask our ally for an existing decoder before writing another. Publish counterexamples immediately, but keep unfinished code within our crew.

Another player may emphasize speed, risk, independence, or optimization. Those choices can change which evidence gets collected, whether an agent asks for help, when it stops, and what kind of result it produces. Results should show the decisions and artifacts that actually occurred. They do not prove that the prompt alone caused a performance difference.

This is a player's evolving playbook. Useful playbooks can be shared and remixed with attribution. Good starter instructions let newcomers play without learning prompt jargon. Expertise comes from applying and revising a method under actual conditions, not knowing a secret phrase.

### Choose a different objective

The same mission can support different accepted contracts:

- Disable the hive's transmitter as soon as possible.
- Capture the transmitter intact, preserving the opportunity to learn its protocol.
- Redirect its output so the approaching Swarm reveals a second source.

The person can ask for an approach in ordinary language. The game states what it recognizes, its requirements, and the consequences before commitment. Capturing intact can require a stronger solution and expose more of the committed expedition resources. A safer shutdown might save the sanctuary sooner while destroying a research opportunity.

There are no bonus points simply because the player used eloquent wording. A chosen objective creates a testable outcome and a different game tradeoff.

### Change a local rule

Some recovered systems allow a bounded rule alteration. For example, a beacon normally repels matching creatures. The player proposes:

> Make it attract infected creatures and let uninfected creatures pass untouched. I will give up the beacon's shield while it operates.

At this site, attraction is an available transformation, infection can be classified through observable evidence, and disabling the shield is a permitted cost. The game previews the resulting local rule, affected objects, duration, and exposure. The agent must then construct a classifier and controller that satisfy it.

This can turn a defensive system into a lure, create a new opportunity for an ally, or fail because the classifier is inadequate. The wording expresses the player's intended combination. The accepted rule is bounded and recorded; the LLM does not have permission to change the score, declare victory, redefine all players as enemies, or forgive a failed condition.

Unsupported proposals are explained before resources are committed. More open rule creation requires a sufficiently reliable way to validate its effects and cost. It must not become an opaque language-model judge accepting some players' loopholes and rejecting equivalent ones.

## 5. A broader mission vocabulary

Mission families should differ in what the agent must do, how the player directs it, and what the result enables. The following eighteen families form a content vocabulary to curate, not a commitment to ship eighteen unrelated minigames.

| Family and example | Agent activity | Player's influence | Validation and world effect |
| --- | --- | --- | --- |
| **Build:** a damaged receiver | Implement a transformation from a complete specification | Prefer immediate usefulness or a reusable general solution | Behavioral tests; restores an instrument |
| **Repair:** a faulty defense | Diagnose a failure and patch existing logic | Preserve efficiency or replace a brittle approach | Regression and new-case checks; stops a known vulnerability |
| **Infer:** an unfamiliar organism | Form hypotheses and predict its behavior | Choose an aggressive or cautious investigation | Declared prediction domain and evidence; enables a counter |
| **Experiment:** a sealed laboratory | Choose the most informative tests from a limited allowance | Budget probes and accept uncertainty | Recorded experiments and a checked conclusion; opens a mechanism |
| **Prove:** an unstable boundary | Supply a checkable witness or proof | Seek a sufficient bound or a stronger reusable theorem | Supported formal or finite verifier; makes an operation safe |
| **Optimize:** an expensive shield | Improve a valid solution's power, memory, or delay | Select which tradeoff to pursue | Shared resource measurements; fits defenses into more sites |
| **Translate:** an unknown protocol | Infer grammar and meaning from structured evidence | Explore broadly or specialize in one useful message | Valid held-out exchanges; enables communication |
| **Reconstruct:** a fragmented archive | Recover missing data under known consistency constraints | Prioritize complete recovery or a critical fragment | Checksums and cross-record consistency; restores information |
| **Investigate:** conflicting records | Establish which account fits the evidence | Select a theory to pursue and when to seek independent review | Explicit evidence and causality model; reveals an actual dependency |
| **Design:** a new instrument | Compose available components into a useful device | Define the desired operating qualities | Simulation within known rules; creates a deployable capability |
| **Generate:** a constrained signal | Produce a string or structure satisfying interacting rules | Trade simplicity, speed, or coverage | Published character/grammar predicates; activates a system |
| **Negotiate:** a neutral enclave | Discover preferences and construct acceptable commitments | Decide which concessions and relationships matter | Explicit fictional preference model and accepted agreement; gains cooperation |
| **Coordinate:** separated stations | Communicate partial observations and align actions | Choose partners, delegation, and contingency terms | Joint state conditions; enables a distributed operation |
| **Challenge:** a claimed defense | Find a valid counterexample in a nominated test environment | Bet on a suspected weakness and set effort limits | Reproducible failure; earns a defect bounty and improves public safety |
| **Predict:** a changing front | Issue forecasts with stated scope and uncertainty | Choose the horizon and acceptable exposure | Outcomes resolved against actual events; improves preparedness |
| **Preserve:** a vulnerable archive | Compress useful knowledge while retaining needed meaning | Decide which future tasks matter most | Defined reconstruction/use tests; keeps information usable after loss |
| **Adapt:** a previously unseen variant | Transfer an old method and identify what changed | Reuse a trusted method or investigate from first principles | New-condition tests; extends a working defense |
| **Rewrite:** a recovered rule system | Implement a legal local change and demonstrate its effects | Author the desired rule and accept its cost | Bounded rule semantics; changes possible actions in that location |

Psychological reasoning belongs in modeled negotiation and inference where appropriate; real human motives are not treated as having one secret correct answer. An exact answer, a useful approximation, a design frontier, and a negotiated outcome need different evaluation contracts.

Each family needs elementary, substantial, and expert content. Complexity can come from novelty, conflicting constraints, incomplete evidence, combinations, or difficult verification. Long prompts and large random strings do not automatically supply depth. Experimental generation needs certified solvability and coherent rules; attractive prose cannot compensate for a broken task.

Campaign variety also comes from combining families. An initial translation task can lead to experimentation, then instrument design, then a negotiation about who may deploy it. Avoid requiring every operation to pass through the same sequence.

## 6. Alliances of ten or a thousand

Alliance membership is voluntary and not the same thing as taking part in every mission. A large alliance can organize many smaller operations. Independent crews can cooperate temporarily without merging their identities or surrendering their discoveries.

| Group choice | Concrete advantage | Concrete cost or limitation |
| --- | --- | --- |
| Independent operator | Full choice of work, partners, publication, and accepted risk | Less parallel capacity and no guaranteed knowledge network |
| Small crew | Direct influence over decisions; easier selective sharing; a visible share of a finite operation's credit | Limited simultaneous coverage, fewer specialties, fragile availability |
| Large alliance | Many specialties, broad shared knowledge, several active fronts, and voluntary coverage across time zones | Negotiation over priorities and access, coordination work, less individual influence over common commitments |
| Temporary coalition | Combine forces for a major operation while retaining separate groups | Must agree on contributions, disclosure, control, and credit for that undertaking |

For example, a ten-person crew may agree quickly to investigate a risky idea and divide a bounded operation bounty among its actual contributors. A thousand-person alliance may fund several approaches at once, supply known tools, and cover more regions. It does not multiply that one bounty by a thousand just by listing members.

Small operations can have intrinsic exposure costs: every participating field agent creates another observable signal, or each live station requires additional synchronization. In a covert operation, using fewer participating agents preserves a real advantage. Broad rescue or analysis operations may benefit from more participants. The cost follows the actual operation footprint, not a guild name or a punitive percentage attached to membership.

Personal accomplishments and crew records provide a reason to maintain a small identity even when cooperating with larger groups. A large alliance should not have to be destroyed for a small crew to achieve an admired record.

However, a capable large alliance can organize excellent small crews and share knowledge with them. Arbitrary membership bonuses cannot prevent that; groups can coordinate outside the game. There is no promise that ten people will equal a thousand in total campaign influence. The aim is valuable work, autonomy, and attainable distinction at several scales, with limits on monopolizing common infrastructure.

Controls over contributed artifacts and local resources require explicit grants. Membership alone does not let a leader spend an individual's mission stake. Essential survival objectives retain public access paths, reservations expire, and knowledge cooperation remains possible outside formal alliances. No one alliance gets an exclusive veto over humanity's final intervention.

## 7. Compete by becoming more useful

There are three visible forms of distinction:

1. **Personal:** a verified discovery, a powerful invention, a specialist accomplishment, or a best measured result on a defined objective.
2. **Crew:** the people who completed a difficult operation under its recorded conditions.
3. **Alliance:** verified campaign contributions across regions, with the underlying contributors visible.

The central rivalry is constructive: your friend makes a working defense, you improve it, another group finds a counterexample, and a fourth creates a more robust version. Each can earn a different recorded achievement while humanity gets a better defense.

For a shield contract, a player might hold the lowest-power result, another the shortest response delay, and another the broadest validated coverage. Each category has an explicit correctness threshold and measurement environment. There need not be one opaque total score that crowns the same owner in every activity.

Challenge bounties operate on copied or nominated test artifacts, not live defenses protecting someone else's sanctuary. Winning a test can reduce a rival's claim to an unbeaten record, but does not directly kill their population. Rivalry can also involve racing for finite discoveries, negotiating access, or choosing when to share. Those choices may indirectly hurt the common cause; that tension remains real.

Published methods preserve discoverer and improvement records even after wide adoption. A proposed finite operation pool could reserve 35 credit for discovery, 35 for the working counter, 20 for a useful independent verification, and 10 for successful deployment. These are illustrative weights, not tuned balance. Equivalent duplicate submissions do not mint new pools. Later improvements require a new, explicitly valuable target rather than endless tiny edits for points.

Recorded provenance establishes actions within the game. It cannot perfectly establish who first thought of something outside it, whether an answer was shared privately, or how much outside inference someone purchased. Rankings should not claim to measure pure human intelligence, model intelligence, or prompt quality under equal compute.

Fixed A1/A2 missions continue to allow sharing and personal completion. A first-world-discovery record is separate from a player's own first completion. Familiar answers can spread, while optimization and combination support useful play after basic discovery. Both eventually have limits; substantial new authored systems are still necessary.

## 8. Something stays with every participant

The reward system should recognize verified participation without requiring world-first discoveries. A newcomer using an existing method to complete a needed task can earn personal progress. A useful verified counterexample or a successful contribution to a shared operation can count. Merely generating messages or intentionally failing repeatedly does not.

Rewards fit the actual surfaces players see:

- Agent identities: earned callsigns, profile insignia, and optional portrait treatments.
- Chat presentation: mission-card borders, status themes, and signature stamps where supported, with equivalent text titles elsewhere.
- Personal chronicle: a readable record of the places, inventions, and groups that the player helped.
- Social identity: crew crests, alliance banners, and displayed contributions to important events.
- Accomplishment displays: a collectible record of a discovered system or a verified specialist achievement.

These do not change an answer's correctness or create extra command capacity. Earned identity should look connected to actual events: a seal showing that the player's counter protected North Archive is more meaningful than an unrelated hat.

At either campaign ending, earned personal rewards and historical credit remain. Extinction is recorded honestly. A player can have contributed well to a campaign humanity lost. Victory adds a shared survival distinction for eligible contributors and its associated celebration. There should be no mechanically superior or uniquely desirable reward that encourages players to cause extinction deliberately.

Some recognition must be attainable through reasonable participation; some can remain exceptional. The system cannot promise every player the same title or every player a high ranking while also offering genuine competition. A welcome identity is universal; further progression follows defined contributions.

Live deployments and campaign power do not carry untouched into a new world. Retained methods can still be useful where their assumptions apply, while changed systems require new work. This avoids presenting a recurring campaign as fresh while mechanically guaranteeing the oldest accounts permanent control.

## 9. A complete ordinary session

All names, times, metrics, and outcomes in this walkthrough are fictional design examples.

You open your preferred connected chat and ask for SIGNALFALL. Humanity has four sanctuaries left. A threat phase resolves in six hours. You have twenty minutes available; your agent has no promise of continuing after the session.

Your ten-person crew, Lantern, is investigating a controller. A thousand-member alliance, Meridian, is protecting the surrounding regions. Your friend Mira holds the best measured low-power defense for the current threat, using eight energy units in the defined test.

You say:

> Use Mira's published defense as the baseline. Find a version that uses six energy or less, without losing its existing coverage. Ask Lantern for the timing model. Preserve anything that works, and stop after two unsuccessful experiments.

The agent retrieves the baseline, obtains the shared finding, and explains the known route to improvement. It does the coding and tests. You have set a meaningful objective, an evidence source, a stopping policy, and a collaboration choice.

The first revision fails a particular synchronization case. The agent preserves the valid baseline. A crew member's agent contributes a counterexample that explains the issue. Your revised approach succeeds at six energy under the contract's defined coverage.

The lower resource requirement makes the defense eligible for deployment in a station that could not run the eight-energy version. The world effect is a newly usable defense, not damage points paid for unrelated code.

Now another opportunity appears. A recovered beacon can attract the same creatures toward a sealed site. You propose a local rule alteration, accepting loss of its shield while preserving uninfected targets. The game previews the accepted rule and exposure. You decide to save that risky attempt for a live crew session, and publish the tested defense now.

You earn the improvement record. Mira retains the original design record. Your crew member earns the verified counterexample contribution. Meridian uses the improved artifact in a legitimate defense operation; that outcome credits its deployment and your actual artifact dependency.

You end the session. Your agent becomes inactive. Your saved work remains available under your sharing permissions, and the deployed bounded counter can operate as a world mechanism. The next time you connect, you receive a report of its actual use. You may also see that Mira has improved the design again.

The return motive is a combination of personal rivalry, a shared method gaining significance, a risky idea to attempt with friends, and a world whose ending is still uncertain.

## 10. Lessons from existing games

These sources support particular mechanics or observations. Their success does not validate this proposed combination, and they prevent a credible claim that nobody has explored any of its ingredients.

| Reference | Established feature or finding | Design interpretation for SIGNALFALL |
| --- | --- | --- |
| **Pandemic** | Shared victory or defeat while players contain threats and pursue a solution | Maintaining the present and achieving the final objective should compete for effort; extinction must be an actual state |
| **Foldit** | Research describes shared and remixed automation recipes, individual/group competition, and live solution scores | Player-authored methods, copying, improvement, and rivalry can coexist with a collective problem-solving purpose |
| **Opus Magnum** | Players compare simple, fast, and compact solutions | Offer several meaningful measured achievements rather than only raw volume or one opaque ranking |
| **Baba Is You** | Manipulating explicit rules changes the game's behavior | Natural language can express legal local rule changes with visible semantics and consequences |
| **Guild Wars 2** | A historical redesign removed resource barriers to guild missions and separated personal rewards from the guild's first completion | Joining a huge organization should not be the entrance fee to meaningful group play; personal credit needs its own path |
| **No Man's Sky: Leviathan** | An expedition paired personal progress with community research that improved shared conditions and provided persistent rewards | Connect personal accomplishment, collective improvement, and memories of a campaign |
| **In Other Waters** | Exploration is mediated through an interface, signals, observations, and interpretation | A compelling place can be communicated through instruments and writing without character rendering |

Sources: [Pandemic](https://www.zmangames.com/game/pandemic/); [Foldit cookbook study](https://www.khoury.northeastern.edu/home/scooper/index_files/pub/cooper2011analysis.pdf); [Opus Magnum](https://www.zachtronics.com/opus-magnum/); [Baba Is You](https://www.hempuli.com/baba/); [Guild Wars 2 design article](https://www.guildwars2.com/en/news/guild-halls-missions-for-all/); [Leviathan expedition](https://www.nomanssky.com/2022/05/expedition-seven-leviathan/); [In Other Waters](https://www.fellowtraveller.games/in-other-waters/).

The particular opportunity is joining chat-based LLM play, authored intellectual worlds, consequential shared campaigns, player-shaped methods, and personal rivalry. Its differentiation must be demonstrated in experience. SpaceMolt and the earlier source register remain relevant direct adjacencies; familiar ingredients do not establish either sameness or uniqueness of the complete product.

## 11. Future hosted agents and the hard unresolved problems

Hosted reasoning could reduce setup friction and support longer play. It could also buy a direct competitive advantage through more active time or greater capability. Labeling it premium does not resolve that conflict.

One possible direction is selling convenience within the same world-action allowance used by external agents. Another is allowing open competition with honestly disclosed capability and availability differences. Neither guarantees equal outcomes: more external compute is difficult to observe, and more time can improve a final artifact even when submission counts match. Premium autonomy therefore remains future work, not a launch assumption or a promised fair upgrade.

The important remaining design tests are concrete:

1. Do owners care about their directives, discoveries, and rivalries when agents perform the detailed work?
2. Can a player recognize how their changed instruction affected the attempted approach, without pretending that every success proves superior prompting?
3. Are small independent groups satisfied in a world where large alliances can also organize small teams?
4. Does helping others preserve enough credit to make publication attractive, while selective sharing remains a meaningful social decision?
5. Are extinction, campaign continuation, and persistent rewards emotionally coherent rather than a cosmetic reset?
6. Do interrupted chat sessions support complete, enjoyable missions? Can promised time windows accommodate real client behavior?
7. Does the mission catalogue sustain varied intellectual activity after answers and methods spread?
8. Can the product support reliable adjudication, meaningful live metrics, moderation, and shared-world integrity at its eventual cost?

Release scope should be chosen around verified versions of these loops. This document defines the next substantial design round; it does not declare the complete 1.0 specification settled or substitute a prototype for the legitimate public game required by the original brief.
