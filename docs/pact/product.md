# Product brief

**Version 1.3 · Owner of player experience, release scope, and monetization.**

## The game in two paragraphs

Build a small kingdom into a power people recognize. Farms feed your troops, mines support construction, and markets produce Silver. Your army can raid another kingdom, defend a supplier, or be lent to someone who may betray you. Buildings survive defeat; resources and troops are at risk. Six-week seasons celebrate the kingdoms that gain the most wealth, while your kingdom carries on afterward.

Your Envoy is the model you connect. Give it an objective such as “Secure food for tomorrow, spend no more than 30 Silver, and do not threaten Rowan.” It can negotiate across several conversations, compare offers, and carry out authorized actions. People decide their ambitions, limits, promises, and major risks. The pleasure is seeing a plan become a bargain, a rescue, a rivalry, or an expensive mistake—with your growing kingdom and public record attached to it.

## What exists in Version 1

- One persistent world, with public identities and private economic and military information.
- Seven buildings, six Hall levels, three resources, four troop types, two builders, and one training queue.
- Resource agreements, bonds, scouting, troop lending, seizure, raids, and freely chosen allegiance.
- One Envoy identity per kingdom, usable with multiple model providers and MCP clients.
- Courts for communities, evidence-backed Chronicle stories, invitations, achievements, and seasonal standings.
- Web/PWA, native iOS and Android applications, and a Telegram Mini App sharing the same kingdom and four-screen experience; a Telegram bot supplies briefings, explicit run controls, and alerts.
- Compatible assistant access through the shared tool interface. [Architecture](architecture.md) defines exact channel capabilities and reusable module boundaries.

There is no troop movement, geographic map, AI-powered NPC population, mandatory alliance, automated moral score, or purchased gameplay advantage. Politics comes from the players. The shared seasonal pressure comes from harvest changes.

## First session

1. **Arrive.** A shared story or invitation opens without a login. See the author, the recorded outcome, and the destination being offered. A direct visitor sees the game summary and a sample kingdom clearly labeled as a preview.
2. **Create an account.** Enter email/password, verify email, confirm age 18+, and choose a kingdom name and public handle. The kingdom is still a safe draft: no production, attacks, or score yet.
3. **Connect an Envoy.** Choose a model connection in PACT or connect an external chatbot. A connection check reads the draft and submits a harmless sandbox action. Costs and supported host requirements appear before connection.
4. **Enter the world.** Press **Found kingdom**. This creates the starting resources and buildings exactly once and starts all game clocks. Returning invitations open at their preserved destination.
5. **Own a decision.** Start Farm II using the construction allowance. Give the Envoy a first objective. For an invitation with a willing counterparty, negotiate a modest resource exchange. Without one, inspect current player notices; the tutorial does not fabricate another player or a successful trade.
6. **See a consequence.** A first delivery, accepted counteroffer, declined demand, or completed upgrade becomes a concise result card. The next action is visible. Opening a transcript is optional.

Users may leave a draft and reconnect later. Existing players can use all manual game controls without a working model connection. An inactive external chatbot cannot receive a magical reply from another inactive chatbot; pending conversations remain visibly pending.

## The four screens

| Screen | Main view | Primary decisions |
| --- | --- | --- |
| Kingdom | Illustrated settlement, three resource balances, production/upkeep, builder slots, at most three urgent cards | Build, train, manage troops, inspect an attack |
| Envoy | Objective, connection state, run allowance, approval inbox, active offers | Start/stop a run, change standing authority, approve an exact action |
| People | Contacts, exact-handle search, notices, Courts, public profiles | Meet, negotiate, join a community, inspect evidence |
| Chronicle | Personal event history and deliberately published stories | Understand results, select evidence, preview a share link |

An offer shows **you send / you receive / duration / notice / bonds**, followed by the two identities and exact version. Recorded facts and agent interpretations have different labels. A status reads **Working until 18:45**, **Waiting for Rowan**, **Approval needed**, or **Stopped**; it never implies continuous thinking merely because an account is connected.

The Hall contains achievements, cosmetics, and standings. Resource forecasts list their assumptions, including continuing deliveries. Public portraits are decorative, independent of hidden building or army state.

## Feel and presentation

Use a compact illustrated kingdom: timber becoming pale stone, cloth banners, copper fittings, a working mill, and a warm Hall. Development changes recognizable silhouettes at Hall II, IV, and VI. No 3D camera or pathfinding is required. Body text uses a readable sans-serif, values use tabular numerals, and decorative lettering stays out of contracts.

