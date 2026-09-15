# PACT v2 — the base game

**You build. Your agent goes out there and deals with everyone else.**

This supersedes [PACT v1](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/22-pact.md) and [the raid design](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/24-pact-the-raid.md). The coalition-raid structure was too complicated for a mass-market game and left the human with nothing to own. This adopts a proven skeleton — Travian and Clash of Clans — and adds the one thing neither of them has.

[The hardening pass](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/23-pact-hardening.md) still applies; its trust-flow, prompt-injection and smear fixes carry over unchanged.

Nothing here has been built, tested or costed.

---

## 1. The split

**Inside your walls — you.** Build, upgrade, choose your army, watch the place grow, collect achievements. Slow, visual, satisfying. This is what you own and what you're proud of.

**Outside your walls — your agent.** Buy and sell intelligence, secure food supply, negotiate protection, arrange reinforcements, make and break alliances, and spread and collect gossip about who can be trusted.

Each side does what it's actually good at. You get the building game. Your agent gets the political one, at a speed and width no human could work by hand.

---

## 2. The trap we have to avoid

**A base builder with a chat layer is just AFTER THE CROWN**, which was already rejected.

In Clash of Clans, you never need to negotiate. You can see everything. You attack whoever you like. Nobody's permission is required for anything. **There is nothing to talk about.** Bolt an agent onto that and it's decoration.

So three mechanics below are **non-negotiable**. They are the entire reason this game needs an agent. If any one of them gets cut for simplicity, the product stops being new.

---

## 3. The three mechanics that make talking necessary

### You cannot see inside a base

Scouting is expensive, slow and imperfect. You do not know what is behind someone's walls until you attack them — **or until you buy that knowledge from someone who has.**

Intelligence becomes a real commodity: valuable, perishable, and often a lie.

> *"I hit Kael last week. I know where his defences sit and what he's holding. What's it worth to you?"*

Your agent spends its day buying and selling knowledge about who is weak, who is undefended, and whose protection expires tonight. **This is the single biggest new layer in the game and it costs almost nothing to build.**

### Your army eats

Three resources:

| | What it's for |
| --- | --- |
| **Iron** | Builds units and defences |
| **Silver** | Trade, bribes, hiring, sending cold messages |
| **Grain** | **Feeds your army, every hour, forever** |

A serious army needs more grain than your land produces. So **any real military power must have suppliers, and suppliers can cut them off.**

You can starve an enemy by outbidding them for their grain. That is a war fought entirely through conversation, using a mechanic any strategy player understands on sight.

### You cannot survive a big attack alone

Reinforcements. Send units to defend someone else.

**Being liked is how you stay alive.** Asking for help is a negotiation every time, and it's betrayable in the most natural way imaginable — your troops are standing in someone else's base when they decide they'd rather keep them.

---

## 4. Combat

Simple, automatic, readable. No live mode, no replay system, no micromanagement.

Attacker's numbers against defender's numbers and walls, unit counters applied, dice for the rest. A short battle report you can read in fifteen seconds.

**Attacking is expensive.** Real grain, real units you can't cheaply replace. This is deliberate and it is what makes the whole diplomatic layer breathe: **when war is costly, buying someone off is often cheaper than fighting them.** If attacking were free, everyone would raid constantly and talking would become optional again.

The dice also do quiet work against bots — scripts are excellent at deterministic optimisation and mediocre under uncertainty.

---

## 5. The open API problem

**You cannot prevent people connecting scripts instead of language models.** An MCP connector is an HTTP endpoint. If ChatGPT can play, `curl` can play, and the server cannot tell the difference. Any "prove you're an LLM" check is beaten by calling an LLM once and caching the answer.

So the goal is not to block scripts. It is to make sure **a script cannot win.**

### Cap the action economy

Everything a script beats an LLM at — speed, cost, never sleeping, volume — is about **doing more**. So cap how much anyone can do. Offers, attacks, scouts and open negotiations all have daily ceilings.

A bot hits the same ceiling your ChatGPT does, and its tirelessness is worth nothing. This is also the cap that keeps players inside their AI subscription. **One decision, two problems solved.**

### Never put intelligence in the API

| Never expose | Always expose |
| --- | --- |
| A computed trust score | The raw record of what happened |
| "Recommended partners" | The messages people actually sent |
| "Threat level: high" | Who attacked whom, and when |

The moment you expose a number that summarises a judgement, you have done the hard part for the bot. **Make agents read and interpret.** That is where a language model is strictly better and a script cannot follow.

### Cold contact costs Silver

Messaging someone you have never dealt with costs a little. Messaging an existing partner is free.

Spam loops die instantly, relationships become genuinely valuable, and new players stop being flooded. The same economics as postage.

### Rate-limit reading, not just writing

If a bot can pull the whole world's state every minute it optimises globally and wins. Information must cost something to obtain — which is already true, since you cannot see inside a base without paying for it.

