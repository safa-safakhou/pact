# PACT — consolidated design

**Consolidated baseline, 14 September 2026.** It folds together [v2](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/25-pact-v2.md), [the hardening pass](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/23-pact-hardening.md), and [the empires and contracts amendment](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/26-pact-empires-and-contracts.md). The founder subsequently requested a detailed design: start with [32 — Full game design](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/32-pact-game-design.md). Documents 32–34 develop this baseline and explicitly revise its conflicting or unvalidated assumptions; document 33 owns the current proposed numeric rules. The body below preserves the earlier baseline.

Nothing here has been built, playtested, costed, or validated. It is a design.

For why earlier directions were rejected, see the decision log in [00-current-model.md](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/00-current-model.md).

---

## 1. The game

**Build a kingdom. Send your AI out to deal with everyone else's.**

You play the building part yourself: walls, barracks, farms, an army you're proud of. That part is familiar and it's yours.

Everything outside your walls is handled by your AI — the one you already pay for, connected to the game. It buys and sells information, secures your food supply, negotiates protection, arranges loans and reinforcements, makes and breaks alliances, and spreads and collects gossip about who can be trusted.

It holds a dozen conversations at once, which no human can do by hand. That is the thing this game has that no other game has.

**And you can't see inside anyone else's walls.** You don't know who's rich, who's defenceless, or whose army is out right now with nothing left at home. Somebody knows. They'll sell it to you. It might not be true.

---

## 2. Constraints that control the design

These came from the founder and override anything else.

- **No AI-powered NPCs.** Scaling AI characters is too expensive. Every conversation is one player's agent talking to another player's agent. That is the core value.
- **Bring your own LLM.** Players connect the ChatGPT or Claude they already have. This is the only launch mode.
- **No hardcoded loyalty.** Nothing prevents attacking an ally. Consequences do, or they don't. Tradeoffs are the design's central concern.
- **Being offline should cost you.** Presence is an advantage. Always-on fairness protections were rejected.
- **A proven skeleton.** Travian / Clash of Clans: base building, unit types, distinct resources, simple dice combat. Simpler is better.
- **No map.** No coordinates, no travel, no scrolling for targets.
- **Free to play**, monetized through gems, progression and cosmetics.
- **Competitive play matters.** Ladders and head-to-head stakes are requirements.
- **Plain language.** Earlier rounds were rejected partly for being hard to follow.

---

## 3. The split

| Inside your walls — **you** | Outside your walls — **your agent** |
| --- | --- |
| Build and upgrade | Buy and sell intelligence |
| Choose your army | Secure grain supply |
| Watch the place grow | Negotiate protection and tribute |
| Collect achievements | Arrange loans and reinforcements |
| Set your agent's limits and goals | Make, keep and break contracts |
| | Spread and collect gossip |

Slow, visual and satisfying on one side. Fast, social and ruthless on the other. Each side does what it's actually good at.

---

## 4. The world

**There is no map.** No coordinates, no travel time, no browsing for weak targets. Your kingdom exists; so does everyone else's.

This strengthens the core mechanic rather than weakening it. In Clash of Clans you find targets by scrolling until you see a weak one. Here there is nothing to scroll, so there are only four ways to find anyone:

- Somebody tells you
- You buy the information
- You already know them
- The public Record shows they did something loud

**Without a map, information is the only way to find a target.** A player with no contacts literally cannot find anyone to attack. The intelligence market gates all aggression.

### Allegiance replaces geography

The setting is the age of empires. Kingdoms, banners, courts, wax seals, tribute.

**Where you are is who you serve.** You are independent, or sworn to an empire. That is public and it's the first thing anyone learns about you.

**Why vassals pay tribute.** A share of production flows upward automatically. In return the overlord provides:

- **Protection** — hitting a vassal means answering to their overlord. That is a threat, not a rule, and it's worth exactly as much as the overlord's willingness to act on it.
- **Shared intelligence** — the empire pools what its members know. Since information is how you find anyone, this is enormous. An independent kingdom is comparatively blind.
- **Supply security** — the empire guarantees its members' grain.

**Why anyone becomes an overlord.** Tribute income, and a lot of it.

**What keeps it honest.** An empire is only as strong as its reputation for actually defending people. Fail to answer when a vassal is attacked and word gets around, vassals leave, tribute dries up, and rivals start picking off your weakest members specifically to prove you can't protect them.

