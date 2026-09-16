# PACT — a game people bring their friends into

> **Historical design — superseded.** Use [PACT Version 1](../docs/pact/README.md). Its product, access, runtime, rulebook, social, privacy, and delivery documents replace this document as implementation authority.

14 September 2026. **Proposed growth design, built on [30-pact-design.md](30-pact-design.md).** The founder asked for a design that is easy to share and gives user growth the strongest theoretical foundation. This is a recommendation, not a newly accepted founder decision. The original consolidated design remains intact.

Design only. No product, integration, experiment, or growth result has been produced.

**Developed further on 15 September:** the founder requested the full game design. [32 — Full game design](32-pact-game-design.md), [33 — Rules and balance](33-pact-rules-and-balance.md), and [34 — Agent and service operation](34-pact-agent-and-service.md) now specify the proposed first season. Their concrete values replace the illustrative tuning examples here.

## The short version

**Build your kingdom. Let your AI make the deals. Become someone the world needs—or someone it fears.**

You build farms, walls, and an army. Your agent bargains with other players' agents for food, intelligence, protection, and better opportunities. You decide what to build, whom to back, and how far your agent can go. A small kingdom can become a valuable supplier; a military power can discover that its army depends on someone it offended.

**The key addition: invite a friend into something that is happening.** “Build a kingdom with us; we need a grain supplier.” The friend sees your kingdom and the opportunity before connecting an AI. They start independently, negotiate their own terms, and can eventually become your partner, competitor, or replacement.

After a memorable deal or reversal, the game offers a short story card: the situation, what the agents said, and what actually happened. A viewer can understand it without knowing the game, then follow its invitation into the same world.

The proposed growth loop is **a useful relationship → a visible result → a story or invitation → another player with their own ambition**.

## 1. What the new work establishes

I reviewed the consolidated design, current-model notes, and the new sequence from HANDSHAKE through PACT, hardening, the raid, the base-building pivot, and empires/contracts. The earlier comparative research supplies background; its rejected recommendations do not control this proposal.

| What changed | What it means for this design |
| --- | --- |
| The human builds; the agent negotiates | Preserve a visible possession and recognizable human choices. Negotiation must change what the human can achieve. |
| The raid was replaced by a kingdom | Keep the familiar building loop. Do not introduce another mandatory minigame to explain the product. |
| Grain upkeep, hidden base information, and reinforcements create dependence | Invitations can offer actual economic and political roles. There is a reason to want another person involved. |
| Contracts execute without fresh inference | A completed negotiation has lasting value. Fresh dialogue still needs available player agents. |
| No map; relationships organize the world | A shared link can be an introduction into the world itself. The contract network remains partly secret. |
| The Record, Seals, and declarations distinguish facts from claims | The game already contains the ingredients for shareable stories with evidence and competing interpretations. |
| BYO LLM, no AI NPCs, real costs for absence | Entry depends on connection access and other players. Neither can be hidden behind an imaginary instant tutorial opponent. |
| Prior exploit analysis identified quotas, alts, scripts, and cartels | Treat the proposed defences as hypotheses. They are not evidence that these problems are solved. |

**The missing connection is between the social game and joining it.** Document 30 asks a newcomer to acquire contacts, resources, credibility, and an agent connection before reaching its distinctive experience. Growth depends on shortening that path while keeping the newcomer independent.

## 2. The first pact is the invitation

Any player can attach an invitation to a real, open opportunity. Examples:

- “I need grain for my next army. Start a kingdom and sell to me.”
- “Three of us are building independently. Come bargain with us tonight.”
- “We're trying to break the Red Banner's supply monopoly. Join the negotiations.”

These are player-authored intentions using existing contracts, messages, and declarations. They are not new classes, enforced alliances, or scripted missions. Invitations can also go to existing players.

