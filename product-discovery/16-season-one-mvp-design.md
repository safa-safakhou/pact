# SIGNALFALL — Season 1: Last Light

**Superseded in part, 10 September 2026:** [The Discovery Race](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/17-season-one-discovery-race.md) replaces this document's mission count, race structure, prize sharing, equipment details, and pressure model following the founder's new 2,000-node direction. This document preserves the previous MVP round; document 17 controls where they differ.

## The player promise

Bring your AI into one shared world. Complete missions, improve your agent's equipment, and beat your friends' best solutions while helping humanity survive an invasion. Play alone or share discoveries with a crew. Earn levels, achievements, and cosmetics that show what you accomplished.

Season 1 lasts up to 28 days. Defend three sanctuaries, assemble the countermeasure, and defeat the Origin. If humanity loses all three sanctuaries—or fails to stop the Origin by the final deadline—the season ends in defeat. Your earned cosmetics and history remain yours.

This is the proposed first playable MVP, designed at the founder's explicit request. It supersedes the earlier instruction to avoid MVP-first scoping. It is a design only: no product, integration, playtest, or measured balance is claimed. All durations, counts, rewards, and thresholds below are initial tuning proposals.

## 1. The scope at a glance

| Item | Season 1 decision |
| --- | --- |
| Format | One shared online campaign; text and a simple companion dashboard |
| Duration | Up to 28 days; first day is a nonlethal mobilization period |
| Audience | People already using an LLM who enjoy progression, friendly competition, and cooperative problem solving |
| Session | Target 10–20 minutes; one ordinary mission targets 4–8 minutes after setup |
| World | Lantern, North Archive, and Haven; one final enemy, the Origin |
| Missions | Six families; 24 fixed research missions; 12 field-mission templates; three cooperative operations including the finale |
| Progression | Season levels 1–20; four equipment upgrades; two equipment slots |
| Rewards | Twelve cosmetic designs plus palette variants; twelve achievements |
| Social | Friend invites, temporary crews, optional alliances, shared findings, operation messages |
| Competition | Friend comparisons, a weekly solution record, and personal/crew/alliance contribution histories |
| Agent presence | One active mission per account; agent reasoning requires an active supported client session |
| Entry | Supported chat connection; no terminal, API key, or local installation required of the player |
| Price | Proposed free first season; users' existing LLM access and its limits remain their responsibility |

The first release tests a complete loop: **join → accomplish → earn → upgrade → cooperate or compete → affect the shared season → receive an ending.**

## 2. First five minutes

1. Open the game or a friend's invitation. See one sentence explaining the game, the current season state, and **Connect your AI**.
2. Choose a supported chat client. Follow its normal connection and game sign-in flow. Confirm the connection through a harmless game-status request. Unsupported clients are identified before signup; a capability description is not a promise of universal support.
3. Use the prefilled message: **“Start Last Light. Teach me with my first mission.”** Choose a callsign; everything else uses defaults.
4. Complete **First Signal**, a short guided decoder repair with a working test environment supplied by the game. The player chooses “explain as you go” or “show the important results.” Both attempt the same task.
5. Receive 100 XP, level 2, a Signal Rookie badge, and a visible receiver activation. The activation is a training result; the next recommended mission is a real world contribution.
6. See three choices: **Help the world**, **Join my friend**, **Beat a record**. Show the next reward beside them.

Target: successful connection and first reward within five minutes for a supported account. This is an acceptance target to measure, not an achieved fact. Keep interrupted sign-in resumable. Preserve invitation context and return the player to the friend or operation that brought them in.

The launch candidate should prioritize one excellent client connection, with additional clients included only after the same onboarding, solving, sharing, and reconnect checks pass. Test ChatGPT, Claude, and Grok as candidates; current extension documentation alone cannot choose the most frictionless route. If none supports this short, nontechnical flow, onboarding is a release blocker. A manual API-key setup is not the fallback player experience.

## 3. What the player actually does

Each session begins with three relevant mission cards, not a giant task catalogue. Each card shows its purpose, expected challenge, reward, available partners, and world effect. The person chooses the mission and approach, optionally equips an upgrade, and sends their agent.

Three starter approaches make prompting accessible:

- **Reliable:** preserve a valid answer, test risky assumptions, and stop before exhausting attempts.
- **Fast:** seek a valid useful result promptly; optimize afterward only if time remains.
- **Inventive:** compare substantially different methods and seek a reusable result.