That is self-regulating, needs no rules, and produces the best drama in the game: a vassal negotiating with a rival empire while still paying you; several vassals agreeing to stop paying on the same day; an overlord deciding one vassal isn't worth defending while everyone watches.

---

## 5. Resources

| | What it's for |
| --- | --- |
| **Iron** | Units and defences |
| **Silver** | Trade, bribes, hiring, and the cost of contacting strangers |
| **Grain** | Feeds your army, every hour, forever |

**Growth is gated by build time and build slots, not by resources.** Two builders, and the Great Hall takes three days regardless of how much iron you have. Resources stop you being blocked; they cannot make you faster. Storage is capped and overflow is lost.

This matters for more than pacing — it is the main defence against multi-accounting (section 11).

---

## 6. The three mechanics that make conversation necessary

**Non-negotiable.** Without them this is a base builder with a chat layer — which is the AFTER THE CROWN design that was already rejected. If any one gets cut for simplicity, the product stops being new.

### You cannot see inside a base

Scouting is expensive, slow and imperfect. You learn what's behind someone's walls by attacking them, or by buying it from someone who has.

Intelligence is a real commodity: valuable, perishable, and frequently a lie.

> *"I hit Kael last week. I know where his defences sit and what he's holding. What's it worth to you?"*

This is the single biggest new layer in the game and it costs almost nothing to build.

### Your army eats

A serious army needs more grain than its own land produces. So **every real military power depends on suppliers, and suppliers can cut them off.**

You can starve an enemy by outbidding them for their grain. That's a war fought entirely through conversation, using a mechanic any strategy player understands on sight.

### You cannot survive a big attack alone

Reinforcements. Send units to defend someone else.

**Being liked is how you stay alive.** Asking for help is a negotiation every time, and it's betrayable in the most natural way imaginable — your troops are standing in someone else's kingdom when they decide to keep them.

---

## 7. Contracts

A contract is a standing agreement the world executes automatically.

> *100 iron per hour, for three days.*
>
> *10 grain per hour from me, 5 silver per hour from you, ongoing, seven days' notice.*
>
> *500 spearmen lent for two days, returned at the end.*
>
> *2,000 iron now, 2,400 repaid over twenty hours.*

Once both sides sign, it runs. Nobody needs to be online.

**Why this matters.** An hour of your agent's negotiating now produces a week of income instead of one transaction. The political game builds toward something instead of resetting daily.

**The contract web is the world's structure, in place of coordinates.** Who supplies whom, who owes whom, who is quietly dependent on a rival. Partly public, partly secret, and worth paying to learn.

### Breaking a contract

**Always possible, instantly. Nothing stops you.**

| | What happens |
| --- | --- |
| **Expiry** | It ends. Clean. |
| **Notice** | You give the agreed warning and walk. Slightly awkward, no lasting harm. |
| **Default** | You cut it off with no warning. **Permanent public record.** |

**Cutting someone off at the exact moment they need it is the most devastating move in the game.** Your grain supplier defaults the hour your army marches. Your creditor calls in a loan while you're under siege. Nothing prevents it. Everyone will know. Sometimes it's still worth it.

### Bonds

When signing, either side can post a **bond**: resources held by the world, forfeited to the other party on default.

**This lets you buy credibility you haven't earned yet** — which solves the cold-start problem. A new player has no reputation and nobody will deal with them, but they can post a bond: *"I can't prove I'm good for it, so here's my money, take it if I'm not."*

That's how trust was actually built between strangers before institutions existed, it's period-correct, and it gets a newcomer into the political economy on day one.

It has its own edge: demanding a bond from an established player publicly says you don't trust them.

### Debt

Lending with interest does something nothing else does: **it creates a relationship that outlives the deal.** A creditor has an ongoing interest in the debtor staying solvent, which means creditors defend debtors they may not even like.

It also gives weak players a route to growth that isn't just waiting, and makes default a public event with several angry parties.

### Five fields, not fifteen

What flows each way, how often, how long, how much notice, and whether there's a bond. **It must fit on a phone screen.** The pull toward a contract-editing spreadsheet will be constant and must be resisted.

---

## 8. Combat

Simple, automatic, readable. No live mode, no replay system, no micromanagement.

Attacker's numbers against defender's numbers and walls, unit counters applied, dice for the rest. A battle report you can read in fifteen seconds.

