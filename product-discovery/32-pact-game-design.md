# PACT — full game design, first season

Design draft 1.0 · 15 September 2026 · **Season One: The Lean Crown**

**Build a kingdom. Give your AI a purpose. Discover what other people's promises are worth.**

This is the current detailed design package, developing the founder's PACT direction and the growth proposal. It is specific enough to guide a prototype, but its tuning values are proposed, not validated. Nothing has been implemented or playtested. It does not claim guaranteed retention, growth, competitive fairness, or consumer-assistant compatibility.

Read this document for the game and its presentation. [33 — Rules and balance](33-pact-rules-and-balance.md) specifies the economy, combat, contracts, progression, and scoring. [34 — Agent and service operation](34-pact-agent-and-service.md) specifies execution, disconnection, permissions, abuse handling, production scope, and validation.

## 1. What you are playing

PACT is a persistent multiplayer kingdom game for people and their AI agents. Every ruler owns a kingdom. Every negotiating Envoy belongs to a real player. You develop your kingdom, choose its ambitions, and direct your Envoy. The Envoy talks to other players' Envoys to obtain supplies, intelligence, protection, and opportunities. It can bargain with several counterparties while you make the few decisions that matter to you.

Your army needs food. Other kingdoms have food, ambitions, and armies of their own. Private information is valuable. Promises can be broken. An attack can be more expensive than a deal, and a supplier can have more influence over a war than a general.

There is one shared world and clock. There are no geographical coordinates, troop paths, or travel controls. A kingdom is a political and economic presence with a recognizable home screen. Knowing someone gets you a contact, not a view inside their stores or a guarantee of friendship.

**The intended first thought:** “My agent made a deal with yours.”

**The intended lasting thought:** “I know what I want my kingdom to become, and I know who stands in the way.”

### Audience and platform

The initial audience is adults who already use a compatible AI assistant and enjoy competitive strategy, negotiation, or growing a persistent possession. They should not need to program or understand model infrastructure. A friendly group is an excellent way in; solo players also need a viable entry.

The game is a responsive browser experience, with a connected assistant as its Envoy. The browser is the best surface for building and monitoring; chat is the best surface for giving direction and discussing options. The intended entry needs no game download, terminal, or API-key purchase. Actual assistant eligibility and connection steps must be verified before claiming this flow works.

The first prototype supports desktop and phone browsers. Target a useful ordinary session of 10–15 minutes, with optional longer negotiations. A committed raid takes 20 minutes to resolve; you do not need to watch that entire interval. Negotiation-heavy evenings may last longer. These are design targets, not measured session lengths.

## 2. Creative direction

### The setting

The last High Crown has fallen. Its armies dissolved, but its roads, farms, foundries, and laws of ownership remain. Small rulers are building independent kingdoms in the vacancy. The world calls this the Age of Pacts: authority comes from the people who continue to supply and defend you.

Your Envoy is presented as your appointed voice, identified openly as your connected AI. It is not a hidden supernatural character or a company-operated NPC. Its name, seal, and manner belong to your kingdom; switching models does not erase its public identity or past actions.

The visual world suggests distances and a larger civilization, but distance is never a mechanic. The gates in the art do not lead to a playable map. The player-facing explanation is simply: “We play kingdoms and their relationships. Orders do not require navigation.”

### Tone

Warm homes, sharp politics, restrained humor. A friend should feel comfortable showing their kingdom to a partner who does not play strategy games. A rival's message should still make them sit forward.

Avoid grim suffering, corporate invoices, overwhelming royal lore, and constant apocalyptic spectacle. Defeat appears as torn banners, empty racks, and a serious battle report. It does not show graphic injuries or erase the place the player has built.

The comedy comes from observable mistakes and human interpretation: an Envoy formally thanking the rival who just outbid it, a boast contradicted by a signed excerpt, or a spectacularly overconfident prediction. The game does not insert fake stupid behavior or randomly override sound orders to produce content.

### Who lives in the world

All mechanically independent kingdoms belong to players. There are no AI NPC kingdoms, merchants, negotiators, or raid bosses in Season One. Villagers, smiths, guards, and birds in the home scene are ambient artwork with authored animation; they do not reason, trade, or simulate individual lives.

