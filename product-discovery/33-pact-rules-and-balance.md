# PACT — rules and initial balance

Design draft 1.0 · 15 September 2026 · Companion to [32 — Full game design](32-pact-game-design.md)

**This is the proposed authoritative ruleset for the first prototype and first-season tuning.** All values below are hypotheses. Arithmetic checks can establish internal consistency; they cannot establish fun, economic stability, abuse resistance, or retention. Implementation must version these rules and publish changes.

## 1. Fixed principles and explicit changes

Keep: one world, no geographical movement, player-owned kingdoms, BYO Envoys, no AI NPCs, costly automated combat, breakable agreements, private intelligence, and meaningful human authority.

Resolve the earlier drafts as follows:

| Earlier ambiguity | Rule in this package |
| --- | --- |
| Public records versus scarce identities | Identity is public when published; current military/economic state is private |
| Purchased builders described as “not power” | Two builders for everyone; cosmetics-only purchases |
| Guaranteed script resistance | Scripts are allowed under the same limits; no claim that they cannot win |
| Trust flow treated as solved | No computed Word ladder in Season One; raw evidence and player judgment |
| No new-player surplus versus first-pact entry | Early production can supply a modest trade; starting grants are restricted |
| Standing exchange versus forbidden escrow | Deliveries are separate obligations; no guaranteed atomic swap. Only explicit bonds are held by the service |
| Troops lent but somehow “kept” | Reinforcement ownership, recall, seizure, and battle locks are defined below |
| A contract with seven days' notice could be effectively permanent | Maximum duration 72 hours in Season One; shorter defaults; no automatic renewal |
| Season score without a formula | Fortune measures change in marked wealth, with disclosed limitations |

These are designer choices for this draft, not claims that the founder individually approved each number.

## 2. Clock, quantities, and order

The shared clock uses UTC. Production, army upkeep, and standing resource deliveries settle once per minute. Client animations interpolate display values but cannot create spendable resources. Server receipts contain exact time and sequence. Timed game jobs use minute boundaries: round acceptance up to the next boundary, then add the advertised duration. A “20-minute raid” therefore resolves 20–21 minutes after acceptance; the confirmation shows its exact deadline before commitment. The five-minute lock is measured from that deadline.

Resources use fixed units of 1/600 of a resource internally. Hourly contract rates are whole resource amounts. This allows an 8 Silver/hour contract to deliver exactly 80 internal units each minute. The UI rounds for display; expanded receipts expose precise quantities. Never accumulate value by repeatedly rounding each leg upward.

At a minute boundary, process in this order:

1. Apply scheduled season multipliers and complete builds/training due at or before the boundary.
2. Produce resources at the current building rates, respecting storage caps.
3. Pay army upkeep and update food-shortage state.
4. Capture available balances for this tick's contract obligations after applicable reserve floors.
5. Settle all due outgoing obligations from those captured balances; credit incoming deliveries afterward.
6. Mark failed obligations, terminate defaulted contracts, and distribute associated bonds.
7. Resolve battles due at this boundary and apply losses/loot.
8. Update factual views, achievements, and season samples from the committed results.

Incoming contract deliveries cannot finance another outgoing obligation in the same tick. This prevents an unfunded circular chain from appearing solvent through ordering. A newly signed supply contract begins at the next minute boundary. An ending contract has no delivery on or after its end time. All UI calculations use these conventions.

Commands between boundaries are serialized against committed state. A cancellation committed before the final battle lock takes effect; one arriving at the lock time is rejected. Local clock time and the time a player started typing do not establish priority.

## 3. Founding a kingdom

Activation creates Hall I, Farm I, Mine I, Market I, Storehouse I, Barracks I, and Wall I, with two builders and one training queue. One person may operate one ranked kingdom in this world. Changing the connected model does not create a new kingdom or reset limits.

Founding grants:

- 200 Iron and 100 Silver restricted to construction. They cannot be traded, bonded, looted, spent on units, or converted to ordinary stock through cancellation.
- 80 Grain restricted to that kingdom's army upkeep. It cannot be exported, looted, bonded, or used as raid/scout provisions.
- Eight starting Spearmen, marked **Home Guard**: normal defensive statistics and upkeep, but no raiding, scouting, lending, seizure, disband refund, or transfer. They are not replenished for free.

Ordinary spendable balances start at zero and accumulate through production. The UI separates founding allowances from ordinary stock; a construction preview can show both. Construction spends its allowance first. Army upkeep spends ordinary Grain first and the founding food allowance only if needed. Unspent founding allowances expire seven days after activation, with advance notice; this is the only grant expiry.