The palette is parchment `#F4EBDD`, ink `#202A30`, deep teal `#174A4B`, brass `#AD7834`, and clay red `#A83F38`. Brass is decoration; red always accompanies words and an icon. Check contrast in actual components. Essential controls work by keyboard, screen reader, and touch; the release accessibility target is WCAG 2.2 AA, with 44 CSS-pixel touch targets as an additional product requirement.

Sound is optional: quiet wind and forge ambience; a paper fold for grouped messages; a seal press for a signature; one chime for a first delivery; two low drums for a raid; a short snapped-cord sound for default. Routine delivery ticks stay silent. Music, effects, ambience, and notifications have independent controls. Reduced motion replaces 150–250 ms transitions and short achievement reveals with immediate state changes. No important information depends on sound, color, or animation.

## Season One: The Lean Crown

Each season contains six weeks of **game time**. Weeks 1–6 use Farm multipliers of **100%, 100%, 90%, 80%, 80%, 100%**. The entire schedule is visible from opening day. Contracts retain their signed amounts during poor harvest. Iron and Silver production do not change. The launch timestamp is deployment configuration; the schedule is generated from it, never hand-entered separately in clients.

The Fortune leaderboard measures change in marked kingdom wealth, including the results of trade, support, and raiding. It is a political economy competition. Hall bands and newcomer comparisons give smaller kingdoms useful rivals. Buildings, troops, stocks, contacts, and contracts persist after the season; a new season starts a new scoring baseline. Exact scoring and rewards belong to the [rulebook](rules.md).

## Progression and money

Hall level is the player's development level. Upgrades and armies cost only resources earned or obtained inside the game. Achievements award permanent display pieces. Seasonal honors cannot be bought.

**Gems are a cosmetic wallet.** Each of the eight first-season achievements grants 25 earned Gems once, alongside its exclusive achievement item. Purchased and earned Gems buy the same general cosmetic catalog. The initial catalog has banner patterns at 100 Gems, portrait frames at 150, and kingdom scene palettes at 300. Achievement and rank ornaments are excluded from the shop. Cosmetic unlocks are permanent and account-bound; Gems cannot be transferred, sold, redeemed for cash, staked, or exchanged for game resources.

Paid Gem packs contain 500 or 1,200 Gems, with localized prices supplied by the checkout catalog and shown before payment. There are no loot boxes, expiring paid balances, exclusive timed offers, or automatic purchases by the Envoy. A payment receipt credits the cosmetic wallet once; refunds reverse the associated paid entitlement, never gameplay stock or Fortune. Only the human opens checkout. Exact local prices and merchant identity are deployment data, not game balance. Web, native app stores, and Telegram use their respective payment adapters. Earned Gems are shared; paid Gem lots are initially spendable on their origin channel, with separate visible balances. Cosmetic ownership is account-wide. The definitive channel and refund-provenance policy is in [architecture](architecture.md).

No purchase grants resources, units, builders, time reductions, reserve protection, extra actions, more simultaneous Envoys, priority execution, or unattended reasoning. PACT does not sell model credits in Version 1. Players pay their selected model provider under that provider's terms; their provider subscription or API bill is separate from PACT. Better models may perform differently, but paying PACT cannot improve game allowances.

## Sharing

A Chronicle card combines a short situation, selected evidence, and a recorded consequence. Publishing and copying the link are deliberate human actions. Recipients can view it before signup and retain the intended invitation through setup. A new player brings another negotiator and another kingdom, not a referral resource bonus. Courts can grow without granting their owner control over members.

All implemented surfaces show the same state, receipts, authority, and achievements. Web, Telegram, and assistant routes are functional during the social slice. Native iOS/Android interfaces and their paid signing/device work begin only after that MVP has been played and validated, and are certified for release in Season One. A player can begin a conversation in an assistant and approve its exact proposal in another authenticated PACT client.

The product is designed to earn repeat play through ownership, competition, and relationships. Success is evaluated by the behavioral checks in [delivery](delivery.md), not asserted from the specification.

## Hall of Stories correction — 10 October 2026

[Collection specification](collections.md) version 1.0 owns the founder-authorized catalog, eight additional cosmetic-only achievements, exact outcome evidence, private keepsakes, equipment and sharing. The original eight triggers and once-only 25-Gem entitlements remain unchanged. No new power, communication/approval/inference-count incentive, payments, model presence or random-finish activation. PACT-160–165 acceptance is tracked separately; this correction does not certify implementation or change historical release evidence.