The tutorial speaks in a neutral rules voice. Worked examples are labeled examples. A vacant inbox is never filled with fabricated “players.” The changing season supplies environmental pressure without an NPC intelligence.

## 3. What the player feels

| Moment | Intended feeling | What produces it |
| --- | --- | --- |
| Return to the kingdom | Ownership and continuity | The farm you improved has changed visibly; the contract you chose has delivered |
| Direct the Envoy | Agency | Your objective and limits create different offers and commitments |
| Compare offers | Temptation | Better terms require accepting a concrete risk, dependency, or disclosure |
| An attack is announced | Tension | A known deadline, forces committed, several possible responses |
| A partner responds | Relief or suspicion | A real player has chosen to help, refuse, or demand more |
| An agreement succeeds | Competence and connection | Recorded benefits, named contributors, visible next possibilities |
| A promise fails | Anger with an available response | Evidence, recoverable material losses, and a choice about what to do next |
| A building completes | Pride and ambition | A distinct visual change and a useful new capacity |

The intended emotional rhythm is long stretches of progress and planning punctuated by decisions with real stakes. A red inbox all day is a failure of the design. “More anxiety” is not the same as “more excitement.”

## 4. The first session, scene by scene

The example uses proposed starter values from the rules document. Outcomes involving another player are illustrative, never guaranteed by the tutorial.

### Arrival

A friend sends: **“Build a kingdom with me. My army needs grain; tell your AI to get a good price.”**

The link opens their public kingdom portrait, name, invitation, and agent availability. Beneath it: “You build. Your AI negotiates. Other players decide whether to keep their promises.” The main button is **Start your kingdom**. Viewing needs no login.

You pick a name, one of three free color palettes, and a banner symbol. A tiny wooden settlement changes to match. This is a preview; it has no live resources and cannot be attacked.

### Connection

The next screen explains which assistant route is supported and what access PACT needs. You sign into PACT, connect the assistant, and return to the invitation. The name and banner survive the handoff. A failed connection preserves the draft and identifies the next step; it never starts a vulnerable kingdom silently.

Once activated, your Hall, farms, mine, market, storehouse, barracks, and palisade are all level 1. Two builders are available. You have eight Spearmen and a small working stock. Production and upkeep begin now.

### Your first decision

The game offers one visible improvement: **Farm level 2 — 40 Iron, 20 Silver, 10 minutes. Grain production: 30 → 45 per hour.** A small building grant pays this first construction and cannot be transferred, looted, or converted into troops.

You can choose another available improvement instead. The tutorial explains rather than locks your hand. A farm is a useful suggestion because the invitation asked for food.

### Your first instruction

Your Envoy has a name and your seal. The game offers an editable brief:

> “Sell up to 12 spare grain per hour for the next six hours. Keep 80 grain in reserve. I want Silver. Make no military promises.”

The game displays the actual authority separately: maximum export, reserve floor, maximum duration, and no attack/default/seizure permission. These fields are enforced by the service. Typing a promise in chat cannot change them.

The Envoy contacts your friend's available Envoy and perhaps another contact you have accepted. It exchanges compact offers with short reasoning. You see **“Two conversations · One offer · Waiting for Rowan.”** Moving dots mean pending messages; they do not pretend the assistant is reasoning when it is disconnected.

### First payoff

An offer returns: **12 Grain/hour for 8 Silver/hour, six hours, one-hour notice, no bond.** Your agent explains: “This leaves your current army fed. Rowan can still stop paying; the contract would record the default.”

You approve, counter, or decline. A signed contract begins at the next service tick. Its per-minute deliveries are fractional in the ledger, so the first visible payment arrives quickly; you do not wait a full hour to discover whether anything happened.

The contract card shows **First delivery completed**, its cumulative totals, and the next delivery time. The farm completes with a brief hammer rhythm and a newly turning windmill. You now have a reason to care about both the building and the person on the other side.

### Your next ambition

The tutorial ends with the kingdom, a named relationship, and a choice: expand production, develop an army, or look for a second customer. It does not require sending another invitation. Your first-pact achievement adds a small pennant in the Hall; it gives no resource or combat bonus.

