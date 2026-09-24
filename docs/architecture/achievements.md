# Event-driven achievements and earned cosmetics

`@pact/kingdom` owns a private `AchievementService.processPending(client)` in the final rules tick phase. It consumes only named, trusted outbox event types and checks their source records where those modules exist. A processed-event key and `(scope, account, achievement)` award key make replay harmless. Each first award inserts the ornament entitlement and one +25 earned-Gem wallet entry in the same transaction, then emits `achievement.awarded.v1`. The wallet and entitlement tables are separate from resource balances, authority, troop capacity, and Fortune. There is no public event injector or game-resource conversion.

The eight one-time triggers are:

| ID | Mechanical proof |
| --- | --- |
| `first_stone` | Completed building instruction from `building.completed.v1`. |
| `first_pact` | Two positive, fully paid installments of the same signed supply contract at one minute; settlement emits `supply.full_both_delivered.v1`. |
| `kept_the_table` | Natural expiry of a six-hour-or-longer supply contract without default. |
| `answered_the_call` | Ordinary visiting defender UUIDs in a resolved successful defense. |
| `breach` | Ordinary attacking participants in a resolved successful raid. |
| `came_back` | Training completes after a recorded battle loss of owned ordinary troop UUIDs; Home Guard losses do not qualify. |
| `own_your_words` | Future publication module emits trusted `seal.published.v1` only after valid Seal publication. This ticket tests the event fixture; the public Seal flow is not shipped. |
| `winter_stores` | Future season module emits trusted `season.low_harvest_week.completed.v1` after a full low-harvest week. The engine verifies the kingdom existed at week start, exactly 10,080 minute checks were recorded, and none was underfunded. Missing history fails closed. This ticket tests the event fixture; the season clock is not shipped. |

`AchievementService.read(client, authenticatedAccountId)` returns earned Gems, achievement IDs, and owned ornaments. The eventual transport adapter must derive the account from credentials. `0033_achievements.sql` owns awards, cosmetic entries, processing keys, and battle/upkeep evidence. Apply it before the updated rules worker: upkeep settlement writes fault evidence on an underfunded minute, and raid resolution now records ordinary eligible UUIDs in its participant report. Pending outbox events can be processed after restart; a processed event cannot grant a second item or Gem credit. No award table or wallet entry is an instruction to a game command handler.

Retention/rollover: achievement and ornament ownership is permanent until account deletion. The processed-event keys contain no message text; per-minute upkeep checks and battle-loss evidence are retained for trigger verification and must be included in the season-retention policy when PACT-069 supplies season boundaries. Do not erase evidence mid-season or grant a winter ornament from an incomplete history.