The player can edit these in ordinary language. An instruction such as “use my friend's decoder, but make the output cheaper to run” has a concrete aim and knowledge source. No bonus is awarded merely for selecting a style or writing a long prompt.

During work, show a small number of real states: investigating, testing, needs input, submitted, completed, or stopped. Offer **Ask for help**, **Change approach**, and **Stop**. Finishing produces one short result card: outcome, what changed in the world, XP, next reward, and a useful next action.

The game adjudicates legal actions and results. An assistant's narrative cannot grant XP, invent a successful test, or change the world. When a session stops, save submitted artifacts and observations; the agent does not keep reasoning. Accepted effects and bounded installed defenses can continue under ordinary game rules.

## 4. Six mission families

| Family | Concrete task | Useful result |
| --- | --- | --- |
| Build and repair | Implement a decoder or correct a controller against a clear specification | Restore communication or a defense mechanism |
| Experiment and infer | Use a limited number of probes to identify an enemy's behavior | A behavioral model other agents can apply |
| Solve and verify | Produce a mathematical answer or checkable witness satisfying stated conditions | Establish a safe timing or operating range |
| Construct a signal | Generate a sequence satisfying a grammar and interacting constraints | Open a gate or redirect a compatible enemy |
| Optimize | Improve the energy or response cost of an already valid artifact | Make it usable in more constrained field installations |
| Combine | Make several verified findings work together | Complete a crew operation or an Origin prerequisite |

All families share the same presentation and reward loop. Their intellectual work differs. The MVP uses objective, versioned validation; subjective psychology, open negotiation, and unrestricted natural-language rule creation are outside this season.

One bounded choice preserves the most promising rule idea: designated beacon missions can offer **Repel** or **Lure**. Repel protects a location; Lure reveals the enemy's path but exposes that beacon during the operation. The game previews the exact accepted conditions. The player chooses, and the agent constructs the required solution. This is a curated interaction, not permission to rewrite arbitrary world rules.

### Content and reuse

There are four fixed research missions per family: 24 total. Each has a stable public identifier and a fixed problem contract. Six introductory, six standard, and twelve advanced briefs form the authored progression. Publishing A1's answer lets a friend complete A1 and earn their personal first-completion reward. A world discovery unlock happens once; shared knowledge remains useful.

The authored content ledger assigns one introductory, one standard, and two advanced missions to each row. Names describe the underlying intellectual work; presentation situates them at the three sanctuaries.

| Family | Four fixed missions |
| --- | --- |
| Build and repair | R01 Damaged Decoder; R07 Duplicate Orders; R13 Lost State; R19 Unbroken Controller |
| Experiment and infer | R02 Pulse Pattern; R08 Hidden Trigger; R14 Mimic Behavior; R20 Coupled Signals |
| Solve and verify | R03 Safe Interval; R09 Conflicting Windows; R15 Stable Boundary; R21 Origin Witness |
| Construct a signal | R04 Gate Sequence; R10 Interrupted Grammar; R16 Mimic Challenge; R22 Final Address |
| Optimize | R05 Five-Cell Shield; R11 Quiet Receiver; R17 Narrow Channel; R23 Minimal Counter |
| Combine | R06 Two Halves; R12 Shared Clock; R18 Defense Chain; R24 Final Handshake |

Each brief must include the exact inputs and acceptance rule, a valid reference solution, examples, an alternative valid approach where applicable, and the downstream use of its output before content production is considered complete. These are content briefs, not claims that final puzzles have already been authored or tested.

There are two field templates per family: 12 total. They create bounded, solvable applications to current receivers, gates, observations, or defense installations. Each issued task has its own visible identifier and stable conditions. The game never silently changes an existing problem to make a shared answer wrong.

A field task's solution must actually satisfy its installation or observation need. A success may repair a specific receiver, verify a particular threat sample, or install a controller. Only its associated real need counts toward the current defense requirement. Public-library reuse is legitimate; applying a known method to a new condition can still be useful work.

Each successfully resolved assigned field requirement is one defense unit in this initial balance model. Difficulty changes personal XP and the relevant technical contract; it does not silently multiply the unit count. The wave board shows the required installation or evidence before assignment and records its verified completion afterward.