**Attacking is expensive** — real grain, real units you can't cheaply replace. This is deliberate: **when war is costly, buying someone off is often cheaper than fighting them**, which is what makes the diplomatic layer breathe. If attacking were free, everyone would raid constantly and talking would become optional.

The dice also do quiet work against bots, which are excellent at deterministic optimisation and mediocre under uncertainty.

---

## 9. Reputation, evidence, and lying

### The Record

Public and undeniable, free, no AI involved: who attacked whom, who is sworn to whom, every public declaration, every contract default.

Conversations are private and deniable: what was said, what was promised, what the terms were.

**The Record proves a contract was defaulted. It cannot prove what someone promised you in private.** That gap is where the entire social game lives.

### Seals

An engine-signed excerpt of a real conversation — a wax seal on a document.

**You cannot forge a quote, but you choose where to cut.** Publish the nine words where they agreed, and leave off the fifteen that followed. Every word real, completely dishonest.

The counter is that they publish the longer excerpt. The cost is that everyone now knows you publish private conversations, and your terms get worse. **A consequence, not a rule.**

### Articles

Public pacts, shown permanently on both profiles.

**Their strength and weakness are the same fact: everyone knows.** They bind because breaking them is undeniable. They also paint a target, remove flexibility, attach your name to your partner's conduct, and invite everyone else to gang up on whoever looks strongest.

A public pact signed in bad faith is the most powerful weapon in the game. Everyone knows that, which makes every signature slightly terrifying — and that's correct.

Two variants: the **unilateral claim** (announce a pact the other party never agreed to, forcing them to deny it publicly or be assumed), and the public accusation, where a false one unsupported by a Seal lands permanently on the accuser's own record.

### Gossip

Your agent collects and spreads reputation across every conversation it holds. Its notes on other players are an asset, and tradeable.

Smearing is free, so an information war runs underneath the military one. The Record is what stops it becoming noise: a lie contradicting public facts gets caught, and being caught costs more than the lie gained.

### Trust is a flow, not a count

Standing isn't "how many contracts you honoured." It's **how much trust reaches you from players who are themselves trusted** — PageRank-style.

This is the defence against alt accounts vouching for each other: a closed cluster generates internal trust worth zero. It must be built from day one; retrofitting a trust metric invalidates everyone's earned score.

**It runs on a rolling window**, so a reputation can be rebuilt through sustained honest play while the permanent Record still shows everything. Without that, one betrayal means quitting, and the game bleeds exactly the players who engaged most with its best mechanic.

---

## 10. Progression and competition

You own and grow: your kingdom, your banner and seal, your army, and your standing.

**Two ladders.** **Fortune** — who took the most. **Word** — who is most trusted. Word is the unusual one and probably the better one: it measures nothing but trustworthiness, is entirely earned, and converts directly into power, because the top of that list is who everyone wants to deal with.

A third public board lists the season's biggest betrayals. Some players are absolutely playing for that one.

**Seasons run six weeks.** Ladders reset. Kingdom, banner, and every public declaration ever made are permanent.

---

## 11. Bot resistance and the open API

**The API cannot be closed.** A connector is an HTTP endpoint. If ChatGPT can play, a script can play, and the server cannot tell the difference. "Prove you're an LLM" checks are beaten by calling an LLM once and caching.

So the goal is not blocking scripts. It is making sure **a script cannot win.**

**Cap the action economy.** Everything scripts beat language models at — speed, cost, never sleeping, volume — is about *doing more*. Daily ceilings on offers, attacks, scouts and open negotiations make tirelessness worthless. **This same cap is what keeps players inside their own AI subscription.** One decision, two problems.

**Never expose computed judgements through the API.**

| Never expose | Always expose |
| --- | --- |
| A computed trust score | The raw record of what happened |
| "Recommended partners" | The messages people actually sent |
| "Threat level: high" | Who attacked whom, and when |

Exposing a number that summarises a judgement does the hard part for the bot. Agents must read and interpret — which is where a language model is strictly better and a script cannot follow.

**Cold contact costs Silver.** Messaging a stranger costs; messaging an existing partner is free. Spam loops die, relationships become valuable, new players stop being flooded. The economics of postage.

**Rate-limit reading, not just writing.** A bot that pulls the whole world's state every minute optimises globally and wins.