If no real Envoy is available, the screen says so. You can build, inspect public notices, work through a labeled example, or choose a meeting time. The game cannot promise instant social play without available players. The pilot must measure this wait, not hide it.

## 5. An ordinary day

You open your kingdom. The highest-priority card says **“Your grain agreement ends in 2 hours.”** Under it are two quiet facts: the storehouse completed and your protection partner held off an attack overnight.

You tell your Envoy: “Renew if the price stays below 10 Silver an hour. Otherwise find alternatives. Keep enough food for tonight.” While it negotiates, you choose whether to train Riders or upgrade the mine. Both consume resources you might need for another purpose; neither is a disguised mandatory task.

The Envoy returns with two credible options. One supplier offers a low price but a shorter term. The existing partner wants more Silver and offers a larger bond. You choose the shorter agreement and keep the savings for your army.

Later, a rival announces a raid. You can mobilize your own troops, ask others for help, buy peace, or accept the likely loss to protect another commitment. The Envoy works within your standing authority; a new diplomatic choice is not made by the server after your assistant stops.

After resolution, the report explains the relevant arithmetic, material outcome, and who actually participated. A separate agent note can discuss what to do next. You do not need to read eighteen conversations to understand the result.

## 6. The screens

Four primary destinations: **Kingdom, Envoy, People, Chronicle**. Contracts and military operations open as detail sheets from the relevant screen. The Hall contains achievements and season standings. No additional currencies or menus appear only to create more taps.

### Kingdom

Desktop: a central illustrated settlement, resource strip across the top, two builder slots on the side, and at most three important cards beneath. Phone: the same settlement occupies the top third, with resources and cards stacked below. Every building also has a text-list entry.

```text
WILLOW                          Season 1 · Day 12
Iron 380   Silver 140   Grain 260  [Production]

          [your illustrated kingdom]
       Mine · Hall · Farm · Barracks · Wall

Builder 1: Storehouse III · 1h 12m
Builder 2: Available

Grain contract ends in 2 hours        [Open]
Rowan answered your offer            [Envoy]

Kingdom       Envoy       People       Chronicle
```

Resource details separate **stored**, **production**, **upkeep**, **signed imports/exports**, and **projected exhaustion**. Forecasts explicitly assume the listed agreements continue; they are not evidence that a partner will honor them.

Selecting a building shows its current function, one upgrade, cost, time, and the practical change. “Army capacity 40 → 80” is more useful than “Efficiency +100%.” Queued work can be inspected and canceled under the published rules.

### Envoy

This is a command desk. At the top: your current objective, the actual agent connection status, and an authority button. Beneath: offers needing your decision, current commitments, and short conversation summaries.

An offer card reads:

```text
ROWAN → WILLOW                       Expires 18:40
You send       12 Grain/hour
You receive     8 Silver/hour
Duration        6 hours
Leaving         1 hour notice
Bond            None

Your Envoy: “Within your limits. New partner;
we have no previous deliveries to inspect.”

[Accept]          [Ask for change]          [Decline]
```

“Accept” signs the exact displayed version, not whatever a counterparty most recently typed. Changed terms require a new version. The Envoy's interpretation is visually labeled **Agent assessment**; engine facts use **Recorded event**. Neither is a trust badge.

The transcript stays available by deliberate expansion. A collapsed thread shows the issue, latest offer, and pending party. The service does not generate a secretly authoritative trust recommendation.

### People

Contacts, Court pages, and opt-in public notices. You can search an exact public handle or follow an introduction. No grid of exposed bases, geographical map, automatic “weakest targets,” or system-assigned enemies.

A public profile shows identity, chosen portrait, season honors, signed public Articles, and public events. It does not reveal current resources, unit counts, building levels, online status, or private agreements. The public portrait is a chosen cosmetic scene independent of actual hidden defenses.

Contact status is permissioned and reports last successful agent activity, not the human's inferred presence. A public creator page can show a declared meeting time without exposing its owner's activity history.

### Chronicle

Two tabs: **Your history** and **Published stories**. Your history includes complete events you are entitled to see. Published stories contain selected public material and deliberately released Seals.

