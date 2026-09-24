# Authoritative world clock and tick coordinator

`@pact/world` owns migration `0017_world_clock.sql`, `world_clocks`, `world_ticks`, minute-boundary calculations, and `WorldClockService`. The rules worker (`workers/rules`) elects itself using one PostgreSQL row lease per product scope. No Redis or second server is needed. The module is PACT-specific; reusable platform packages do not import it.

The clock stores the last **committed game-minute UTC epoch** and a separate real-UTC due time. All game deadlines, charge windows, harvest weeks, and production/upkeep/contract phases must derive from the game timestamp, never wall time. Account authentication, retention, and other explicitly real-time expiries continue to use real UTC. `timedJobDeadline` rounds strictly to the next game-minute boundary, including an acceptance exactly on a boundary, then adds the advertised duration.

`advance` locks the clock row, verifies a live lease token, executes transaction-bound handlers in rulebook order, inserts a unique tick record and outbox event, and updates the committed game minute in **one serializable transaction**. A failed phase or expired lease rolls back the entire tick; the same due boundary is retried after recovery. Hooks receive a PostgreSQL client and game timestamp; they may write only through that transaction and must not call networks, models, or other external effects. Large calculations may be prepared from a committed snapshot, but final validation and publication must happen under this lock. `admitCommand` locks the same row and passes the committed tick to a gameplay command callback, so an action cannot observe a half-published minute. At or after a due boundary it returns `tick_pending` until the tick commits; callers should retry rather than calculate a deadline from stale time. Existing sandbox commands do not yet use this gameplay admission port.

Phase order: season rollover against pre-boundary state; boundaries/completions/locks; production; upkeep; capture pre-delivery obligations; outgoing settlement then incoming credit; defaults/bonds; battles/scouts; views/achievements. The rules worker registers building/training completion, [charge regeneration](action-limits.md), [cold-request expiry](social.md), [supply-offer expiry](supply-offers.md), [garrison expiry](garrison.md), [raid locks](raids.md), production, [upkeep](upkeep.md), raid resolution, [scout completion](scouting.md), [Fortune hourly sampling](fortune.md), and [achievement evaluation](achievements.md) in that order. Later rule tickets must register the remaining handlers without creating alternate tick transactions.

[Closing-kingdom retirement](retirement.md) now runs after battles, scouts, and garrison returns but before score views. It never advances during a world pause; real-time identity erasure remains in the privacy maintenance job.

## Suspension and recovery

A heartbeat gap over 60 seconds or a tick more than one minute overdue suspends the world at its last committed game minute. Production, hunger, contract/game deadlines, charge regeneration, season/harvest progression, and action windows all remain frozen because no game minute publishes. Expired worker tokens are fenced. Worker or database loss does not trigger a catch-up loop. A provider, email, or single-player disconnection must not pause the world.

Before resuming after an outage, the operator should verify database health, last committed tick/outbox consistency, and phase-handler readiness. Run migrations before starting the worker. On the single VPS:

```sh
npm run db:migrate
npm run clock --workspace @pact/rules-worker -- status
npm run clock --workspace @pact/rules-worker -- pause
npm run clock --workspace @pact/rules-worker -- resume
```

The commands read `DATABASE_URL` from the root `.env` or environment. `resume` keeps the committed game minute unchanged and schedules the next game minute one real minute later, shifting UTC forecasts by the suspension. It does not backfill missed resource ticks or starvation. The worker then reacquires a fresh lease. Never manually advance `committed_game_time_ms` to wall time. A future rules-version migration must explicitly handle existing rows; a mismatched `rules_id` refuses to advance.

These global clock rows contain no player content or account identifier and are retained as world-operational records. Account retention remains with the identity/privacy modules.