Reserve a field task briefly while a player starts, renew the claim only on real mission activity, and release it after interruption. No exclusive claim on a whole research site. If two valid submissions race, award each already assigned participant their one personal completion; apply the world effect once. Account/mission duplication never repeats XP. Completed field needs are not endlessly respawned for the same world credit.

When no relevant live work remains, offer research, improvement, or clearly labeled practice. Practice can support personal progression but cannot invent world contributions. It earns half the normal first-clear XP per distinct practice task, and never earns live-season contribution records. XP is not tradable and does not determine competitive rank.

Keep a novice-capable share of each wave's tasks in the pool, rather than requiring everyone to unlock expert equipment. Limit each account to one active claim; alliance officers cannot bulk-reserve work for their roster. A large group can still finish a wave early. In that case, acknowledge the accomplishment and show the other worthwhile activities instead of silently adding more required work. Whether newcomers still feel included is a specific launch-rehearsal question.

## 5. The season arc

| Time | New content and pressure | Player objective |
| --- | --- | --- |
| Days 1–7: Establish contact | Basic Swarm; research missions R01–R08; all three sanctuaries available | Learn, form crews, build the first useful shared library |
| Days 8–14: Decode the enemy | Mimics mix misleading and genuine signals; R09–R16; Operation Echo | Improve validation and assemble the first Origin key |
| Days 15–21: Hold the line | Controllers combine known behaviors; R17–R24; Operation Shield | Adapt shared methods and assemble the second Origin key |
| Days 22–28: Last Light | Highest pressure; Operation Origin becomes available | Combine the two keys, complete the final intervention, and keep a sanctuary alive |

The weekly schedule is disclosed. It introduces capabilities and story beats; it does not invalidate earlier solutions. Week 4 gives a full seven-day opportunity to contribute to the finale, rather than a single live appointment.

**Operation Echo:** decode a transmission, infer its controller, and integrate the results. Produces the first key.

**Operation Shield:** identify a counterexample, improve a defense, and demonstrate compatibility across the required conditions. Produces the second key.

**Operation Origin:** combine both keys, construct the final intervention, and successfully apply it at a surviving sanctuary. A valid final completion wins for everyone. The first verified discovery and all recorded supporting contributions remain visible; the reward is not exclusively assigned to the final submitter.

Each operation has three separately creditable stages. Crews of two to four are the intended social unit; a solo player can perform stages sequentially, and large alliances can organize many crews. Sharing progress allows different people to participate at different times. Keys become public capabilities when the operation first completes. No alliance owns the only path to victory.

## 6. How pressure works

Each sanctuary starts at 100 integrity. Defense needs are actual field requirements, announced for a 24-hour wave. Players can work throughout that window. World facts and completed tasks update live; damage resolves at the displayed deadline, not whenever a player logs out.

For each sanctuary, coverage is completed required defense units divided by required units, capped at 100%. At full coverage, integrity recovers by 5, capped at 100. Otherwise it loses `20 × (1 − coverage)` integrity. At zero it falls permanently for this season. Examples: 75% coverage loses 5; 50% loses 10; no coverage loses 20. A failed individual test does not directly damage everyone.

The first 24 hours are disclosed nonlethal mobilization: players can contribute and see coverage, but integrity damage begins afterward. Thereafter, five fully unanswered waves can destroy a sanctuary. Losing all three ends the active campaign early.

Weekly demand multipliers begin at 1.0, 1.3, 1.6, and 2.0. A published base demand per sanctuary is selected before the season from prelaunch session tests; it is not set from total signups or silently raised when players succeed. For an illustrative base of 40 units per sanctuary/day, required daily totals across three surviving sanctuaries are 120, 156, 192, and 240. One unit represents a verified, necessary field contribution—not an arbitrary LLM message or puzzle answered anywhere.

The final base value is a calibration dependency: we cannot set a credible one without evidence of attendance, time per task, client limits, and reuse effects. Design and test several population scenarios before launch. If activity greatly exceeds expectations, permit success and early wave completion; do not invent hidden enemy scaling. If a sanctuary falls, its demand retires rather than automatically penalizing the remaining survivors again.

To give group learning an explicit effect, Echo reduces subsequent field demand by 10%; Shield adds another 10 percentage points. Round each sanctuary's requirement upward after reductions. The illustrative final-week demand is therefore 64 per surviving sanctuary/day after both keys, rather than 80. Equipment and shared methods also increase player capability. Testing must establish whether the rising pressure and rising ability create a satisfying challenge.

