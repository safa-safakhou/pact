# Ranked kingdom founding

Ticket: [PACT-031 / MNI-95](https://linear.app/mnim/issue/MNI-95/pact-031-activate-real-kingdoms-exactly-once)

Implementation revision/PR: uncommitted during verification; no PR or push.

Verification environment: 23 September 2026; macOS arm64; Node.js 24; PostgreSQL 17 test database.

## Result

The real human-only founding path creates one ranked kingdom per account and unique handle in an atomic world-admitted transaction. It initializes the specified buildings, builders, restricted grants, Home Guard, charge pools, zero score/ordinary wealth, first-tick time, and activation event. The private sandbox fixture remains solely for phase-zero tests. No VPS deployment is claimed.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Concurrent attempts return one kingdom, grants, and activation time | `tests/integration/kingdom-founding.test.ts` | Two simultaneous calls return identical activation records. PostgreSQL counts exactly one kingdom/ledger root, three founding grant movements, seven buildings, two builders, eight UUIDv7 Home Guard, one score baseline, and one activation event. Handle collision is rejected without rename. |
| Draft never targetable before commit; zero ordinary wealth and time/charges start once | Same integration test and migration | No kingdom exists for a private draft; injected building-write failure rolls back kingdom, ledger, draft activation, and outbox. All ordinary balances are zero, raid/scout charges are full, and the first tick is exactly one game minute after the committed game time. A connection check older than seven real days is rejected. |
| Human-only API and owner-scoped reads | Same integration test | Missing cookie/CSRF and agent sessions receive 403; an authenticated human activates and reads only their kingdom. Account erasure removes ranked and linked ledger state. |

Supporting checks passed: `npm run build`, `npm run typecheck`, `npm test` (88 tests in 30 files), `npm run test:integration` (51 tests in 16 files), and `npm run lint` including module-boundary checks. Planning render/check and `git diff --check` are run before ticket close. No hosted CI or deployment observation is claimed.

## Documentation

[Founding contract and operations](../../architecture/kingdom-founding.md) records API, ownership, transaction, migration, and VPS startup order. [Module boundaries](../../architecture/modules.md) and [resource ledger](../../architecture/resource-ledger.md) reflect the integration.

## Decisions and limitations

The world clock serializes activation against due ticks; PostgreSQL uniqueness supplies the final account/handle race guarantee. The founding event ID is the stable idempotency reference. The minimal troop table does not implement training/combat; those are PACT-033 and later. The old sandbox route is retained for phase-zero tests, not exposed as the Telegram app's activation action.

## Handoff

PACT-032 can use the initial building/builder state and ledger cost-provenance methods. PACT-033 can extend troop identity with training and placement behavior. Apply migration `0019_kingdom_founding.sql` before running the new API on the VPS.