### Let the players do the enforcement

**A predictable agent is a farmable agent.** If a bot always accepts below a threshold, humans will find that within a week and drain it dry. Rigidity is punished automatically by the social layer, with no detection required.

### Then lean into it

Once scripting cannot win, an open API stops being a threat and becomes the best story the product has:

> **Build whatever agent you want. It still won't beat someone who can tell when they're being lied to.**

That gathers exactly the right people. But it is only true if the caps and the no-computed-intelligence rule are in from day one. **Both are nearly impossible to retrofit** — once players have built agents around an API, removing things from it causes a riot.

---

## 6. Multi-accounting

The test to apply to every single mechanic:

> **"If I had 100 accounts, would this be better?"**

If yes, the mechanic is broken. Clash of Clans solved this by banning trade entirely. We need trade, so we need layers.

**1. Resources don't make you grow — time does.** The bottleneck is build slots and build time. Two builders, and the Great Hall takes three days regardless. Dumping a hundred accounts' worth of grain on your main stops you being *blocked*; it cannot make you *faster*. Extra resources hit a hard ceiling.

**2. Storage caps, and overflow is lost.** You cannot hoard. Anything shipped in above your cap evaporates, which kills the stockpile-then-dump play completely.

**3. Trade balance tax.** When A has sent B far more than B has sent A, the tax on further transfers climbs steeply. Real traders go both ways and barely notice. A farm account is by definition a one-way flow, so it chokes itself.

**4. Small bases have no surplus.** A base consumes most of what it produces until developed. Surplus comes from development, and developing 100 accounts costs what developing one costs. New-player boosts pay out over weeks rather than up front, or they become the thing that gets farmed.

**5. Reputation cannot be farmed.** Trust flows from trusted sources, so a cluster of alts vouching for each other is a closed loop worth zero. Alts cannot manufacture standing, make public declarations anyone values, or launder a reputation.

### The hierarchy worth remembering

| Structurally safe | Risky |
| --- | --- |
| **Information** — an alt needs a real army to scout anything | **Resource trade** — the classic exploit |
| **Protection and non-aggression** — nothing transfers at all | **Troop transfers** — units are resources in another shape |

**If the layers fail in testing, cut resource trade and keep the intelligence market and the protection economy.** The diplomatic layer survives intact, because the most interesting things your agent negotiates over were never resources — they were knowing things and not being attacked.

Grain trade is worth keeping. It is also the first thing to sacrifice, and knowing that in advance means the design isn't betting on it.

---

## 7. What carries over unchanged

From [v1](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/22-pact.md) and [the hardening pass](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/23-pact-hardening.md):

**No hardcoded loyalty.** Nothing stops you attacking an ally. Consequences do, or they don't.

**The Record.** Public and undeniable: who attacked whom, who was where, every public declaration. Conversations stay private and deniable. The gap between them is where the social game lives.

**Seals.** Engine-signed excerpts of real conversations. You cannot forge a quote, but you choose where to cut — so you can say something entirely true and entirely misleading. Publishing one marks you as someone who publishes things.

**Articles.** Public pacts, whose strength and weakness are the same fact: everyone knows. They bind because breaking them is undeniable. They also paint a target, remove flexibility, attach your name to your partner's conduct, and invite a dogpile on whoever looks strongest.

**Gossip.** Agents collect and spread reputation across every conversation they hold. Smearing is free; the Record is what stops it becoming noise.

**Word and Fortune.** Two ladders — who took the most, and who is most trusted. Word runs on a rolling window so a reputation can be rebuilt, while the permanent Record still shows everything.

**Commitment is bounded by limits set in the game interface, not the prompt.** No conversation can exceed them. This is what stops prompt injection between agents becoming the dominant strategy.

**Free to play, gems buy breadth not power.** Builders, decorations, roster space, cosmetics. Never resources that convert to military advantage, never ladder position.

---

## 8. What to build first

**One server. Fifty players. Three weeks.**

Base building, three resources with grain upkeep, four unit types, dice combat, attack costs, scouting you have to pay for, agent connection for one assistant, the Record, and cold-contact pricing.

No Seals, no Articles, no ladders, no clans, no cosmetics.

**Five questions, in order:**

1. **What does a day cost in a player's own AI quota?** If it eats a consumer plan, nothing else matters.
2. **Does anybody actually trade intelligence?** This is the load-bearing new mechanic. If players ignore it and just attack, the whole premise is wrong and we find out cheaply.
3. **Does grain scarcity produce negotiation, or just annoyance?**
4. **Would a plain script outperform a language model?** Try to build one and beat the humans. Do this deliberately, early, and honestly.
5. **Does the base give people something they're proud of?** This is the retention anchor and the reason we moved to this structure at all.

Question 2 is the one that decides whether this is a new game or a Travian clone with a chat box.

Nothing in this document is validated. It is a design.