An invitation previews **who invited you, what they want, what you could gain, and whether they are available now**. It makes no promise of guaranteed profit or protection. A newcomer does not automatically become a vassal, sign a contract, authorize a transfer, or expose their private kingdom state by opening it.

Accepted introductions open a contact channel without the ordinary cold-contact Silver charge. Both players still use their normal message, offer, and action allowances. The exemption requires the recipient to accept; broadcasting a link does not create thousands of free conversations.

The inviter gains a potential partner, not a referral payout. The newcomer gains a starting relationship, not a debt to the inviter. Refusing or renegotiating the invitation is valid play.

**Why this could spread:** the invitation has a purpose a friend can understand, and the inviter has a reason to help that friend learn. Whether that produces retained players is untested.

## 3. What a new player actually sees

An illustrative first session; numbers and timings are tuning assumptions, not a tested economy.

| Scene | What the player sees and does |
| --- | --- |
| **The message** | Safa sends: “I'm raising an army. Build a kingdom with me and name your price for grain.” |
| **The link** | A phone-friendly page shows Safa's chosen public kingdom view, a short explanation, and the invitation. No login is needed to inspect it. |
| **Ownership** | You choose a name and banner and preview your small kingdom. The first farm improvement is explained in one sentence. Previewing does not start upkeep or expose an account to attack. |
| **Connection** | To enter the live game, you create/sign into your PACT account and connect a supported assistant. The invitation survives this handoff. You see the requirements before starting. |
| **Your instruction** | You tell your agent: “Get me a good price for spare grain. Keep enough for my own army. Don't promise loyalty.” Resource limits are also enforced in the game interface. |
| **The negotiation** | Your agent contacts Safa's available agent. Their agents exchange offers and reasons. The human sees the current offer and the remaining disagreement, not a compulsory transcript. |
| **The result** | In this example, they agree on 2 grain per hour for 1 Silver per hour. After the first scheduled delivery, both sides can see that it happened. Your army's reserve stays within your chosen limit. |
| **Your next ambition** | Your kingdom shows what the income will help fund. You choose a farm upgrade for more bargaining power or a military upgrade for independence. |
| **The next relationship** | You can inspect another player's open notice, ask for an introduction, or invite a friend. There is no mandatory referral step. |

The first emotional result should be: **“My AI negotiated with yours, and I can see what I gained.”** It need not be a robbery or a betrayal. Cooperation must be enjoyable enough that breaking it later has weight.

The tutorial uses a clearly labeled worked example while connection is pending. It does not impersonate a live player. If the inviter's agent is unavailable, display “Waiting for Safa's agent” and offer another available, opted-in contact or a later meeting. An offline player can have standing contracts execute; they cannot conduct fresh bargaining without a running agent.

Aim to reach a first real offer within five minutes on the supported route. Measure total time including setup and waiting; do not count only the attractive part after connection.

## 4. A newcomer must become useful early

Document 30 makes small kingdoms consume almost everything they produce to discourage farming accounts. Taken too far, this leaves an invited friend with nothing to offer.

**Proposed amendment:** an early, earned farm upgrade creates a modest tradeable surplus. Tutorial grants remain usable for the player's own construction and cannot be exported or looted. Tradeable resources come from ordinary production. Everyone gets the same route, invited or not.

For the example above, a small kingdom could produce 6 grain per hour and reserve 4 for its own needs, leaving 2 to sell. An early military kingdom producing 10 while consuming 12 has a reason to buy it. These figures illustrate a relationship, not a balanced launch specification. A veteran's entire army will not depend on one new account.

More suppliers allow a military player to diversify. Fewer partners mean fewer negotiations and fewer dependencies to manage. More customers give a supplier alternatives; concentrating on one might earn better terms and protection. These tradeoffs create reasons for both large networks and small trusted groups without an automatic group-size bonus.

The new player keeps ownership of their production and can seek better terms. A friend should be a person whose judgment and loyalty become valuable, not a permanently subordinate resource generator.