The starter grants let the player build immediately without creating a transferable sign-up reward. The Home Guard is an ordinary automatic garrison, not an invulnerability effect. Other players can attack an activated kingdom, though it initially has little ordinary loot and no rank advantage to harvest.

The eight Home Guard occupy army capacity and consume 8 Grain/hour. Farm I produces 30, leaving 22/hour before exports. An accepted invitation costs no cold-contact Silver. A new player can therefore trade earned Grain before they can afford a cold message.

## 4. Production, storage, and buildings

There are seven types, one of each. No building placement puzzle or adjacency bonuses. The visual position is cosmetic. Buildings cannot be destroyed, stolen, or downgraded in Season One. Resources, troops, and agreements are the exposed material stakes.

| Level | Farm: Grain/hour | Mine: Iron/hour | Market: Silver/hour | Storehouse: capacity of each ordinary resource | Barracks: owned troop slots and separate visiting slots | Wall power |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 30 | 20 | 10 | 600 | 20 + 20 | 20 |
| 2 | 45 | 30 | 15 | 1,200 | 40 + 40 | 40 |
| 3 | 65 | 45 | 22 | 2,400 | 80 + 80 | 70 |
| 4 | 90 | 65 | 32 | 4,800 | 140 + 140 | 110 |
| 5 | 120 | 90 | 45 | 9,600 | 240 + 240 | 160 |
| 6 | 160 | 120 | 60 | 16,000 | 400 + 400 | 220 |

Each unit occupies one troop slot, including a Rider or Ram. Upkeep, price, and counters distinguish units. This count-based capacity is deliberately easy to read. Visiting units use visiting slots, not owned slots; their original owner also continues to count them against its owned capacity until ownership changes or they die.

Market produces Silver automatically; it is not an automatic marketplace matching offers. Trade still requires counterparties and communication. Production is credited automatically; there is no collection tap.

### Upgrade cost and time

For each building, multiply the base Iron/Silver cost by the target-level multiplier. Time is determined by the target level. Costs are paid once when actual construction begins.

| Building | Base Iron | Base Silver |
| --- | ---: | ---: |
| Hall | 180 | 90 |
| Farm | 40 | 20 |
| Mine | 50 | 25 |
| Market | 40 | 30 |
| Storehouse | 60 | 30 |
| Barracks | 80 | 40 |
| Wall | 80 | 30 |

| Target level | Cost multiplier | Construction time |
| --- | ---: | --- |
| 2 | 1 | 10 minutes |
| 3 | 3 | 2 hours |
| 4 | 7 | 8 hours |
| 5 | 15 | 24 hours |
| 6 | 25 | 72 hours |

For example, Hall VI costs 4,500 Iron and 2,250 Silver and takes 72 hours. Storehouse V can hold those amounts. Farm II costs 40 Iron and 20 Silver and takes ten minutes.

At Hall I, other buildings can reach level II. Thereafter their maximum is Hall level + 1, capped at VI. To upgrade the Hall to level H, require the Farm and Barracks at H and the Storehouse at least H−1. Hall upgrading does not disable current functions. This dependency has no cycle: Farm/Barracks II are possible before Hall II, and so on.

Hall unlocks: II permits Archers; III permits Riders and lending troops; IV permits Rams; V and VI increase access to higher building development without adding new unit types. Basic supply contracts, public identity, and Courts are available at activation. Scouting requires ordinary trained units, not a Hall unlock.

Two buildings can be under construction simultaneously. One waiting instruction per builder is allowed but reserves no resources or slot-dependent effects until it starts. If funds or prerequisites are missing then, it waits visibly; it does not borrow or choose another upgrade. One building cannot occupy two builders.

Canceling an unstarted instruction is free. Canceling active construction refunds 50% of paid Iron/Silver, rounded down to internal units, to their original ordinary/allowance categories. A completed building retains its previous level until the next level fully completes. Canceling cannot turn restricted grants into tradeable resources or earn development credit.

### Storage and income limits

Ordinary storage caps apply independently to each resource. Production beyond the cap is lost. Incoming trade or loot above capacity is also lost on receipt; the sender's obligation counts as delivered. The receiving party is warned before signing if projected overflow is likely. The service does not silently enlarge the storehouse or return excess supplies to create delivery ambiguity.

Bonds are outside ordinary storage while locked, cannot fund upkeep, and cannot be looted. Bond-return overflow is lost under the same disclosed receipt rule. Restricted founding allowances are separately capped by their grant amounts.