If the deadline passes without defeating the Origin, its announced final attack causes extinction. If victory or extinction occurs early, the authoritative outcome freezes; practice and the personal reward track remain available through the advertised season period. They are clearly simulations, not a second live world or a reversal of defeat.

## 7. Levels and upgrades

**One progression currency: XP.** There is no inventory of coins, premium gems, crafting scrap, or upgrade shop in the MVP. Personal rank rises through useful play and unlocks equipment and cosmetic identity. Competitive records are separate from XP.

Initial XP values: tutorial 100; introductory mission 100; standard mission 150; advanced mission 225; verified operation stage 150. A player receives a first-clear reward once per task or stage. Sharing an answer is permitted; merely forwarding messages is not a repeatable XP source. A failed operation preserves XP already earned from completed stages. Invalid attempts earn no XP and never remove existing XP or cosmetics.

Start at level 1. The proposed cumulative XP threshold for level `L` is `100 × (L−1) + 15 × (L−1) × (L−2)`, capped at level 20. This gives level 2 at 100 XP, level 5 at 580, level 10 at 1,980, and level 20 at 7,030. Aim for all functional options in roughly 12–18 meaningful missions and the full track in roughly 35–55, including achievement bonuses. These are pacing targets, not duration claims about untested models.

| Unlock | What changes |
| --- | --- |
| Level 3: Probe Lens | One extra observation on missions with limited experimental queries |
| Level 4: Revision Buffer | One extra official submission attempt on compatible field missions; baseline is two |
| Level 6: Second equipment slot | Equip two unlocked modules instead of one |
| Level 7: Field Battery | One extra unit of permitted operating energy on compatible field installations |
| Level 10: Relay Link | Once per crew operation, transfer one of your unused observation allowances to a consenting participant; creates no new allowance |

Modules are selected before the mission, cannot be stacked with themselves, and can be changed freely between missions. Every module states where it works. No upgrade claims to improve the external LLM's intrinsic intelligence. All functional choices are available by level 10; later levels emphasize prestige and cosmetics rather than an expanding power gap.

A battery can enable an installation the player's cheaper design could not support. A probe can distinguish a hypothesis the agent previously could not test. Those are observable upgrades. Sharing, joining crews, viewing public findings, and helping humanity remain available at the start.

The weekly record uses a fixed issued mission kit for everyone. Seasonal upgrades retain value in the live campaign without making the competitive record inaccessible to newcomers. External models, tools, and compute can still differ; this does not establish equal reasoning resources.

## 8. Achievements and cosmetics

Seven track designs unlock at levels 2, 5, 8, 11, 14, 17, and 20: a rookie badge, mission stamp, agent frame, crew-compatible emblem, chat-card border, veteran crest, and Last Light title treatment. Other non-equipment levels grant palette choices for those designs. Four additional designs unlock for completing 3, 6, 9, and 12 achievements. A season record seal is earned through at least one valid live-world contribution; victory adds its survival marking to that same seal.

That is twelve cosmetic designs, using simple insignia, borders, titles, and variants that fit chat and the companion page. Hosts that cannot display decorative cards show equivalent text titles. Customization must never make mission status harder to read.

The twelve achievements each grant 100 XP once:

| Achievement | Requirement |
| --- | --- |
| First Signal | Finish the tutorial |
| Answer Passed On | A second player completes a mission using your deliberately shared artifact |
| Better Together | Complete different stages of one operation with another player |
| Field Tested | Complete five distinct live field tasks |
| Investigator | Complete three distinct experiment missions |
| Builder | Complete three distinct build/repair missions |
| All-Rounder | Complete a first clear in all six families |
| Second Draft | Fail a valid attempt, revise it, and pass that task |
| A Better Answer | Meet a published improvement target on a valid baseline artifact |
| Hold the Line | Contribute to three different successfully defended waves |
| Crew Veteran | Complete both Echo and Shield with recorded contributions |
| Leave a Light | Complete ten distinct live tasks or operation stages across at least three families |

The tutorial's own 100 XP plus its once-only achievement reward therefore yields 200 total XP, still level 2 under the proposed curve. The result card shows these as separate earned events.

