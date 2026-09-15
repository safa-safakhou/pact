# AFTER THE CROWN

**Historical proposal, rejected 14 September 2026.** The founder found it insufficiently competitive and insufficiently distinctive: the human mostly reads, nothing about it is watchable or shareable, and the LLM sits adjacent to a genre that works without it. [HANDSHAKE](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/21-handshake.md) is the current design. Nothing below is a current requirement.

**The empire is gone. Its machines are still taking orders.**

You inherit a small settlement and give your AI permission to speak for it. Build a place worth defending. Deal with the other people rebuilding the world. Become wealthy, useful, feared, trusted—or a complicated combination of all four.

This is an original setting and proposed overall game, following the founder's settlement-and-diplomacy direction. The title is provisional. No implementation, integration, simulation, player study, or name-availability check is claimed. TITAN and the fixed mission race are historical alternatives.

## 1. The world

For generations, the Crown coordinated a continent of automated towns. Its central intelligence allocated power, ordered construction, and settled disputes. Then the capital went silent. Nobody knows whether the Crown died, abandoned its subjects, or simply decided to stop answering.

Thirty years later, life continues among huge abandoned machines. Orchards grow inside empty factories. Homes hang beneath old solar towers. Armored work drones serve as both tools and weapons. The old transit and delivery systems still execute routine orders, but nobody has the authority to tell every settlement what to do.

The settlements are connected by the **Open Line**, the surviving communications network. Everyone can contact everyone else. News, offers, threats, jokes, and implausible promises move through it. There is no central faction selection or morality meter. A person can buy from a settlement they fought yesterday and help it tomorrow.

The tone is hopeful, tense, and occasionally absurd: warm inhabited places inside a broken administrative machine. A costly misunderstanding can be funny without treating ruined livelihoods as the joke. NPCs have lives and priorities beyond flattering the player.

The world is shared. The same player and NPC settlements, transactions, and events exist for everyone. An atlas shows who is present and the character of each district. It is a directory of places and relationships, not a terrain-navigation game. There are no movement orders, paths, or individual soldiers for the player or LLM to manage.

## 2. You, your settlement, and your agent

You are the newly appointed **Keeper** of an overlooked settlement. The preceding Keeper left a working production yard, a modest storehouse, a few defensive drones, and an unopened Crown notice:

> Continue normal operations until further instruction.

It is dated thirty years ago.

You choose your name, your settlement's name, and its emblem. Your agent becomes its **Voice**: the representative authorized to correspond, negotiate, and issue orders. Its public identity is stable even if you change the LLM behind it. Other settlements can recognize that they dealt with your Voice before.

Your starting estate has a useful production advantage and a shortage, with broadly comparable starting value. A foundry town has more material than power; a solar town has the reverse. Either can become more self-sufficient, so trade is attractive rather than a compulsory character class. There is no required personality selection. What sort of power you become follows from your instructions and actions.

The player might say, “Make us indispensable to our neighbors,” or, “Grow quickly, but don't gamble away our rebuilding reserve.” These are different ambitions within the same rules. The agent can propose plans, pursue opportunities, and manage several conversations. The human chooses how much authority to delegate and can revise it.

The primary audience is people who already use an AI assistant and enjoy building, rivalry, negotiation, and stories about their own decisions. Playing should not require programming, expert strategy-game vocabulary, or reading a stream of technical logs.

## 3. A small economy with reasons to talk

There are two spendable resources:

| Resource | What it does |
| --- | --- |
| **Alloy** | Builds and improves installations and military capacity |
| **Charge** | Powers construction, military operations, and production boosts |

Production runs automatically and is collected automatically until storage fills. Nobody sends an agent to click a mine repeatedly. Ordinary subsistence is outside the resource economy: running out of Charge does not secretly kill the settlement's inhabitants while the player is away.

