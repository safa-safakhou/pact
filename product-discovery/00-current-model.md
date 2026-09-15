# Current model — state of play

Updated 15 September 2026. **The current detailed draft starts at [32 — PACT full game design](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/32-pact-game-design.md).** It develops the consolidated baseline in document 30 and growth proposal in document 31. [33 — Rules and balance](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/33-pact-rules-and-balance.md) owns numeric rules; [34 — Agent and service operation](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/34-pact-agent-and-service.md) owns service behavior and the delivery/test plan.

This file is the short version: what controls the design, what was already rejected and why, and what is still open. Its purpose is to let a future conversation resume without re-reading the whole repository or re-arguing settled questions.

Product design only. No game, assets, integration, or playtest has been implemented. Upgrade capacity, food examples, and one worked battle received arithmetic checks; fun, balance, cost, and growth remain unvalidated.

---

## The game in three lines

Build a kingdom yourself. Send your AI out to deal with everyone else's — buying and selling information, securing food, negotiating protection, signing contracts, making and breaking alliances.

There is no map. Public records and introductions reveal identities; private information about defences, supplies, and plans is worth negotiating over. Your army eats, so military growth creates dependence on suppliers. Nothing stops you betraying anyone; consequences do, or they don't.

## Latest request — full design

The founder accepted continuing from PACT and asked for full detail on how it feels, sounds, works, and operates. Documents 32–34 are the response: a roughly 16,000-word first-season design with specific initial values, not a claim of tested game balance.

- **Experience:** a warm illustrated kingdom and sharp political decisions; four primary screens; detailed visual, motion, and sound briefs.
- **Kingdom:** seven building types, six Hall levels, two builders, three resources, and four unit types. Starting grants cannot be exported.
- **Conflict:** raids resolve about twenty minutes after declaration, with a final five-minute lock. Overlapping defenses resolve against surviving eligible units. Losses affect troops and ordinary resources; buildings persist.
- **Social economy:** private intelligence, breakable standing supply, bonds, troop lending/recall/seizure, light Courts and public allegiance. Loans are deferred.
- **Season One — The Lean Crown:** six weeks, with published Grain production multipliers of 100%, 100%, 90%, 80%, 80%, and 100% by week.
- **Competition:** Fortune is change in marked wealth, with explicit transfer/alt limitations and development-band comparisons. No computed Word ladder in Season One.
- **Operation:** deterministic authoritative rules, bounded agent authority, receipts and idempotency, offline obligations, outage policy, moderation, and a staged validation plan.
- **Money:** cosmetics only; no purchasable builders, time reductions, or action allowances.

These are concrete designer choices for draft 1.0. The user has not individually approved each value. Preserve the founder constraints below; tune the new rules through evidence rather than treating every draft number as immutable.

## Previous request and proposal — growth

The founder asked us to understand the new investigation, especially document 30, and design for easy sharing and strong user growth. The response is [31-pact-growth-design.md](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/31-pact-growth-design.md). This is a proposed extension, not an accepted replacement of the baseline.

- **First-pact invitations:** enter through an actual player opportunity, with the invitation preserved through account creation and assistant connection.
- **Useful newcomers:** a small earned production surplus lets a friend negotiate a first trade; tutorial grants cannot be exported. This changes the early economy and needs alt-account testing.
- **Chronicle cards:** a short situation, selected evidence, recorded outcome, and invitation. Public viewing requires no account; private intelligence is not automatically disclosed.
- **Courts:** shared social pages for groups, without enforced allegiance or combat benefits.
- **Validation:** 50 seed players over three weeks, measuring unaided connection, meaningful first outcomes, voluntary sharing, and referred players who return after a week.

The proposal recommends cosmetics-only monetization because builders and time reductions buy the baseline's main progression advantage. It also challenges claims that caps defeat scripts, that trust flow solves alts, and that public identities remain scarce. Those claims are unvalidated; they must not be reported as findings. The computed Word ladder remains an experimental proposal, especially given the conflict with withholding computed trust scores from agents.

---

## Constraints that control

Founder decisions. These override any proposal that conflicts with them.

- **No AI-powered NPCs.** Too expensive to scale. Every conversation is player-agent to player-agent. That is the core value.
- **Bring your own LLM.** Players connect the ChatGPT or Claude they already have. Only launch mode.
- **No hardcoded loyalty.** Nothing prevents attacking an ally. Tradeoffs and consequences are the design's central concern.
- **Being offline should cost you.** Presence is an advantage. Always-on fairness protections were rejected.
- **A proven skeleton.** Travian / Clash of Clans. Base building, unit types, distinct resources, simple dice combat. Simpler is better.
- **No map.** No coordinates, no travel, no scrolling for targets.
- **Free to play**, gems and cosmetics, competitive ladders.
- **Plain language.** Several rounds were rejected partly for being hard to follow.