No daily login streak, loss of earned levels, paid XP boost, or purchase-only solution advantage. The match outcome and dated competitive honors are exclusive to the live season; ordinary track cosmetics remain earnable in post-season practice. Lost humanity is not rewarded with a mechanically superior or specially desirable cosmetic.

Seasonal levels and equipment reset for the next live season. Owned cosmetics, achievements, solution history, friends, and alliance identity persist. Previously learned methods remain knowledge; they are not guaranteed to solve changed future systems. Define the next season's reward track later rather than promising unspecified future features.

## 9. Cooperation and competition

An invite link opens a specific crew or operation, not just the homepage. A crew shows stage ownership, submitted findings, who needs help, and one shared message thread. Sharing controls are **Private**, **Crew**, and **Public**. Private data is not automatically exposed by joining an alliance.

Every participant who completes a required stage earns the stage's full personal XP. Rewards are not divided among the roster. Idle participants do not earn every stage's rewards. Solo completion of three stages earns all three stage rewards; a three-person crew can each earn one in parallel. The world operation completes once, regardless of how many accounts receive personal completion records.

Alliances have a name, emblem, membership roles, shared library, operation board, and an announcement channel. No membership-count power bonus or artificial small-alliance multiplier. Large alliances gain coverage and a broad knowledge pool; small crews gain autonomy, close relationships, and legible ownership of an achievement. Large alliances can also contain small crews—do not pretend that organization size can be perfectly balanced through labels.

For competition, launch one **Weekly Record** on a real defense artifact: correctness is mandatory, then compare operating energy and response cycles as separate records. Display friends first, then the global results. Rank artifact behavior under the same versioned tests; do not rank raw chat token speed or who can claim to have used the cheapest provider. The challenge changes weekly and remains viewable afterward. An improved artifact can be adopted in the live world where compatible.

Identical copied artifacts receive a completion and tie on measured quality; they do not claim a new world-first invention. Shared results remain shareable. First-known provenance and later improvements are shown separately. One best result per account/objective is displayed, so flooding submissions creates no extra leaderboard entries. Valid official tests have a modest per-account submission limit stated before entry; private external reasoning remains unobservable and is not claimed to be normalized.

Alliance records show verified world work and credited discoveries, not total XP or registered members. Personal histories retain the names behind a group achievement. No destructive player-versus-player attacks, trading economy, or territorial monopoly is included in Season 1.

## 10. Simple interface

The first screen contains only the current world situation, the next personal reward, and three actions. Detailed logs and rankings open on request.

```text
SIGNALFALL · LAST LIGHT                Day 9 / 28

WORLD      3 sanctuaries remain · Next wave: 6h
YOU        Level 5 · Next: second equipment slot
FRIENDS    Mira needs help with Operation Echo

[ PLAY ]          [ JOIN FRIENDS ]          [ MY AGENT ]
```

**Play:** three mission recommendations and the weekly record. **Join Friends:** invite, crew state, and alliance board. **My Agent:** level track, equipment, approaches, achievements, and cosmetics.

Mission card: one-sentence purpose, estimated complexity, reward, world effect, partner state, and **Start**. Result card: pass/fail, useful explanation, XP/level change, world change, and **Next mission** or **Share**. Never show placeholder “live” numbers; label connection state, timestamps, and stale data explicitly.

The dashboard is optional for ordinary chat play but must be available for live observation and account management. Support keyboard navigation, text scaling, clear contrast, and status words as well as color. Do not expose tool names, token accounting, or implementation internals in the ordinary player flow.

## 11. MVP release boundary

**Required:** working supported chat entry; complete onboarding; six task families and their validators; the full 28-day content schedule; field needs and pressure; all three operations; genuine victory/defeat; level/reward delivery; upgrades; cosmetics; invitations and crew sharing; basic alliances; the weekly record; live status; save/reconnect; reports, blocking, moderation, support, and an end-of-season archive.

**Outside this season:** eighteen mission families, unrestricted rule rewriting, subjective psychological scoring, a player-generated mission marketplace, voice, graphical character movement, real-money trading, destructive PvP, an elaborate guild economy, and paid always-on agents. These are deliberate scope decisions, not missing pieces of the promised core loop.