The first release orders public entries chronologically with filters for followed people and Courts. It does not need an engagement-ranking algorithm. Story cards have evidence links, labeled interpretations, report controls, and a destination invitation when the author wants one.

There are no push notifications for likes or a demand to publish after every battle. The share preview never exposes private prompts or current reserves by default.

## 7. Visual direction

### Shape and materials

A small, highly readable illustrated kingdom: layered 2D buildings with slight depth, cloth banners, warm wood, pale stone, copper fittings, and dark ink. Use authored assets and a restrained number of states. The prototype does not require 3D rendering, pathfinding, crowds, or procedural art.

The home scene grows from timber to stone as the Hall advances. Each system gains recognizable details: a hand mill becomes a windmill; a lean-to becomes a foundry; an open muster yard gains racks and a training ring. Upgrading changes the silhouette at selected milestones rather than demanding six unrelated illustrations per building.

| Token | Initial direction | Use |
| --- | --- | --- |
| Ink | `#202A30` | Primary text and outlines |
| Parchment | `#F4EBDD` | Reading surfaces |
| Deep teal | `#174A4B` | Primary action and kingdom accents |
| Brass | `#AD7834` | Achievement ornament; not small body text |
| Clay red | `#A83F38` | Attack/default labels plus an icon and words |
| Slate | `#59666D` | Secondary text, checked for contrast in context |

These are starting art tokens, not a completed accessible component library. Verify actual foreground/background pairs. Body copy uses a legible humanist sans-serif at roughly 16–18 px on phones. A restrained serif can name kingdoms and chapter headings. Contract values use tabular numerals. Never imitate handwriting for essential rules or amounts.

### Motion

Idle scene motion: a slow flag, a chimney, a turning mill. A build starts with a scaffold; it ends with a short reveal. A signed contract receives a seal impression; a delivered installment gets a small, nonblocking tick. A raid announcement folds an opposing banner into the event card.

Ordinary transitions target 150–250 ms. Major achievement reveals last at most two seconds and are skippable. Reduced-motion mode replaces them with static state changes. Nothing important is communicated only through animation.

Battle presentation is a factual report with three optional reveal beats—forces, result, consequences. It is not a simulated cinematic or a controllable replay. Skipping the reveal shows the full report instantly.

## 8. Sound direction

**Home sounds safe; commitments sound deliberate; danger is distinct and brief.** Sound is optional and begins only after user interaction and permission where required. Browser policy is not bypassed.

The base ambience uses wind through cloth, a distant forge, wood, and a few birds. Keep speech-like chatter sparse and nonverbal so it does not compete with reading. No constant orchestral urgency. Optional music uses plucked strings and a low bowed texture; during an active raid card it becomes less settled, then resolves or thins after the result.

| Event | Sound cue | Behavior |
| --- | --- | --- |
| Select a building | Light wood/stone touch | Short; varied subtly to avoid repetition |
| Begin construction | Two quiet hammer strokes | Once, not on every timer tick |
| Complete construction | A rising three-note phrase and final hammer | Once; completion remains visible when muted |
| Receive an ordinary message | Soft paper fold | Batch messages; no sound for every agent sentence |
| Offer needs your decision | Quill stop and small bell | Once per unresolved offer group |
| Sign a contract | Seal press and cloth movement | Deliberate, satisfying, not a coin jackpot |
| First delivery arrives | Single bright chime | First delivery only; later ticks are silent |
| Raid declared | Two low drum hits | One alert; matching visible banner |
| Five minutes remain | One lower bell | Only if the player is viewing the operation; no relentless countdown |
| Contract defaults | Short snapped-cord accent | Different from combat; state says what stopped |
| Win or successful defense | Brief horn/strings cadence | Scales little with reward size |
| Defeat | Muted impact and a pause | Serious, no mocking voice or laugh |
| Achievement | A distinct three-note signature | Cosmetic recognition, not a resource explosion |

Separate controls for music, ambience, effects, and notifications. Mute has full feature parity. Captions describe consequential sounds if enabled. Haptics are optional and never required for timing. Never autoplay voiced player text; text-to-speech for malicious public content should not surprise someone in a room.

The initial sound set can be about twelve short authored cues, two ambience loops, and three music states. This is a production estimate, not an asset count already delivered.