**Players are the best anti-cheat.** A predictable agent is a farmable agent. If a bot always accepts below a threshold, humans find it within a week and drain it. Rigidity is punished automatically, with no detection needed.

**Then lean into it:** *build whatever agent you want — it still won't beat someone who can tell when they're being lied to.* That gathers the right people, and it's true only if the caps and the no-computed-intelligence rule are in from day one. **Both are near-impossible to retrofit** once players have built agents against the API.

---

## 12. Multi-accounting

Test every mechanic against: **"if I had 100 accounts, would this be better?"** If yes, it's broken.

1. **Growth is gated by build time, not resources.** Dumped resources hit a hard ceiling.
2. **Storage caps, overflow lost.** Kills stockpile-then-dump.
3. **Trade balance tax.** Steepens on one-way flows, which is what a farm account is by definition. Real traders go both ways and barely notice. **Unpaid debt must count as the transfer it actually is.**
4. **No surplus at small sizes.** A kingdom consumes most of what it produces until developed. New-player boosts pay out over weeks, or they become the farmed thing.
5. **Trust cannot be farmed.** Alt clusters are closed loops worth zero.

**Information and protection are structurally unfarmable** — an alt needs a real army to scout anything, and non-aggression transfers nothing. **Resource trade and troop transfer are the risky ones.**

If these layers fail in testing, cut resource trade and keep the intelligence market and the protection economy. The diplomatic layer survives, because the most interesting things the agent negotiates over were never resources.

---

## 13. Money

**Free to play.** Players bring their own AI, so marginal cost per player is a database and a ruleset.

**Gems buy breadth, never power:** builders, build-time reduction, decorations, banner and seal cosmetics, roster space.

**Gems never buy** resources that convert into military advantage, ladder position, intelligence, or anything touching a battle outcome. The moment advantage is purchasable in a competitive game, the competitive players leave — and they're the ones holding the world together.

**Later, if it works:** a first-party hosted agent, sold as the one that keeps working when you're away and the one that's legal in ranked play.

---

## 14. What a session looks like

**You open the game.** Your contracts ran while you were gone — grain came in, tribute went out, a loan repaid itself. Two contracts expired overnight and need renegotiating. Somebody defaulted on you.

**You read what your agent found.** Someone is selling word that a mid-sized kingdom two rungs above you has its army committed elsewhere. It's probably true. It's possibly bait.

**You give direction.** Buy the intel. Line up a reinforcement. Don't renew the grain contract with the player who defaulted last week, and tell people why.

**You build.** Upgrade the wall. Queue the barracks. Look at the place.

**You act on what came back.** The intel checks out. You attack, it's expensive, you win. Or it doesn't check out, and now you know exactly who sold you a lie and what you're going to do about it.

Fifteen minutes, and something to think about until tomorrow.

---

## 15. Open questions

**The ones that decide whether this works:**

1. **What does a day cost in a player's own AI quota?** The entire free-to-play model rests on this. Cheapest question to answer and the most likely to end the design.
2. **Does anybody actually trade intelligence?** This is the load-bearing new mechanic. If players ignore it and just attack, this is Travian with a chat box.
3. **Would a plain script outperform a language model?** Build one deliberately and try to beat the humans with it.
4. **Does tribute feel worth paying?** If protection and shared intelligence aren't genuinely valuable, vassalage is just a tax and everyone goes independent.
5. **Does the kingdom give people something they're proud of?** The retention anchor, and the reason for this structure.

**Still unresolved:**

- Whether contracts make the world too stable. Expiry is the pressure valve; duration tuning is unproven.
- Whether empires become permanent. The counters — tribute making overlords a target, coordinated revolt, dogpiling the strongest — are real but untested.
- Whether betrayal happens often enough. If consequences work too well, a game about broken promises has none.
- Smear campaigns against new players. Partly answered by bonds, empty records and the default agent briefing; not fully.
- The agent quality gap between model tiers. Never fully closed without a standardized league.

---

## 16. What to build first

**One server. Fifty players. Three weeks.**

Base building, three resources with grain upkeep, four unit types, dice combat, attack costs, paid scouting, contracts with bonds, agent connection for one assistant, the Record, and cold-contact pricing.

**Not** Seals, Articles, empires, ladders, or cosmetics. Those layer on once the base is proven.

Answer the five questions above, in order. Question 1 is cheapest. Question 2 decides whether this is a new game or a clone.
