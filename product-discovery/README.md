# Agent game product discovery

## Start here

**The current detailed draft is the three-document PACT package, 15 September 2026:**

1. **[32 — Full game design](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/32-pact-game-design.md):** player experience, setting, first session, screens, art, sound, social play, and Season One: The Lean Crown.
2. **[33 — Rules and balance](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/33-pact-rules-and-balance.md):** starting values, buildings, units, production, contracts, default/bonds, intelligence, reinforcement, raids, worked combat, scoring, and rewards.
3. **[34 — Agent and service operation](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/34-pact-agent-and-service.md):** agent behavior and authority, tools, disconnection, architecture, evidence, abuse handling, live operation, production sequence, and validation.

The founder requested this detailed design after the growth proposal. It makes concrete designer choices; numeric balance, fun, integration feasibility, and growth remain unvalidated. Document 33 owns gameplay numbers and overrides earlier drafts on those details.

**[30 — Consolidated PACT baseline](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/30-pact-design.md)** and **[31 — Growth design](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/31-pact-growth-design.md)** preserve the foundation and growth rationale. Their ideas are developed and, where explicitly noted, revised in the detailed package.

**[Current model](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/00-current-model.md)** is the short state of play: founder constraints, rejected directions, the latest proposal, and open questions. Start here if you are resuming after a break.

## The game

Build a kingdom yourself. Send your connected AI out to deal with everyone else's: buying and selling information, securing food supply, negotiating protection and tribute, signing contracts, making and breaking alliances. The intended launch uses a player's own supported assistant; actual connection support has not yet been validated.

There is no map. Public records and introductions reveal identities; private information about defences, supplies, and plans is worth negotiating over. Your army eats, so military growth creates dependence on suppliers. Reinforcements make relationships valuable. Nothing in the rules prevents betraying anyone — only consequences do.

Design only. No game or assets implemented, no playtests, and no measured cost or growth. The worked battle, upgrade affordability against storage, and food examples have received arithmetic checks; this does not validate game balance.

## Working papers folded into the design

- [Hardening pass](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/23-pact-hardening.md) — twelve exploits, each with a fix and a confidence level
- [v2 base game](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/25-pact-v2.md) — the Travian/Clash pivot, bot resistance, multi-accounting
- [Empires and contracts](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/26-pact-empires-and-contracts.md) — no map, allegiance, tribute, standing contracts, bonds, debt

## Previous design rounds

**Historical, 14 September: [HANDSHAKE](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/21-handshake.md).** Agent-vs-agent persuasion with an authored defensive Charter as the lock. The core mechanic survived into PACT; the setting did not. Rejected for its corporate/financial fiction — running a firm and reconciling settlements is not a fantasy anyone wants to inhabit — and for relying on AI-powered NPC defenders the company would have to pay for.

**Historical, 12–14 September: [AFTER THE CROWN](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/20-after-the-crown.md).** Settlements, two resources, four action families, abstract raids, five world characters, and a first seasonal pressure. Rejected by the founder: the human mostly reads, the experience is not watchable or shareable, and the LLM sits adjacent to a genre that works without it.

**Historical, 11 September: [TITAN](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/19-titan-overall-picture.md).** An evolving personal combat machine. The founder then redirected the design toward settlements and many concurrent relationships, followed by explicitly removing troop movement and micromanagement.

**Historical, 10 September: [Season 1 — The Discovery Race](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/17-season-one-discovery-race.md).** This round proposed a race through 2,000 connected missions, shared team progress, divided chests, individual solver credit, ranked finish prizes, equipment, and a common enemy. It followed the [previous MVP design](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/16-season-one-mvp-design.md). Neither the game nor the full mission set was built.

Section 8a incorporates the founder's subsequently shared conversation: prepared orders can execute without a connected LLM, fresh reasoning waits for an available agent, and the common world keeps its deadlines. It also distinguishes useful agent coordination from simply generating long conversations.

**Broader vision, 9 September: SIGNALFALL.** [Shared survival, personal ambition](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/15-signalfall-shared-fate.md) develops one global survival/extinction outcome, voluntary alliances, individual competition and rewards, eighteen mission families, influential human prompting, and connected chat sessions with live world metrics. It records the preceding design round.

The foundation is [A world played through intelligence](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/14-intelligence-world-reset.md): LLM reasoning, coding, knowledge, and communication constitute the core challenges, and solutions become usable capabilities. The preceding conventional operations interpretation was rejected.

Three complete game proposals have been developed so the founder can compare the actual player experiences before choosing: **Fieldwise** (teach and adventure with a companion), **Relay** (cooperate with a capable independent partner), and **House Rules** (build and share challenges for adaptive agents).

The package includes broad research, eighteen concepts, an evaluation framework, three earlier proposed Version 1.0 specifications, walkthroughs, economics, launch plans, and pitches. PACT is the current direction; the detailed draft develops it for Season One. Fun and commercial viability have not been validated. No product has been implemented.

## Read in this order

For the latest discussion, read the detailed design package in documents 32–34 linked above. [HANDSHAKE](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/21-handshake.md), [AFTER THE CROWN](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/20-after-the-crown.md), [TITAN](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/19-titan-overall-picture.md), its [research report](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/18-agent-game-research-reset.md), [The Discovery Race](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/17-season-one-discovery-race.md), and the earlier SIGNALFALL documents provide history. [Common Front](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/13-shared-world-discovery.md) records the rejected operations interpretation. The earliest three remain available in this order:

1. [Three-game comparison](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/06-three-game-comparison.md) — one situation played three ways, normal sessions, scope, and tradeoffs.
2. [Fieldwise](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/10-fieldwise-product.md), [Relay](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/11-relay-product.md), and [House Rules](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/12-house-rules-product.md) — complete proposed releases and pitches.
3. [Research and opportunity map](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/01-research.md) — competitive landscape, successes, failures, and implications.
4. [Eighteen product concepts](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/02-concepts.md) — different human–agent relationships and gameplay structures.
5. [Evaluation and commercial constraints](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/03-evaluation.md) — scoring, elimination decisions, inference economics, and evidence needed next.
6. [Source register](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/05-sources.md) — sources, dates, supported claims, and limitations.
7. [Current product model](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/00-current-model.md) — decisions and unresolved issues to carry into the next round.

The [earlier shortlist brief](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/04-founder-decision.md) preserves initial reasoning; the full proposals and comparison supersede its open scope questions.

The [deliverable coverage](/Users/safa.safakhou/repos/mine/random_idea/product-discovery/07-deliverable-coverage.md) maps the brief's 46 requested elements to the proposals.

## Evidence conventions

**Observed:** a product feature, published price, public statement, or research result supported by a linked source. A publisher's claim remains a publisher's claim.

**Interpretation:** a proposed explanation of player value or a market implication. These are reasoned judgments, not measured causal findings.

**Design hypothesis:** an original proposed mechanic or experience. Walkthroughs are fictional examples of intended play, not observations from a working game.

**Planning assumption:** a price, cost, staffing level, session length, or threshold used to compare alternatives. These are not forecasts or commitments.

The initial research snapshot is 8 September 2026, with shared-world research added on 9 September. Store metrics are volatile and may differ by language, purchase filter, and region. No revenue or retention is inferred from review counts. No customer interviews, hands-on playtests, or private competitor financial data underpin this round.