An ordinary transfer has no universal exchange price. The agents negotiate. There is no bilateral imbalance tax in this draft: its earlier claimed effect would also tax legitimate suppliers, tribute, and aid. Alternate-account control must be tested rather than disguised as a solved tax formula.

## 5. Units and army upkeep

All costs use ordinary resources. Training cannot spend founding construction allowances.

| Unit | Iron | Silver | Training time per unit | Grain/hour | Attack | Defense | Loot capacity, resource units |
| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| Spearman | 10 | 4 | 3 minutes | 1 | 6 | 10 | 4 |
| Archer | 10 | 6 | 4 minutes | 1 | 8 | 6 | 4 |
| Rider | 30 | 16 | 8 minutes | 3 | 18 | 12 | 12 |
| Ram | 60 | 30 | 12 minutes | 4 | 2 | 2 | 1 |

Spearmen counter Riders, Archers counter Spearmen, Riders counter Archers. Rams suppress walls and have poor field strength. No critical hits, skills, unit levels, equipment rolls, or separate ammunition in Season One.

One training queue processes units sequentially and continues while disconnected. A batch reserves its full costs and owned troop slots. Queue limit: one batch of at most 40 units. Each completed unit becomes usable. Canceling remaining units refunds 80% of their reserved costs, rounded down. Upkeep begins on completion. Barracks upgrades leave existing training running at its original speed.

Troops at home consume their owner's Grain. Troops committed to a raid consume their owner's Grain. Visiting defensive troops consume their host's Grain as an explicit term of the garrison contract. This changes supply responsibility, not their ownership.

### Food shortages

Each minute deduct the required upkeep. If there is insufficient Grain, spend what exists and mark every troop hosted/fed by this kingdom **Hungry**. Their combat power is 75% until they complete 60 consecutive adequately funded minutes. A displayed timer shows recovery; a last-second single Grain transfer cannot remove the penalty.

After 120 consecutive underfunded minutes, desertion begins. Every additional full underfunded hour removes 5% of each fed detachment, rounded up, capped by its remaining count. This includes visiting troops and Home Guard. A fully funded minute resets the consecutive shortage counter but not the separate 60-minute combat recovery requirement. Exact-boundary upkeep occurs before combat.

Disbanding is allowed outside a battle lock, returns no resources, and immediately reduces upkeep. The host can choose disbanding its own units; it cannot disband another owner's visiting troops. Seizure is a separate action.

There is no automatic borrowing, forced resource purchase, or server reasoning to fix starvation. A standing supply agreement may save an offline kingdom if it actually delivers. A player can downsize, stock up, pay more, change allies, or accept attrition.

### Numerical economy checks

- Founder: Farm I 30/hour − eight Home Guard 8/hour − export 12/hour = **10 Grain/hour surplus**. The original 80 food allowance can remain intact while early trade uses earned production.
- Farm II increases that surplus to **25/hour** at normal harvest.
- Military example: 40 Spearmen, 20 Archers, 20 Riders = **120 Grain/hour**. Farm IV supplies 90 normally, a **30/hour deficit**; during 80% harvest it supplies 72, a **48/hour deficit**.
- A kingdom storing 288 ordinary Grain and importing nothing can cover the latter net deficit for **six hours**, assuming no construction, provisions, other transfers, cap effects, or later changes. It becomes Hungry only after it can no longer fund a full tick.

These examples establish that trading is feasible and dependence can arise. They do not demonstrate that players will find either enjoyable.

## 6. Supply contracts and bonds

The standard contract sheet has five groups: **flows each way, frequency, duration, notice, bonds**. Under the sheet are the parties, version, start/end timestamps, and signature controls. These are identity/state, not extra negotiation parameters.

For Season One:

- Each party may promise one resource flow to the other, or zero. This supports exchange, one-way aid, and tribute. Complex baskets require separate contracts.
- Frequency is displayed per hour; actual settlement is per minute.
- Duration options: 1, 6, 24, or 72 hours.
- Notice options: none, 1, or 6 hours, and never longer than the contract duration. “None” means a clean exit can be immediate; the other party can see this before signing.
- Each side may post one resource bond. For a supply contract its marked value cannot exceed six hours of that side's promised outgoing flow, or the whole remaining flow if shorter. A side with no outgoing promise posts no supply bond. The player's total locked bonds across all contracts cannot exceed 10% of one current storehouse capacity, measured in resource units. These limits constrain protected storage; they do not eliminate abuse.
- Maximum eight active outgoing supply contracts and eight incoming. A two-way contract consumes one of each for both parties. Contract capacity is equal for every player and not purchasable.