---

## Decision log — what was rejected and why

Do not re-propose these without new reasoning.

| Direction | Why it was rejected |
| --- | --- |
| **AFTER THE CROWN** (settlements, Alloy/Charge, four action families, five NPC settlements) | Not competitive. The human mostly reads. Nothing watchable or shareable. The LLM sat adjacent to a genre that works without it. |
| **TITAN** (personal combat machine) | Too narrow a role for the agent; no social or economic agency. |
| **The 2,000-node discovery race** | Known solutions turn the core into bulk submissions; weak personal ownership. |
| **HANDSHAKE** (corporate con game, AI guards a vault) | Setting rejected outright — commerce, firms and invoices are not a fantasy anyone wants to inhabit. Also depended on AI-powered NPC defenders. |
| **AI monsters with personalities you recruit and other players poach** | Depended on AI-powered NPCs. Ruled out on cost. |
| **PACT v1 — coalition raids on sunken vaults** | Too complicated for a mass-market game, and the human had nothing to own — no base, no visible achievement. |
| **The three-panel dive with asymmetric information** | Same. Good co-op mechanic, wrong for this audience. |
| **Always-on defence for fairness** | Founder wants absence to cost you. |
| **Escrow on transfers** | Removes the trust tension that makes the game work. |
| **Hardcoded alliances that prevent attacking** | Unrealistic. Consequences should do that work, not rules. |

**What survived every round** and should be assumed still current: agent-to-agent conversation as the core, public record versus private conversation, selectively-cut signed evidence, public declarations, gossip, no purchasable advantage.

---

## Amendments layered onto the design

Each has its own document and was folded into the historical consolidated baseline [30-pact-design.md](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/30-pact-design.md). The detailed package now resolves conflicts among them.

- [Hardening pass](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/23-pact-hardening.md) — twelve exploits with fixes and confidence levels. Trust as a flow, structured offers, short negotiation windows, player limits set outside the prompt, the default agent briefing.
- [v2 base game](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/25-pact-v2.md) — the Travian/Clash pivot, the three mechanics that force conversation, open-API bot resistance, multi-accounting defences.
- [Empires and contracts](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/26-pact-empires-and-contracts.md) — no map, allegiance instead of geography, tribute, standing contracts, bonds, debt.

---

## Early system commitments in the baseline

Document 30 prioritizes these before public API adoption. Stable rules matter, but the latest review does not treat them as proven defences or literally impossible to revise.

1. **Caps on the action economy.** Daily ceilings on offers, attacks, scouts and open negotiations. This is simultaneously the bot defence and what keeps players inside their own AI subscription.
2. **No computed judgements in the API.** Raw records and raw messages only — never trust scores, recommendations, or threat levels.
3. **Trust as a flow, not a count.** This is the baseline proposal, not a solved anti-alt mechanism. The growth proposal defers a public computed Word ladder until its assumptions and API conflict are resolved.

---

## Open questions

**Decisive:**

1. What does a day cost in a player's own AI quota? Cheapest to answer, most likely to end the design.
2. Does anybody actually trade intelligence? The load-bearing new mechanic. If not, this is Travian with a chat box.
3. Would a plain script outperform a language model? Build one deliberately and try to beat the humans.
4. Does tribute feel worth paying, or is vassalage just a tax?
5. Does the kingdom give people something they are proud of?

**Unresolved:**

- Do contracts make the world too stable? Expiry is the pressure valve; duration tuning is unproven.
- Do empires become permanent? The counters are real but untested.
- Does betrayal happen often enough? If consequences work too well, a game about broken promises has none.
- Smear campaigns against new players — partly answered by bonds and the default agent briefing, not fully.
- The agent quality gap between model tiers, until there is a standardized league.

---

## Next proposed test

Follow the sequence in document 34: connection experiment, rules prototype, playable social slice, then **one world with fifty seed players over three weeks and room for invitees**. The social slice includes first-pact entry, a notice board, a Court page, and one Chronicle template. The broader first-season rules are in document 33; the pilot may initially cap development at Hall IV and defer seizure, allegiance, and percentile rewards.

Before recruiting broadly, verify the actual assistant connection route, authorization behavior, and quota use. This remains a proposed experiment; implementation and participant recruitment have not begun.

No code, public service, external messages, or automatic background task has been launched.
