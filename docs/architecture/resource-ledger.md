# Resource ledger and storage

`@pact/ledger` owns migration `0018_resource_ledger.sql` and all ordinary, restricted founding, and locked resource balances. It exposes transaction-bound `ResourceLedger` methods, not a second HTTP/gameplay command path. Callers supply the authenticated kingdom and a PostgreSQL client from the shared transaction; later application handlers must commit ledger effects, authority reservations, receipts, and outbox records together. The ledger never calls a provider or network service.

All quantities are `bigint` **internal units** (600 per displayed resource). `resource_balances` has one Iron, Silver, and Grain row per kingdom. Ordinary stock obeys its per-resource storehouse cap; restricted founding allowance obeys a separate grant cap; locked bonds sit outside ordinary storage and cannot fund spending. `resource_movements` records every production credit, debit/sink, grant expiry, bond movement, overflow, and cancellation loss with an operation key. Duplicate keys return their original movement; conflicting payloads fail. PostgreSQL row locks and nonnegative constraints prevent concurrent overspend.

`initializeKingdom` creates the published level-I production rates, 600-resource ordinary caps, restricted 200 Iron/100 Silver/80 Grain grants, and seven-game-day expiry. It is called only inside a transaction by the activation handler to be built in PACT-031. `configureEconomy` updates per-minute production and storage caps when buildings change; reducing a cap records lost overflow. `settleProductionMinute` is installed in the rules worker's production phase, and `expireFoundingAllowances` in the first boundary phase. A production retry uses the game-minute operation key and cannot credit twice. The worker currently supplies **week one** as an explicit test-world harvest input. PACT-069 will replace that input with the configured six-week season clock; the ledger already accepts and tests every catalog week.

Spending rules are purpose-specific:

- Construction Iron/Silver spends restricted allowance first, then ordinary stock.
- Army upkeep Grain spends ordinary stock first, then restricted food; it may report partial funding for the hunger handler.
- Trade, transfer, training, bonds, scouting, and raid provisions use ordinary stock only. Grants never become ordinary through a cancellation or bond return.
- `payCost` records paid ordinary/restricted provenance. Completed construction is marked installed; training reservation consumption is recorded per idempotent unit-completion key. Canceling active construction returns 50% to the original categories; canceling remaining training returns 80% of its unconsumed ordinary cost. All percentages floor to internal units. Refunded restricted value after grant expiry is lost and recorded, not laundered into ordinary stock.

The ledger's module-owned rows are keyed by a future kingdom ID and contain no private messages. `deleteKingdomLedger` is the transaction-bound deletion hook for later account/kingdom erasure orchestration; PACT-031 must connect the kingdom to its authenticated owner. Do not issue ad hoc cross-module SQL against these tables.

PACT-031 now calls `initializeKingdom` from the [real founding service](kingdom-founding.md). Its migration registers a deletion trigger for the linked ledger root when a ranked kingdom is erased, while independent ledger fixtures remain possible. This supersedes the earlier future-activation and future-ownership notes above.

Run `npm run db:migrate` before starting the API/rules worker on the single VPS. The integration tests use isolated PostgreSQL 17 schemas and verify rollback, retry, caps, and concurrent spending. An outage does not replay missed production: the [world clock](world-clock.md) resumes at its last committed game minute.