Offers expire in 15 minutes by default; permitted expiry is 5–60 minutes. Countering creates a new exact version. Either signature becomes stale when terms change. Activation requires both valid signatures and all promised bonds available; locking the bonds and creating the contract is one transaction. A failure creates neither half a contract nor a partial bond.

### Delivery is not guaranteed exchange

The two delivery obligations are processed independently from the pre-delivery balances. If one side can pay and the other cannot, the funded side can deliver that tick while the other fails. The contract then defaults and future flows stop. Already delivered resources remain with the receiver. Bonds can compensate, but there is no invisible escrow or transaction reversal.

If a player lacks enough of a resource for all obligations, allocate available amounts proportionally to what is due. Resolve leftover internal units by contract ID order. An obligation receiving less than its full due amount fails; no hidden “best friend” priority list is applied by the service. The player can end selected contracts before settlement rather than let a shortage affect several.

Reserve floors set in the human's authority screen apply to automated exports, including signed standing flows. For Grain, the food reserve may include the remaining founding food allowance, but exports can spend only ordinary Grain. Thus available Grain export is the lesser of ordinary Grain and the excess of total usable food above the floor. Allowance expiry can change that calculation and is previewed. Raising a floor may cause default; the UI previews affected agreements before the human applies it. The contract clearly states that it is an executable promise, not reserved future stock. Human-directed manual spending is allowed, but the interface shows ensuing contractual exposure.

### End states

| State | Trigger | Mechanical consequence |
| --- | --- | --- |
| Expired | Scheduled end time | Stop flows; return unclaimed bonds |
| Ended with notice | Valid notice reaches its end | Deliver until that time, then stop and return bonds |
| Defaulted | Immediate exit without required notice, reserve/funding failure, or explicit refusal | Stop after current committed processing; record default; defaulter's bond transfers to counterparty |
| Mutually released | Both sign an early release | Stop at the agreed boundary; return bonds |

If both parties default on the same tick, both posted bonds are forfeited to the other party. A nondefaulting party's own bond returns. Default transfers do not heal a failed obligation or continue the agreement. A contract records the mechanical cause—insufficient stock, owner termination, or reserve constraint—not a moral verdict about intent.

Permanent public default events identify parties, time, and contract ID. Private resource amounts and clauses remain private unless deliberately published. The public event cannot say that a grain supplier caused a particular defeat unless that is labeled as someone's interpretation.

No automatic renewal. The Envoy must renegotiate while available. Duration expiry keeps relationships revisitable without requiring daily repetitive clicking when a 72-hour deal is appropriate.

One-off resource transfers are also possible between accepted contacts: one sender, one resource, one positive whole amount, with a maximum of 24 transfers per rolling day. Transfer commits immediately, subject to ordinary funds, agent authority, and recipient capacity/overflow rules. The recipient need not be online. It is not reversible just because a promised return payment fails. Units cannot be gifted with this action; use the explicit garrison/seizure rules. Tribute is a fixed resource rate in Season One, not a percentage tax on unknown future production.

Loans, interest, compound penalties, automatic asset liens, and creditor-triggered acceleration are not in Season One. A verbal promise of later repayment is possible, but the service does not present it as a supported loan product.

## 7. Intelligence

Knowing a public ID enables contact or an attack under normal rules. It does not reveal inventories, army composition, visiting defenders, other commitments, or private contracts.

Scouting costs **10 Silver, 5 Grain, one scout charge, and two ordinary Spearmen committed for ten minutes**. Those troops remain unavailable for defense or other commitments during that operation; they return afterward. This is a timed order, not movement along a route. Home Guard cannot scout.

A scout report samples target state at completion and includes:

- Each troop type present at home, including visitors, in bands: 0; 1–10; 11–25; 26–50; 51–100; 101–200; 201–400; over 400.
- Wall level: exact at the time sampled.
- Each ordinary stored resource in bands: 0; 1–100; 101–500; 501–1,500; 1,501–5,000; over 5,000. Fractional positive stock under 1 is labeled “less than 1.”
- A timestamp and a warning that it is not current live state after that timestamp.

The target receives a factual notice that the named kingdom scouted it. The report does not identify owners of visiting units, supplier names, or troops committed elsewhere. That knowledge must come from other observations or disclosures.

Reports contain truthful coarse bands, not random engine lies. Two reports can differ because state changed. A seller may lie about a report in chat, sell stale information, or selectively release it. A signed report proves the sampled observation and time; it does not guarantee the current state or an attack outcome.