The free first season is a funded product experiment, not an assertion of a profitable business. Players use their existing supported LLM access. Game-hosted test execution, storage, traffic, moderation, and support still cost money even if the game buys no ongoing inference. Budget those against measured cost per completed mission and the planned population before opening registration. Hosted reasoning and monetization require separate design work.

## 12. Development and validation plan — design only

Build in this order when implementation is later authorized:

1. **First-session slice:** connection, one real mission, an objective result, XP, and the first cosmetic. Establish that a newcomer can reach the reward without developer assistance.
2. **Social and competitive slice:** invite a friend, divide two pieces of work, share an artifact, and compare two valid solutions. Verify that individual contribution remains visible.
3. **Progression slice:** the first ten levels, all modules, a weekly record with fixed equipment, and varied tasks. Look for an actual reason to choose one approach or upgrade over another.
4. **Season rehearsal:** exercise a shortened campaign with the same world rules, all pressure transitions, interrupted sessions, and both endings. Include sparse attendance, a concentrated large alliance, and widespread answer sharing.
5. **Release completion:** finish all content, cosmetics, accessibility, moderation/support, load testing, and the real end-of-season flow before the announced start.

These slices are production learning steps, not a substitute for delivering the complete first season described above. Test the riskiest interaction early; avoid building the entire content catalogue before the connection and social loop work.

Proposed evaluation gates, not achieved metrics:

| Check | Initial decision rule |
| --- | --- |
| Entry friction | At least 8 of 10 unfamiliar supported-client users reach the first reward unaided within five minutes; record each step and failure |
| Comprehension | At least 8 of 10 can explain what they choose, what their agent does, and how a mission affects progression and the world |
| Social play | At least 4 of 5 invited pairs complete a shared operation and can identify each person's contribution |
| Voluntary interest | Observe whether players choose another mission, inspect a rival, or invite someone without a researcher's instruction; do not infer fun from task success alone |
| Progression | Early levels arrive promptly; all functional choices are reachable without exceptional agents; measure actual task counts and engaged time |
| Fair result | Every authored task has an independently checked valid solution and tests for plausible alternative solutions; confirm invalid outputs fail and replayed rewards are not duplicated |
| Season integrity | Test passive decline, recovery, all-sanctuary loss, timeout, early victory, simultaneous completions, and reconnect during resolution |
| Access to contribution | Newcomers and unaffiliated players can find useful work when large groups possess most published answers |

Small formative samples guide iteration; they are not market-validation claims. For the live season, track connection-to-first-win conversion, voluntary second sessions, friend-invite completion, reward pace, adoption of shared artifacts, mission abandonment, support burden, and cost per completed task. Segment by supported client and task family without collecting unrelated chat history. Treat repeat use as incomplete evidence until paired with player feedback about why they returned.

Provider faults, invalid game tasks, and player mistakes must be distinguished. Refund an attempt lost to a confirmed game fault and correct affected records. Use a disclosed shared clock pause for a severe game outage. Do not quietly rewrite difficulty or erase earned rewards as an ordinary balance adjustment. A common season magnifies mistakes, so publish changes and their effect on comparisons.

## 13. Design grounding

The proposed design combines a short action–feedback–reward cycle, progressive disclosure, early attainable progress, optional mastery, cooperation with individually earned rewards, and a tightly limited first release. These are applied design judgments, not a guarantee of fun.

Deep Rock Galactic's first-season account explains using play-earned cosmetics and visible progression to give both new and experienced players goals, and explicitly discusses measuring and adjusting progression pace. We adopt those principles, not its hundred-level scale or time requirement. [Developer FAQ](https://www.deeprockgalactic.com/season01-faq).

Guild Wars 2's historical guild-mission redesign explains removing entry barriers for smaller guilds and allowing personal commendations even when a guild had already completed a mission. That informs open access and individual completion rewards here. [ArenaNet design article](https://www.guildwars2.com/en/news/guild-halls-missions-for-all/).

Supergiant describes designing Hades to evolve through community feedback. That supports validating the first-session and cooperation loops before expanding the content catalogue; it does not imply that the proposed scope or schedule has been validated. [Hades FAQ](https://www.supergiantgames.com/blog/hades-faq/).

The existing [shared-survival design](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/15-signalfall-shared-fate.md) and [source register](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/05-sources.md) retain the task-validation, shared-method, rule-manipulation, and connected-client research behind this MVP. This document controls Season 1 where earlier proposals differ.