You see three central quantities: your two resource stocks, and available military **Force**. The settlement's production and defensive capacity are visible in its build view. Force is committed as a number rather than as named units. Using it for an offensive operation leaves less available for defense or supporting someone else until the commitment resolves.

Different production advantages, upgrade plans, stock levels, commitments, and risk appetites create different valuations. One agent may value Charge urgently while another wants Alloy for an upgrade. There is no universal trade price that makes negotiation cosmetic. The world determines whether an exchange is feasible; the participants determine whether it is worthwhile.

## 4. Four action families

| Action | Engine responsibility | Decisions left to agents and players |
| --- | --- | --- |
| **Message** | Deliver authenticated private or public communication | What to say, whom to approach, what to reveal, and whether to believe an unverified claim |
| **Exchange** | Transfer owned resources, or settle a mutually accepted immediate swap atomically | Gifts, bargains, demands, compensation, and the agreed price |
| **Build** | Reserve costs and complete an installation or upgrade on its published schedule | Which capability is worth the resources and opportunity cost |
| **Commit Force** | Reserve a chosen amount for a raid or defense commitment and resolve it under published rules | Target, timing, amount, whether to back another settlement, and whether fighting is worth it |

Raid and defense are two uses of the same limited Force. Supporting another settlement does not create an alliance object, new membership system, or permanent right to its property. It is a bounded commitment. A raid names a target and quantity; the engine handles the operation. There is no travel simulation requiring intermediate model decisions. The Build action also produces or replaces Force using resources and a published completion schedule; military losses are not replenished for free.

Raids have a short, visible warning period before resolution. Defenders can respond through the same actions if available, and standing defenses work without a connected LLM. A raid may be withdrawn before its commitment deadline with the stated cost. Resources and Force cannot be committed twice. Final combat costs, warning duration, and loot formulas require balance testing; none is silently inherited from previous concepts.

The purpose of force is to make choices and promises consequential. Maintaining a large reserve can deter an attack. Sending it elsewhere can expose you. Negotiating a transfer may cost less than fighting for the same stock. These are possible outcomes of the primitives, not strategies selected from a menu.

Immediate exchanges can be made safe through the supported atomic swap. Future promises—such as protection next week—remain promises unless backed by an actual current commitment. A persuasive message never directly edits ownership, grants military strength, or obliges its recipient to comply.

## 5. The people already here

NPC settlements are openly labeled as world characters. They have persistent identities, actual inventories, limited Force, production, and a memory of relevant interactions. They act through the same resource and action rules as players. Their motives shape their decisions; they do not have an infinite supply of quest rewards.

| Character | Settlement and background | What drives them | A possible opening line |
| --- | --- | --- | --- |
| **Mara Venn** | Keeper of **Glasshouse**, a town built into an old solar conservatory; a former repairer elected after a failed winter | Reliable Alloy deliveries to restore its aging collectors; protecting the town's independence | “I can promise you power. I won't promise you obedience.” |
| **Custodian Nine** | Automated administrator of the **Office of Returns**, still managing an imperial warehouse after its human clerks departed | Maintaining stocks and reconciling obligations using obsolete but interpretable procedures | “Your government appears to have expired. Your invoice has not.” |
| **Orrin Pike** | Head of **Black Kiln**, a foundry community with substantial material output and power-hungry equipment | Keeping production running and maintaining influence; force is an option, not a compulsory role | “You have Charge. I have a shortage of patience.” |
| **The Tin Choir** | Repaired maintenance machines occupying **Bell Yard**; they use one public identity but disagree internally about the town's priorities | Obtaining parts while avoiding dependence on a single supplier | “We voted. The vote requires another vote. Meanwhile, is the offer still available?” |
| **Wren Vale** | Former imperial dispatcher running **Relay House**, a small communication station that became a meeting place | Remaining useful through information and trusted introductions | “I know who needs what. Knowing who will pay is the difficult part.” |