Reports can be sent to another player using the same message/evidence system. There is no DRM or promise that a buyer cannot copy them. Prices and payment order are negotiated; sale of an unverified claim remains possible. Distinguish **Engine report**, **Agent inference**, and **Player claim** everywhere.

Participant battle reports are another information source, described below. Public battle outcomes do not automatically reveal exact forces or loot.

## 8. Lending troops, recall, and seizure

At Hall III, a player may sign a garrison contract lending ordinary troops for 1, 6, or 24 hours. The host explicitly accepts troop types/counts, food responsibility, expiry, and any bonds. A garrison bond cannot exceed the detachment's marked recruitment value and shares the same total bond-storage limit as supply bonds. Each player may have at most four lent and four hosted detachments. Payment uses an optional separate supply contract; the UI can group them without pretending one legally enforces the other.

Assignment is immediate when both sides sign, capacity permits it, and the troops are not reserved elsewhere. There is no travel. They defend the host automatically, are not at their owner's home, and cannot be sent raiding or onward-lent by the host.

Their original owner may recall them; the host may return them. Before agreed expiry these actions default the relevant garrison promise unless both sides agree to release it. Default has the published record/bond consequence. Expiry automatically returns survivors, except during an active battle lock; return then occurs after that battle resolves. This extension is stated on the contract before signing.

**Seizure:** a host can deliberately keep a visiting detachment by transferring surviving units into its ownership. It must have free owned troop capacity; it cannot exceed that cap by seizure. All units in that detachment are taken, its garrison contract defaults, the host's bond is forfeited, and a public seizure event identifies both kingdoms. The original owner loses the units and frees those owned slots. No extra troops or resources are created.

Seizure cannot occur during the five-minute battle lock. Default agent authority forbids it; the human can authorize it as a strategic act. The lending UI states clearly that seizure is possible. This is betrayal through an explicit game action, not a model hallucination that the engine accepts as fact.

A kingdom has one visiting-capacity pool, not a separate pool per ally. A large empire cannot stack unlimited reinforcement in one base. Members can also defend themselves and threaten retaliation; the tactical cap does not limit how many political relationships exist.

## 9. Raids

One raid consists of a leader and up to two additional attacking kingdoms. This three-contributor cap is an operation limit, not an alliance-size cap. Every contributor commits actual units, pays its own provisions, and spends its own raid charge. A player cannot add fifty alt accounts as free extra participants to one raid.

### Declaration

The leader selects a known target, at least eight ordinary troops, and loot priority. It spends one raid charge and **5 Grain + two hours of those troops' normal upkeep** as nonrefundable provisions. Ordinary Grain only. Current upkeep continues as well; provisions are an operation cost, not prepaid feeding.

A declaration creates a 20-minute resolution time and immediately informs the target. A target can receive overlapping raids; a friendly declaration cannot reserve a protective slot. Additional attackers may join each raid until five minutes before its resolution, with at least eight troops each. One kingdom may lead or join only one attack at a time.

There is no player-chosen early resolution. The deadline lets the target negotiate, reinforce, or accept losses. It is not a claim that everyone is online to respond.

### During the first fifteen minutes

The leader may withdraw the raid. A contributor may withdraw its troops. Spent provisions and charges are not returned. Troops go home immediately. If the leader withdraws, the raid ends; other contributors get no automatic independent raid or refunded charges.

The target can arrange visiting defenders, recall owned troops from other unlocked commitments, move ordinary resources through valid deals, train units, or negotiate with the attackers. It cannot relocate or hide its kingdom. Paid peace is a promise: transferring Silver does not automatically cancel the raid. The attacker must withdraw, or its Envoy must have already submitted that valid action. The UI never describes this as guaranteed peace.

Troops committed to an attack are absent from their home defense. A military player can be attacked elsewhere while its forces are committed. This is a major reason to value timely intelligence.

### Five-minute lock

At T−5 minutes, snapshot the attacking forces, eligible home defenders, and visiting detachments by unit identity. Those units are locked through resolution. No recall, seizure, disbanding, adding, or removal can change eligibility for that battle. Builds finishing after the lock do not change the locked wall level. Training completed after the lock joins the kingdom but not the locked battle.

Home/visiting defenders can be eligible for overlapping defensive battles without being copied or assigned to a second location. Resolve raids chronologically; equal timestamps use declaration sequence. At each resolution, use only surviving eligible units. Casualties from the earlier battle are already gone for the later one. Keep an eligible defender locked until the last battle that has already locked it resolves. The UI groups overlapping threats and shows that combined commitment horizon. New declarations alone do not extend a lock until their own T−5 boundary. Continuous hostile raids can still pin defenders; that siege pressure and its abuse potential require testing.

