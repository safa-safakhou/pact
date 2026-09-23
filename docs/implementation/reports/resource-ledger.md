# Resource ledger, provenance, and storage

Ticket: [PACT-030 / MNI-94](https://linear.app/mnim/issue/MNI-94/pact-030-implement-the-resource-ledger-provenance-and-storage)

Implementation revision/PR: `cd1aac0` on local `master`; no PR or push.

Verification environment: 23 September 2026; macOS arm64; Node.js 24; PostgreSQL 17 test database.

## Result

`@pact/ledger` owns ordinary/restricted/locked balances, exact movement records, founding grants and expiry, storage caps, construction/training cost provenance, idempotent credits/debits, bond lock/return, and explicit overflow/cancellation losses. The rules worker calls grant expiry before production in the same atomic world-tick transaction. Actual kingdom activation, building/training commands, contracts, raids, and the configured six-week harvest calendar are later tickets; no live economy is claimed.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Property tests conserve value across debit/credit/overflow and reject negative balances | `packages/ledger/src/policy.test.ts`, `tests/integration/resource-ledger.test.ts` | Deterministic randomized cases check exact conservation and nonnegative remainder. PostgreSQL tests cover 80% harvest credit, cap overflow, storage shrink loss, grant expiry, idempotent replay, and atomic rollback with the world tick. |
| Concurrent commands cannot overspend; allowances cannot enter trade, bonds, training, raid provisions, or ordinary cancellation refunds | Same tests and migration constraints | Competing serializable transactions permit one spend and reject the other. Purpose policy rejects restricted funds for non-construction/upkeep uses. Cost provenance and cancellation tests preserve restricted categories, including expiry and partial training. |

Supporting checks passed under Node.js 24: `npm run lint` (including boundaries), `npm run typecheck`, `npm run build`, `npm test` (87 tests across 29 files), and `npm run test:integration` (46 tests across 15 files). The integration/smoke suite migrated isolated PostgreSQL 17 schemas through `0018_resource_ledger.sql`. Planning render/check and `git diff --check` passed before ticket close. No hosted CI or deployment observation is claimed.

## Documentation

[Resource ledger contract](../../architecture/resource-ledger.md) documents units, transaction ownership, purposes, provenance, retention hook, migration, and the season-week handoff. [Module boundaries](../../architecture/modules.md) and the package map are updated.

## Decisions and limitations

The ledger takes only a transaction-bound PostgreSQL client so its changes can compose with the existing receipt/outbox transaction. Product-specific grant policy stays in this module, not reusable platform packages. Bond capacity, authorized kingdom identity, unit allocation, building prerequisites, and gameplay command admission are enforced by their later handlers, not by a new client-side permission system. The test-world worker currently uses week-one harvest until PACT-069 owns season opening/configuration.

## Handoff

PACT-031 can activate a kingdom and call `initializeKingdom` once in its command transaction. PACT-032/033 can call cost-provenance methods. PACT-034 can use the partial-upkeep result and world-tick phase hook.