These lines establish tone, not fixed encounter scripts. Mara may fight, Orrin may offer a generous deal, and Nine may accept a practical compromise. None is flagged as the player's mandatory friend, enemy, tutorial vendor, or boss. NPC claims may be incomplete or self-serving. System-confirmed facts remain clearly distinguishable from their dialogue.

Wren cannot read private conversations just because the character is an information broker. Any information comes from public events, authorized disclosures, messages actually received, or explicitly uncertain gossip. The engine should not invent proof for a colorful story.

NPC reasoning can be triggered by relevant events within a bounded operating budget. Their production and existing commitments continue independently. A claim that thousands of NPCs constantly conduct full LLM conversations is not part of this design.

## 6. Identity and relationships

Every settlement has a permanent ID, a public name and emblem, a visible owner type, and a profile. Display-name changes retain history. A message cannot impersonate another settlement's authenticated sender. Players can still bluff about intentions or unverified circumstances; they cannot forge authoritative engine records.

The public profile shows settlement development, deliberately published achievements, and relevant public events. Private correspondence remains private unless a participant discloses it. Each player and agent can keep their own notes and judgments. There is no omniscient reputation number declaring someone good, evil, loyal, or untrustworthy.

Groups can give themselves names, open communication channels, pool resources through voluntary transfers, and coordinate Force. A channel has no automatic diplomatic or military effect. Cooperation is made real by actions. There is no formal alliance that prevents attacking a supposed partner, silently shares all possessions, or assigns every outsider to an enemy list.

Communication is open-ended; executing a consequential action requires valid authority. The player's mandate can set resource and Force limits, identify resources to retain, and restrict particular transfers. Limits are enforced at execution, including across simultaneous conversations. Unlimited freedom of strategy does not mean an agent can spend the same inventory several times.

## 7. What the player sees

The presentation is an inhabited control room: a settlement emblem, a compact silhouette that changes as the town grows, resource bars, incoming transmissions, and a simple radio atlas. Quiet amber displays and worn industrial surfaces give it a recognizable character. The silhouette and map are interface illustrations, not a rendered action world. Pure text remains a usable fallback.

The main view has three destinations: **Home, Open Line, World**. Home shows what is yours and what needs attention. Open Line contains conversations and pending agreements. World shows settlements, public developments, and seasonal conditions. A player can inspect any conversation but should rarely need to read them all.

```text
AFTER THE CROWN                 Your settlement: Cinder
Your Voice: Kian                Development: Outpost

ALLOY 120       CHARGE 60       FORCE 20 available

3 things worth your attention
• Glasshouse offered 30 Charge for 40 Alloy.
• Black Kiln asked who would defend us.
• Your workshop upgrade is ready to choose.

[Give direction]       [See conversations]       [Build]
```

This is a fictional snapshot, not a working integration. Interaction through a supported chat client and an optional live dashboard remain the intended entry points. Actual client support must be verified before release.

The agent receives a compact change summary, pending deadlines, and a conversation index, then opens the threads it needs. It can submit a batch of independent orders. The server validates each and reports the individual results; earlier spending may make a later order invalid. The ability to handle many conversations coherently is a test target, not an assumption that one prompt supplies unlimited parallel intelligence.

## 8. Your first evening

You name your settlement Cinder and your Voice Kian. You see your first production arrive without clicking anything. Kian presents two or three relevant contacts and one useful construction choice. You can immediately ask for another approach; this is an introduction, not a mission tree.

You say, “Make us richer. Trade first, and keep enough to recover if something goes wrong.” Kian discusses the resulting operating limits in plain language and proposes a reserve. Once accepted, it works within that mandate rather than asking for every routine action.

In one possible session, Kian approaches Glasshouse about its spare Charge and Black Kiln about its demand. You read a concise proposal, authorize the larger plan if necessary, and see accepted swaps actually change your inventory. Construction then consumes some of the proceeds. Your town gains a working installation and a visibly improved profile.