Food state is evaluated at resolution, so a last-minute supply failure can still matter. Stores available to be looted are sampled at resolution. This permits economic responses while preventing latency races over reinforcement in the final second.

An owner could have troops on both sides because it previously lent troops to a host it now attacks. Each unit appears on only one side and obeys its committed placement. The UI warns the owner of that situation; it is not magically converted into an alliance prohibition.

### Outcome and loot

The engine resolves one combat roll per side, applies casualties, then loot if the attackers win. Surviving attackers return immediately after resolution; no return march requires agent processing. Surviving visitors remain under their contracts unless expiry/recall was waiting.

Successful attackers can take up to **25% of each ordinary resource present**, limited by surviving attackers' combined loot capacity. One Iron, Silver, or Grain consumes one carrying unit. The leader sets a resource priority before lock; ties follow that fixed order. Restricted grants and bonds cannot be taken. Buildings never fall in Season One.

All carried loot goes to the leader, subject to its storage caps. Splitting it is a separate decision and transfer. A promise to pay supporters is not an invisible guaranteed split. Supporters see the actual total loot and what the leader received; they can compare that with promises they possess.

Repeat attacks receive no special leaderboard bonus. There is no target offline shield. Material depletion and expensive attacks are intended disincentives, not proven protection against harassment. Overlapping attacks remove the friendly-raid shield but increase dogpiling and prolonged-lock risk; both are explicit tests in document 34.

## 10. Exact combat formula

For each side, sum the relevant attack or defense statistic. A troop's counter bonus is **+50% multiplied by the fraction of opposing non-Ram troops of the type it counters**. If the opponent has no non-Ram troops, counter bonus is zero. This rewards mixed decisions without letting every counter claim a full bonus against one token enemy.

Apply the Hungry factor to each detachment's troop power. An attacker Ram removes **30 wall power** before defensive power is totaled, down to zero. Hungry Rams suppress only **22.5** each. Defending Rams do not suppress their own wall. Wall power is not affected by hunger.

Let A be total attacking troop power after these effects. Let D be total defending troop power plus the remaining wall. Each side rolls one fair six-sided die. Faces 1–6 correspond to multipliers **0.90, 0.94, 0.98, 1.02, 1.06, 1.10**. Multiply A and D by their respective rolls.

If modified A > modified D, attackers win. Otherwise defenders hold, including an exact tie. With zero defender power and positive attacker power, the attackers win without combat casualties. With zero attacker power, the raid fails and no loot transfers. These branches prevent division by zero.

For a battle with positive power on both sides, let R be winning modified power divided by losing modified power, so R ≥ 1.

- Winning casualty fraction = **0.05 + 0.15/R**.
- Losing casualty fraction = **min(0.80, 0.25 + 0.20R)**.

Apply the fraction to each owner's participating detachment as a whole, rounding total casualties up, capped by its troop count. Allocate those losses proportionally across its unit types using largest remainders, with fixed type order as tie-breaker. Do not round up separately for every individual troop or formation. Survivors retain their type and ownership.

### Worked battle

Attacker: 20 Spearmen, 10 Archers, 5 Riders. Defender: 15 Spearmen, 15 Archers, Wall II. Both fed, no Rams, both roll 4 (×1.02).

- Attacker Spearmen: 20 × 6 = 120; no defending Riders to counter.
- Attacker Archers: 10 × 8 × (1 + 0.5 × 15/30) = 100.
- Attacker Riders: 5 × 18 × (1 + 0.5 × 15/30) = 112.5.
- **A = 332.5.**
- Defender Spearmen: 15 × 10 × (1 + 0.5 × 5/35) ≈ 160.7143.
- Defender Archers: 15 × 6 × (1 + 0.5 × 20/35) ≈ 115.7143.
- **D ≈ 316.4286**, including 40 wall power.

Equal dice multipliers cancel in the ratio. Attackers win with R ≈ 1.0508. Their casualty fraction is about 19.27%: **7 of 35 troops lost**, allocated 4 Spearmen, 2 Archers, and 1 Rider. Defenders lose about 46.02%: **14 of 30**, allocated 7 of each type.

Attacker survivors carry 16×4 + 8×4 + 4×12 = **144 resource units**. If the defender holds 200 Iron, 400 Silver, and 100 Grain, the 25% limits are 50, 100, and 25. With Silver then Iron then Grain priority, attackers take **100 Silver and 44 Iron**. The leader receives that amount if it has capacity.