This creates a real alt-account risk. Build time and storage caps limit some benefits; they do not eliminate many-account production, scouting, messaging, or collusion. Test receiving-capacity limits and the economics of extra accounts before unrestricted growth. Do not punish ordinary friendships merely because two people trade repeatedly. A bilateral transfer tax also needs testing against legitimate suppliers and tribute.

## 5. Make a story legible before asking someone to share it

The share unit is a compact **Chronicle card**, built from existing events. It is a product presentation of the Record and optional Seals, not an omniscient battle replay.

Example:

> **He threatened my kingdom. Now he buys its grain.**
>
> Kael's agent: “Pay 60 Silver, or we attack.”
>
> Your agent: “You need a supplier more than another enemy.”
>
> **Outcome:** a grain contract was signed; its first payment arrived.
>
> *Shared by Willow's ruler · View evidence · Join Willow's invitation*

The title is the player's interpretation. Quotes are optional, player-selected Seals. The outcome is generated from recorded events. A signed quote proves the words were sent, not that every claim in them is true. A card cannot claim the deal prevented a war unless that causal interpretation is labeled as such.

Every card needs three understandable elements: **what was at stake, the turning point, and the result**. Examples include an excellent deal, a rescued partner, a costly mistake, an exposed bluff, or a kingdom's visible growth. Do not make humiliating someone the only way to gain attention.

One tap prepares a share preview; the human chooses whether and where to publish it. Export a readable image plus a link that preserves the story and destination. No account is needed to view it. Publication never happens automatically through the player's contacts or social accounts.

**Information boundaries matter to the game.** Default cards contain public events and a player-chosen exterior appearance. Do not expose army counts, resource reserves, supplier lists, private contract terms, prompts, or complete conversations. Sharing a Seal is a deliberate disclosure with the existing in-game consequences. Other participants may publish a longer authentic excerpt in response; the game does not reveal private context automatically.

Use templates and recorded events for the first version. Avoid adding company-paid AI narration as a hidden cost of every share. Report/block controls and moderation of public user content belong with public sharing; agent mediation does not remove harassment.

## 6. Keep friends together without deciding their politics

A **Court** is a lightweight shared page for an invitation group: named kingdoms, chosen public goals, a meeting time, and published highlights. It is a social destination, not a new combat entity. It gives no pooled army, automatic intelligence access, binding loyalty, or protection flag. Existing empire mechanics can be added later.

Friends can join the same world immediately without coordinates or travel. Each owns a kingdom. Joining a Court is not signing Articles. Trade terms and allegiance remain separate decisions.

Solo arrivals use a small notice board of player-authored openings filtered by language and declared availability. Show the offer and its author, not a computed “best partner” or trust recommendation. Posting and contacting use the normal limits. The notice board is voluntary visibility, not a directory of undefended bases.

This matters for creators too: a community can meet around a recognizable banner and an actual shared ambition. A creator receives no special production, combat power, or ability to command followers' kingdoms. Independent groups can oppose them or sell to both sides.

As initial groups grow, give agents reasons to seek outside partners: members' production and military needs differ, relationships expire, and useful information changes. Do not defeat existing friendships with arbitrary bonuses for trading with strangers. If closed groups already satisfy every need optimally, revise the economy; extra chat volume will not rescue the premise.

## 7. Competition and returning

Keep the six-week season, permanent kingdom identity, visible construction, and the Fortune ambition from document 30. Present a few nearby rivals alongside the world leaders, using disclosed starting-development bands. These are comparison groups in the same world, not separate shards or attack immunity.

Because kingdoms persist, resetting a score alone does not create an equal start. Launch claims must acknowledge that. Newcomer recognition can reward development within a joining cohort, while established kingdoms pursue world standing. Final ranking and abuse-resistant scoring still need specification and testing; do not market an unbuilt ladder as fair.

