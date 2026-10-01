# Seasons and equal-age arrivals

PACT-069 / `pact-s1-v1`. `SeasonService` belongs to `@pact/kingdom`; migration `0042_seasons.sql` owns its clock, baselines/highest Hall, immutable closing values and newcomer snapshots. All changes run inside the world tick transaction. No model/network call, independent resource balance, or client-owned scoring exists.

## Opening and order

The first rules tick persists its **previous committed game minute** as opening. Optionally pin that exact minute with `PACT_SEASON_OPENING_GAME_TIME_MS` in the rules-worker environment. It must be a safe, nonnegative, minute-aligned integer. On an existing installation it must match the persisted opening. A different configured opening, rules ID or missing minute fails the tick without publishing partial effects. Reads never initialize seasons. Do not configure a historical/future opening or reset season tables on a live world; this is not retroactive replay of six weeks.

Each season is six seven-day game weeks. Farm Grain production is `100/100/90/80/80/100%`; Mine and Market stay unchanged. The owner projection displays the effective current Farm production; its minute forecast applies each future minute's actual harvest, without multiplying twice. All dates use the paused game clock, not elapsed real time.

`season_rollover` closes against the fully committed pre-boundary wealth and installs the identical wealth as the new baseline **before** completions, production, upkeep, deliveries and combat. Those boundary effects belong to the new season. It never modifies assets, grants, contacts, contracts, raid terms or pinned raid rules. The final phase records current highest Hall, hourly Fortune and age-seven-day snapshots, emits factual harvest/Winter Stores events and advances the season checkpoint atomically. Failed tick rollback and fresh-runtime retries cannot duplicate closure or baseline creation.

## Readers

`GET /v1/seasons` (human session or scoped OAuth `world:read`) and MCP `pact_season_read_v1` share `SeasonService.readCurrent` with a repeatable-read transaction. Optional `cohortStartGameTimeMs` selects a UTC Monday cohort; omit it for the credential-derived owner's cohort. Public results contain signed Fortune numerator / `2400`, ranks and Hall bands, **not** stock or opening wealth. Pending arrivals have no score/rank, not zero. Cohorts close at Monday + fourteen game days. Exact age-seven-day Fortune is immutable, independent of a later season baseline. An old entrant whose capture predates installation is explicitly unavailable; no historical value is invented. Reads expose a committed game-time checkpoint, not a wall-time deadline. Current lists cap at 100 entries; the Alpha is a small friend group.

The web Kingdom tab shows the actual season/week, harvest schedule, next game-time transition and provisional owner/cohort score. The agent learning guide describes the same rules; both external MCP and in-app inference can discover/read this tool without user-supplied player IDs. It does not initiate inference or change authority. PACT-070 separately owns eligibility and honors; no rank entitlement is finalized by this module.

## Retention and operation

Current baselines are live game state. Closed season score history and newcomer samples use real-time closure/capture timestamps, purge after 180 days through the privacy module, export only to their account owner, and erase on account deletion. Foreign keys cascade as a final cleanup. A pause never extends historical retention. Long-term compact cosmetic entitlements belong to the rewards module, not permanent raw score snapshots.

Apply migrations normally before starting the new rules worker. Keep opening in deployment configuration once observed; the database remains its authoritative checkpoint. Persist the existing clock during backup/restore, never fast-forward to wall time. `tests/integration/seasons.test.ts` accelerates **only a disposable schema** by placing the checkpoint immediately before selected real boundary ticks. The pure unit fixture evaluates all 60,480 minutes. Neither fixture is authority to edit live clocks or evidence of a hosted six-week playtest.