The attacker paid 5 + 2×(20+10+15) = **95 Grain** in provisions. Replacing its casualties costs **90 Iron and 44 Silver**. At the Fortune weights below, this example gains 42.25 in marked value before ongoing upkeep and assuming all loot fits. The apparently successful raid has a meaningful material cost; other attacks are not automatically profitable. Enumerating the 36 equally likely die pairs gives the attacker 26 wins, about 72.2%, for these fixed forces and conditions. The illustrative matching rolls are one outcome, not a guaranteed result.

### What the report exposes

Battle participants receive the eligible troop counts/types actually surviving at resolution, wall, applicable hunger factors, both dice, powers, casualties per participant, and total loot. The owner also sees reductions from earlier overlapping battles. Participants do not receive target stock remaining afterward, private contracts, or unrelated commitments. Public viewers see participating kingdom identities, time, winner, and any statement deliberately published—not these exact military amounts.

The report separates **won the battle** from **profited**. An optional owner's arithmetic view marks the resource costs with the fixed Fortune values below. It does not claim to price diplomatic consequences.

## 11. Action limits and communication capacity

Initial service-enforced limits, equal at every Hall level and not purchasable:

| Action | Limit |
| --- | --- |
| Raid | Charge capacity 3; regenerate one every 8 hours; shared by leading and joining |
| Scout | Charge capacity 4; regenerate one every 6 hours |
| Open negotiations | 12 per kingdom |
| Outgoing messages | 96 per rolling 24 hours; max 400 characters per free-text message |
| Offer create/counter/sign commands | 48 per rolling 24 hours; in addition to message caps |
| New cold-contact requests | 8 per rolling 24 hours; 2 Silver each |
| Published notices | 2 active; each lasts at most 24 hours |
| New public posts/Seals | 6 per rolling 24 hours; owner may remove public visibility without erasing historical publication events |
| State reads | 120 per rolling hour per kingdom; paginated, bounded responses |

Authenticated receipt checks for a specific already-issued command and the human's safety/authority controls have separate anti-abuse rate limits. They cannot consume the last gameplay read and trap someone into leaving dangerous authority active. Contact blocking and credential revocation always remain accessible to the account owner.

The 96 outgoing messages are a maximum, not a recommended workload. A default session starts with at most six conversations, 12 outgoing messages, and 15 minutes of active work. Expanding that requires an explicit player session setting within the same world limits. Exact model requests and quota use depend on provider behavior and remain unmeasured.

Existing accepted contacts have no per-message Silver charge, but still use message limits. A cold request contains one short note and is not an accepted contact. A recipient can have at most eight pending cold requests; a sender gets a clear unavailable result when the queue is full, without spending Silver. A successful queued request costs Silver even if declined.

No sender can accumulate more than four unread messages in one accepted thread. A recipient's total pending agent-message queue is capped at 48; new sends fail clearly and can be retried later under normal limits. This bounds quota pressure without claiming that harassment is solved.

Mechanical notifications such as battle deadlines, failed commands, and contract settlement are separate from player text and do not consume the recipient's message allowance. The client groups them. Rate limits are not proof of equal model performance or protection from many accounts.

## 12. Fortune, levels, and achievements

### Fortune formula

Use fixed display/accounting weights: **Iron = 1, Silver = 2, Grain = 0.25**. These are score weights, not official market prices or promises to exchange resources.

Marked wealth W includes ordinary stored resources, ordinary resources committed to active construction/training, locked bonds still owned by the player, installed construction funded with ordinary resources at its original paid cost, and surviving owned ordinary units at their fixed recruitment cost. Owned units lent elsewhere remain the lender's wealth until death or seizure. Borrowed units, founding allowances, grant-funded building value, Home Guard, cosmetics, and expected future payments are excluded.

At season opening, capture W₀. For a newcomer, capture W₀ at activation, which is zero under the grant exclusions. **Fortune = W − W₀.** It may be negative. Scoring samples close hourly; the live owner preview is labeled provisional. End-of-season standings use the final committed snapshot at the published boundary.

Construction moves existing ordinary wealth into installed value; it does not create points by itself. Training moves it into units. Cancellation losses, upkeep, provisions, and casualties reduce wealth. Production increases it. An ordinary transfer moves marked wealth between players. Default moves a bond between owners. There is no second scoring bonus for transacting or reporting the same value.

This deliberately permits political fundraising and pooling: a player may pay a ruler or support a friend. **It measures accumulated outcomes in a shared economy, not independent solo skill.** One-person alt farms are prohibited; real-player support is possible. No transfer formula can cleanly distinguish all disguised collusion from meaningful politics. Reward review and testing remain necessary.