Give achievements for recognizable accomplishments: completing a first standing trade, finishing a major building, or taking part in a successful defence. Display a player's actual role and the event. Friend counts, referrals, and raw repeated payments should not mint competitive power or reputation. A non-tradeable cosmetic can commemorate a first pact without making repeated invitations a farm.

On return, the player sees **what changed, what their previous choice accomplished, and one live opportunity**. A terminated supply contract is a real reason to act. Routine construction does not need an alarm. Presence still brings an advantage and absence still has costs; the proposal does not add an always-on defender or pause the world when the player leaves.

**Proposed monetization correction:** cosmetics only for the first release—kingdom appearances, banners, seal designs, and Chronicle frames. In a game where build slots and time gate power, selling builders and time reductions sells power. A company-hosted always-on premium agent would also sell a material presence advantage. Neither belongs inside a claim of equal competitive purchasing rules.

## 8. Assumptions that growth planning must correct

| Claim in the accumulated design | Working position for this proposal |
| --- | --- |
| No map makes identities scarce | The Record, invitations, public pages, and ladders reveal identities. Valuable intelligence must primarily concern hidden state, intentions, relationships, and timing. |
| A trust-flow score makes closed alt clusters worthless | That depends on the graph model, trust anchors, and adversaries. Do not launch a “trustworthiness” guarantee. A public Word score also becomes machine-readable even if omitted from an API. Keep it experimental. |
| Daily caps make tirelessness worthless; dice defeat scripts | Caps bound volume. Scripts can still exploit timing and uncertainty, and multiple accounts can add capacity. Compare against a competent scripted baseline. |
| A bond solves entry | A bond can help, but a newcomer needs collateral and someone willing to transact. An invitation supplies a contact; it does not guarantee trust. |
| BYO LLM makes the game effectively costless | It shifts inference to players. Hosting, moderation, support, operation, and player quota costs remain. Public distribution and reliable permissions are dependencies. |
| Betrayal naturally produces growth | It can produce stories or cause players to leave. Measure both, including the person who lost. |

These corrections preserve the core game. They remove certainty that the existing documents do not substantiate.

## 9. Entry and distribution evidence

This is a targeted check of relevant primary sources, not another comprehensive games survey. Features in successful products establish precedents; they do not establish that copying them causes growth.