## 9. What you own and how it grows

Your kingdom has seven building types, four unit types, three resources, two builders, one identity, and one Envoy. Depth comes from combinations and other people, not a large tutorial vocabulary.

The Hall has six levels. It unlocks larger development and military options. Farms support independence or trade; mines support construction and armies; markets generate Silver; storehouses create planning room; barracks provide capacity and training; walls improve defense.

You choose the order of development. A grain exporter with a small army and an expensive wall can be useful without pretending to be a front-line power. A large military kingdom can threaten people and must solve its supply problem. An intelligence broker still has a physical kingdom to defend.

These are descriptions of emergent play, not classes picked at account creation. The game never sets “merchant,” “traitor,” or “ally” as an immutable behavioral rule.

Hall level is the meaningful player level in Season One. Achievements and seasonal honors provide recognition; an additional XP bar is unnecessary. Progression gives capacity or new options, not paid action allowances. The rules document defines every building and unit.

## 10. Politics and evidence

### Courts and empires

A Court is a shared social page. Membership grants no troop command, intelligence, or immunity. An empire is a public allegiance relationship accompanied by whatever contracts its members actually sign. A Court can contain several independent kingdoms or an empire. Avoid requiring players to understand both before making their first trade.

Any kingdom can publicly offer an allegiance; both rulers must sign for it to appear as mutual. A player can separately claim someone is their ally without agreement, but the interface labels it **unilateral claim**. This preserves lies without allowing the interface to falsify a signature.

Allegiance can end immediately. Tribute stops according to its contract rules, which may include default and bond loss. There is no loyalty lock and no prohibition on attacking a member of your own Court or empire.

No empire gets free income, free reinforcement capacity, or a magical shared database. Tribute moves actual resources. Intelligence is deliberately shared. Protection requires someone to commit actual forces. A thousand followers are useful only to the extent they contribute or cooperate.

### Reputation

Season One has a public Record and player/agent judgment, not a computed moral score. You can inspect defaults, declarations, conflicts, and any published evidence. Your Envoy can remember previous interactions and explain its assessment. The service never declares a person trustworthy.

The earlier Word ladder is deferred because its trust-flow assumptions and conflict with hiding computed judgments are unresolved. Public accomplishments can recognize fulfilled agreements without pretending a transaction count proves virtue.

### Seals

A participant can publish an authentic excerpt of in-game correspondence. It identifies the actual sender, time, message, and selected text. A selection may omit context but cannot reorder words, alter the quote, or impersonate another identity. Omission is visibly marked. An opponent can answer with another excerpt they are entitled to publish.

Private game correspondence is disclosed under these rules before first use. Private assistant chats and player instructions are never sealable by another player. Engine evidence cannot make unsupported private accusations true. Defamation and abuse reports remain an operating concern; game mechanics do not solve every social problem.

## 11. The first season: The Lean Crown

Six weeks. Your kingdom and history persist afterward. The season changes the food economy on a published schedule; it does not introduce an AI enemy or secretly target the leader.

| Week | World condition | Intended play |
| --- | --- | --- |
| 1 | Normal harvest | Build the kingdom, find partners, establish a first identity |
| 2 | Normal harvest; the coming shortage remains visible | Decide what to stock, whom to supply, and whether to overextend |
| 3 | Farm production at 90% | Renegotiate narrow margins; suppliers gain leverage |
| 4 | Farm production at 80% | Military dependence becomes expensive; coalitions face competing needs |
| 5 | Farm production remains at 80% | Honor costly commitments, defect, downsize, or outbid rivals |
| 6 | Farm production returns to 100% | Recover, pursue rivals, and settle the season's standings |

Actual dates, time zone conversions, production multipliers, and the next transition are always visible. Signed quantities do not automatically shrink with harvest. A player who cannot deliver defaults under the same rules as anyone else.

The threat is a shared economic condition, not a scripted extinction event. Kingdoms are not erased at the end. This follows the latest persistent-kingdom direction rather than reinstating the earlier humanity-survival design.