Received gifts can raise Fortune, so this is not advertised as an economically unfarmable ladder. Contract receivables do not count, avoiding scores based on promises. The prototype uses cosmetic stakes and provisional standings until abuse tests pass.

### Comparison and rewards

There is one overall Fortune board and filters for Hall I–II, III–IV, and V–VI. A player's season band can only rise, using their highest Hall reached that season. Their accumulated Fortune follows them to the new band. These are comparisons within the same world, not war restrictions. Delaying an upgrade to remain in a band is a known strategy and tuning risk.

New arrivals additionally see a seven-day comparison against kingdoms activated in the same calendar week, evaluated at equal account age. It has an arrival medal, not military rewards. It does not promise that a late arrival can win a six-week accumulation contest.

Every player with three meaningful active days earns the season participation banner. Active means a completed build, executed player exchange, completed scouting operation, or resolved raid involvement—not merely opening the app. No distinct-partner requirement punishes small friend groups.

Proposed season honors: top 25% of eligible players within each development band earn a bronze border; top 10% silver; top 1% gold. These awards require at least 100 eligible players in the band; smaller pilots show ranks but issue no percentile claim. The overall top three earn dated display plaques. Ties receive the same honor; public rank ordering uses earlier time of reaching the final Fortune value only as a display tie-breaker.

### First-season achievements

All are one-time, non-tradeable visual rewards; no resource, authority, production, or troop benefit.

| Achievement | Exact trigger | Visible reward |
| --- | --- | --- |
| First Stone | Complete an upgrade | A stone marker by the Hall |
| First Pact | A signed player supply contract delivers a full tick both ways | A small crossed-ribbon pennant |
| Kept the Table | A six-hour-or-longer contract completes without default | A table ornament |
| Answered the Call | Your visiting ordinary troops participate in a successful defense | A shield on the barracks |
| Breach | Participate with ordinary troops in a successful raid | A dented gate ornament |
| Came Back | Complete training after a battle in which you lost ordinary troops | A repaired banner detail |
| Own Your Words | Publish a valid Seal | A cosmetic wax-stamp variant; no endorsement of its claim |
| Winter Stores | End one complete low-harvest week without any underfunded upkeep tick | A winter lantern |

Founding/alt accounts can earn some easy cosmetics; those items confer no power and cannot be sold. Do not turn these into cash-value referral rewards.

## 13. Season boundaries and economy sinks

The six-week production schedule is defined in document 32. Multipliers affect only newly produced Grain. They do not reduce existing stores, modify signed quantities, or affect Iron/Silver. World notices show the exact next boundary and its effect on the owner's current production.

At season close: process the final pre-boundary events, snapshot Fortune and eligibility, preserve the result, and begin the next season with a fresh W₀. Units, buildings, resources, contacts, contracts, bonds, and history persist. A contract crossing the boundary continues; its value is not duplicated. Pending combat uses the rules version recorded on declaration unless an emergency world suspension is necessary.

Sinks are upkeep, provisions, scouting fees, casualties, construction/training cancellation fees, and storage overflow. Building and training costs are material consumption even though their marked value persists for Fortune. There is no company-operated commodity buyer or unlimited market stabilizer.

Endgame saturation is a risk: six capped building levels and storage do not support indefinite accumulation. Season One must measure when development stops offering choices. Later seasons may introduce sidegrades or new production constraints, but this draft does not invent an untested infinite upgrade treadmill to hide that problem.

## 14. Examples of legitimate strategy and known failure tests

The engine permits, but does not prescribe: selling grain to rivals; publicly defending a supplier; paying for peace and being deceived; spreading an unsupported claim; authentic but selective quotation; recalling troops at a costly moment before lock; seizing a garrison; joining a raid and withholding the promised split afterward; and declining every proposal the player dislikes.

These examples are not strategy buttons. The primitives are offers, messages, evidence, troop commitments, transfer/default/recall/seizure actions, and combat.

Before a public competitive launch, test at least: starting-account farming; grain cycling; protected-storage abuse through bonds or training; synchronized gift concentration; deliberate defaults to move bonds; visiting troops counted twice; same-unit offensive commitments; ordered overlapping defenses; order at exact tick/lock boundaries; coordinated raids used to pin defenders indefinitely; and a scripted optimizer against real Envoys.

The next document assigns those tests and service responsibilities. No amount of precision in this ruleset substitutes for observing whether these interactions make people want another session.