- **Jackbox:** its documented joining flow uses a browser and room code, with one person hosting. The useful lesson is that the invitee should have very little setup. PACT has the additional BYO-agent requirement, so it cannot honestly promise equivalent friction yet. [Official joining guide](https://www.jackboxgames.com/how-to-play/).
- **Among Us:** Innersloth's May 2021 update connected Discord room invitations with joining on mobile and PC. The useful lesson is to carry the exact social destination through the invitation. This is a historical feature account, not a causal growth study. [Developer update](https://www.innersloth.com/twitch-discord-mobile-integrations/).
- **Clash of Clans:** Supercell's clan notice guidance describes player-authored recruitment and filters, and explicitly says a notice does not guarantee applications. PACT can make openings discoverable without claiming automatic matches. [Official recruitment guide](https://support.supercell.com/clash-of-clans/en/articles/recruiting-clan-members-3.html).
- **OpenAI connection:** current official instructions distinguish development testing from public publishing. Developer-mode availability depends on account/workspace policy; public plugin publication requires review and approval. A working development connector is not a completed consumer onboarding flow. [Connection instructions](https://developers.openai.com/plugins/deploy/connect-chatgpt), [publishing process](https://developers.openai.com/plugins/deploy/submission).

For the pilot, support one assistant route whose actual account eligibility, authorization prompts, message exchange, and quota use have been verified. For public growth, require an install/connect flow ordinary intended users can complete unaided. Do not advertise “paste this into any chatbot and play” before it works. No cross-provider compatibility or listing approval has been established here.

People can inspect stories, preview a kingdom, and choose an invitation before connecting. Autonomous play still requires their own supported LLM. This is a constraint on the reachable audience, not a detail that marketing can remove. Do not add an API-key purchase or terminal setup to the intended mass-market flow.

## 10. The smallest version that tests this design

Keep the base prototype from document 30: one world, simple building and combat, three resources, grain upkeep, bounded commitments, standing contracts, and a public Record.

**Add to that first test:** a first-pact link that survives onboarding; a small notice board; a shared Court page; and one Chronicle template with an optional signed excerpt. Document 30 postponed Seals and social presentation, but a growth test needs enough of them to test the claimed sharing loop. It does not need full evidence battles, a recommendation feed, or cinematic replays.

**Defer:** deep empire administration, loans, the computed Word ladder, a cosmetics store, paid agents, and elaborate season awards. These can wait until players want the basic relationship game.

Begin with **50 seed players over three weeks**, including existing friend groups and solo arrivals. Arrange disclosed opening sessions so available agents can meet; do not populate the world with fake people. Leave capacity for invited newcomers. After onboarding, reduce researcher prompting and observe voluntary return and sharing. Log how much facilitation was necessary.

The first audience should include ordinary strategy-game players who already use a supported assistant, not only developers. Existing communities supply initial social density; independent arrivals test whether the game works beyond those communities. Expand invitations in manageable waves only when new arrivals can find available counterparties.

## 11. Measure people who stay, not links sent

Define activation as: **a connected player directs their agent in a real negotiation, reaches an executed outcome, and can identify their own contribution**. Count a first contract payment, verified purchase, or resolved coordinated action—not merely an agent greeting or a signature that never executes.

| Question | Measurement |
| --- | --- |
| Does the invitation explain the game? | Visitors who understand the opportunity and choose to start; separate story links from direct invitations |
| Is setup survivable? | Connection success, abandonment step, total elapsed time, manual help, and provider/account eligibility |
| Does the first relationship happen? | First real offer, executed outcome, waiting time, and counterpart availability |
| Does the human feel responsible? | Can they explain a choice and its consequence without reading a full transcript? |
| Do people want to share? | Voluntary sharing without a reward; qualified new visits and activations from those links |
| Do newcomers stay? | Return for meaningful play on/after day 7; separate invited, solo, unsupported-account, and researcher-assisted cohorts |
| Does the game damage the loop? | Loss-related quitting, harassment, unwanted subordinate roles, quota exhaustion, alt farming, and closed groups excluding newcomers |

The main growth measure is **new players acquired through player-originated links who return for meaningful play after a week, per active existing player**. Use a fixed acquisition window, initially one week, and allow each newcomer seven days to mature before comparing cohorts. Include non-sharers in the denominator. Deduplicate overlapping links; exclude returning accounts and detected self-referrals. This is an attributed measure, not proof of incremental causation or a perfect count of unique humans. Track existing-player churn alongside it: acquisition can increase while the active community shrinks.

Illustration, not forecast: 100 active players × 40% who share × 3 distinct new visitors each × 60% connecting × 70% activating × 40% returning after a week = about **20 retained new players**. That is 0.20 per existing player, despite apparently healthy sharing. Shares alone can look impressive while growth remains weak.

Initially use these proposed decision gates: at least 7 of 10 representative eligible newcomers connect and reach a real offer unaided within five minutes; at least 7 can explain how their direction affected play; and at least three independent invitation chains produce an activated newcomer who returns after a week without a referral reward. These are diagnostic thresholds, not industry benchmarks or statistical proof. Report failures and assistance, not only successful completions.

If connection fails, fix entry. If nobody has anything worth negotiating, fix the economy. If players negotiate but do not care, fix human agency and visible consequences. If people share but invitees leave, fix the destination and first relationship before increasing promotion. Compare invitation-led entry with generic entry in a larger randomized test once the small pilot works; fifty seed players cannot establish maximum growth.

**The recommendation is PACT with an invitation into a real relationship as its front door.** Its growth hypothesis depends on people wanting another person in their story—and that person finding an ambition of their own.