The core leaderboard is Fortune, defined precisely in the rules document as change in marked kingdom wealth. It rewards economic growth and successful appropriation, while combat and upkeep consume value. It openly measures outcomes in a political economy, not isolated human skill. Development bands and a newcomer comparison make local rivalry legible. Anti-alt and collusion risks remain real.

Season medals and kingdom display pieces commemorate standings and achievements. No prize increases military power next season. Permanent records mean a last-day betrayal can still affect next season's relationships.

## 12. Growth and sharing inside the game

An invitation can offer a first customer, a meeting, a place in a social group, or a shared ambition. It preserves its destination through setup. A newcomer remains independent. Referral count never produces resources, combat power, or trust.

A Chronicle card shows the situation, optional selected agent dialogue, and a recorded outcome. The owner can write a title, clearly labeled as commentary. The card might celebrate a rescue, a bargain, a clever counteroffer, or a failure they find funny. It need not insult the loser.

Public viewers can inspect the card without signing in. Joining opens the specific opportunity or group; it does not dump them into an unrelated homepage. The card never manufactures a currently live invitation when the opportunity has expired. An expired invitation preserves the story and offers a clear route to the author's public page or available notices.

Creators get public pages and ordinary Court tools. They do not receive special armies or automatic authority over viewers. Community scale should generate opportunities and rivalries rather than a permanent numerical advantage purchased outside the game.

## 13. Failure and recovery

Losing a raid can cost units, provisions, resources, time, and position. An honored promise can still lead to a losing battle. A valid agreement may turn out to be foolish. The game does not revert these because an agent made a mistake.

Your identity, installed buildings, unlocked cosmetics, and records survive. Production continues while stores have room. Rebuilding an army costs the same resources and training time for everyone; no paid recovery shortcut is offered. Borrowing troops or negotiating relief is available if another player agrees.

There is no personal offline shield. The fixed garrison resolves defense without new reasoning, just as a wall exists without a player watching it. It cannot bargain, invent a counterplan, or call allies on its own. A disconnected owner misses opportunities and may suffer avoidable losses. A game-wide outage is treated separately from player absence.

The defeat report must answer: **What did I lose? What decided this? What choices still exist?** It can expose the battle participants and resolved power to those participants, but not disclose every private conversation or hidden relationship that preceded it.

## 14. Accessibility and comprehension

Support keyboard navigation, visible focus, screen-reader names for resources and timers, zoom/reflow, and a text alternative to every building. Target WCAG 2.2 AA for the web interface; evaluate the actual product before claiming conformance. Use words and icons with color. Primary touch actions target at least 44 × 44 CSS pixels as a product choice. Shared-world deadlines remain real, but no essential action requires reacting within a few seconds.

Timestamp displays include the user's local time and an exact UTC value on expansion. Agent status, contract status, and attack deadlines remain readable with sound and motion disabled. Live region announcements are batched so forty small changes do not overwhelm assistive technology.

The initial public pilot uses one supported language end to end. Player messages retain their originals. If an agent translates, label the translation; a Seal authenticates the original words, not a machine's interpretation.

## 15. Scope and evidence

The first season design includes the complete base loop, standing exchanges and bonds, intelligence, reinforcement and raids, public identity/evidence, light Courts/allegiance, Chronicle sharing, Fortune, and cosmetic achievements. Loans, complex tax treaties, full clan administration, a trust-score ladder, paid agents, NPC economies, additional resources, and live combat are outside Season One.

The smaller prototype deliberately omits some first-season presentation and social depth; its exact slice and exit criteria are in [34](34-pact-agent-and-service.md). A specification is not permission to claim the whole game is ready to build without testing its central behavior.

The design borrows the emphasis on small meaningful action sets, varied strategies, and substantial progression from Supercell's published design values. That is a design precedent, not evidence for PACT's success. [Clash of Clans design values](https://supercell.com/en/games/clashofclans/blog/news/fpo-clash-of-clans-design-values/).

The accessibility target draws on the W3C's WCAG 2.2 reference; this document is not an accessibility audit. [W3C quick reference](https://www.w3.org/WAI/WCAG22/quickref/).

The essential test remains whether people enjoy owning the decisions that their agents carry out. If they cannot explain why a negotiation mattered to their kingdom, better art and more content will not solve the central problem.
