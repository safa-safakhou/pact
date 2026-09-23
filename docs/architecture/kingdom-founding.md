# Ranked kingdom founding

`@pact/kingdom` owns migration `0019_kingdom_founding.sql` and the one-time `KingdomService.activate(accountId)` operation. The API derives `accountId` from a human session; clients never submit ownership or initial wealth. The public endpoints are:

- `POST /v1/setup/activate`: human cookie, trusted Origin, and CSRF token required. Returns the stable activation record. Repeats, including concurrent repeats, return the same kingdom ID, activation time, game time, tick sequence, and event ID.
- `GET /v1/kingdom/me`: authenticated owner-only read of that activation record; returns 404 before founding.

Activation uses the [world clock's](world-clock.md) command-admission transaction and committed game minute. It rechecks verified account, current terms, complete unexpired private draft, and a connection check no older than seven real days under row locks. The unique `(product_scope, account_id)` and `(product_scope, handle)` constraints prevent duplicate ranked kingdoms and handle theft. A handle conflict returns `HANDLE_TAKEN` and available suggestions; no automatic rename occurs. A due tick returns `TICK_PENDING` for retry; a suspended world returns `WORLD_PAUSED`.

The transaction inserts seven level-I buildings, two builder slots, one training slot, eight immutable UUIDv7 Spearman Home Guard at home, full raid/scout charges, a zero marked-value score baseline, and the [ledger's](resource-ledger.md) restricted founding grants. Ordinary Iron/Silver/Grain all start at zero. The first active tick is stored as the next game minute after the committed activation minute. The draft becomes activated and `kingdom.activated.v1` enters the outbox in the same commit. A failure at any step leaves the draft private and produces no targetable kingdom, grant, or event.

This is the minimal troop identity/placement schema for founding. Training, military behavior, upgrades, and score calculation belong to later tickets. The old `/v1/setup/sandbox-activation` remains a non-ranked fixture for existing phase-zero tests, not a game entry point. The Telegram test app calls the real activation route. Account erasure cascades kingdom-owned rows and deletes the linked ledger root through the registered trigger; independent ledger fixtures remain possible.

On the single VPS, run `npm run db:migrate` before starting the updated API, then run the rules worker so the committed world clock advances. The migration is additive. No hosted activation or deployment validation is asserted here. Local checks are `npm run build`, `npm run typecheck`, `npm test`, `npm run test:integration`, and `npm run lint` with PostgreSQL 17 available for integration tests.