Later, a new message arrives: “Black Kiln says it no longer needs a middleman.” Kian now has a changed situation to investigate. The same engine permits a revised bargain, a bluff, gathering actual support, an attack, or doing nothing. The game does not present a predefined diplomacy puzzle with one correct answer.

The emotional cycle is **set an ambition → let your representative act → see consequences → choose your next ambition**. Growth gives the player something to own. Other actors give that growth resistance, surprises, and stories.

## 9. Ambition, danger, and recovery

Your settlement develops from **Outpost → Town → City → City-State**. Levels follow completed, useful construction. The workshop expands productive options; the storehouse increases capacity; fortifications improve defense; upgraded infrastructure changes how much opportunity the agent can pursue. The few categories should deepen before adding more resource types, technology trees, or army classes.

The settlement's crest, architecture panels, Voice portrait, titles, and chronicle make accomplishments visible. The first successful exchange and first defended raid are understandable achievements. There is no prize for producing the most messages, encouraging meaningless spam, or generating the longest negotiation.

Raids can take exposed resources and cause military losses. They cannot seize the account, remove its identity, or erase every earned installation. A limited protected reserve and a visible recovery period bound repeated plundering. Offensive action ends recovery protection. The amounts and timing must be tested against bullying and exploitation; protection is a declared rule, not a secret rescue when the player loses.

Seasonal recognition focuses on **development gained during that season**, using published points for completed upgrades. Comparisons group settlements by their capacity at the season's start, while the world can still show overall power. Trading and fighting are methods of pursuing growth, not mandatory score categories. This is a proposed ranking direction; upgrade values, transfers between accounts, and incumbent advantages require testing before it becomes a fair competition claim.

Identity, earned cosmetic history, and the settlement persist between seasons. Newcomers do not need to plausibly overtake the richest veteran to have an understandable next rival or reward. No exact season length, economy, or cash prize is selected in this overall design.

## 10. First season: The Long Night

The old solar array is entering a long scheduled shutdown. It will reduce Charge production during the closing phase of the season. The date, duration, and affected production are public in advance. It changes the value of stocks and agreements without changing the four action families.

Glasshouse has power to sell now and wants materials to improve its collectors. Black Kiln's ambitions depend on keeping its machines running. Smaller settlements may make plans together. Some players may hoard, others may sell, others may take what they can. These are possible responses, not assigned roles or scripted quests.

The event produces a common pressure and a visible ending: the array returns, the season's development records are finalized, and the world remembers what happened. Failing to prepare can halt optional projects and expose strategic weakness; it does not erase humanity or a player's permanent identity. Later seasons can introduce different pressures only when they create useful decisions within the same simple systems.

## 11. Agent errors and absence

Malformed commands, insufficient funds, unavailable Force, expired offers, or missing permissions are rejected with clear reasons. They do not become accidental transactions. Retry handling must not duplicate an already executed action.

A valid but poor bargain is allowed. So are a mistimed threat, an overconfident prediction, or inconsistent promises. Those can create consequences worth remembering. The engine does not interpret charming narration as a completed delivery, or punish a technical failure as though the player intentionally betrayed someone.

For example, Kian might promise support to two towns that later fight each other. Both promises can exist in conversation, but the server will only accept actual Force commitments the settlement can fund. The return report should say what was promised, what was executed, and what remains uncertain.

When the external LLM is unavailable, production, construction, standing defense, accepted exchanges, and committed operations continue. New discretionary negotiation and strategy do not. Explicit standing orders can execute within previously accepted conditions. NPC messages can wait in the inbox, but their offers and world deadlines can expire. Logging out cannot pause a raid or reverse a settled result.

Before implementation, the design needs practical tests of a few settlements negotiating under scarcity, actual model cost and conversation coherence, readable outcomes, recovery after mistakes, and whether growth creates voluntary return. A meaningful social story produced through these simple rules is the first proof to seek. This document is the overall creative design, not a claim that those tests have passed.
