# PACT-046 — Fortune accounting and provisional standings

Ticket: [PACT-046 / MNI-110](https://linear.app/mnim/issue/MNI-110/pact-046-implement-fortune-accounting-and-provisional-standings)
Implementation revision/PR: uncommitted local checkout at verification time
Verification date/environment: 24 September 2026, Node 24, PostgreSQL 17 synthetic schemas

## Result

Derived, exact-quarter-unit marked wealth, signed Fortune against the existing baseline, provisional overall/Hall-band ranks, and idempotent hourly snapshots now run from committed kingdom state. The rules worker samples after battles and deliveries. No final awards or season rollover is claimed.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Build/train conversions preserve marked wealth; grants, Home Guard, expected income, borrowed units, and cosmetics never count. | `tests/integration/fortune.test.ts`, `packages/kingdom/src/fortune.ts` | Passed locally: founding state scores zero; ordinary-funded construction and training preserve value across active and completed states; visiting units count for lender only; only explicit committed rows enter the calculation. |
| Transfer, default, cancellation, loot, and seizure fixtures change the correct owner's wealth once and allow negative Fortune. | `tests/integration/fortune.test.ts` | Passed locally: transfer, bond forfeit/compensation, loot, cancellation loss, owner transfer by seizure, troop casualty, negative baseline difference, Hall filters, and repeat hourly sampling. |

`npm run build`, `npm run typecheck`, `npm test` (102), `npm run test:integration` (117), and `npm run lint` passed locally (lint required an export-order formatting pass, then passed). Hosted CI, a deployed worker, and player pilot were not run.

## Documentation

[Fortune service and operations](../../architecture/fortune.md), [module map](../../architecture/modules.md), [world-clock phase order](../../architecture/world-clock.md), and migration `packages/kingdom/migrations/0032_fortune.sql`.

## Decisions and limitations

The live board recomputes wealth from source rows; hourly rows are audit samples, not a second point balance. The current season key is `prototype` and baseline is activation zero. PACT-069 must wire season rollover and a configured key/baseline before Season One awards. Final prize eligibility, abuse review, and award delivery remain future scope.

## Handoff

PACT-047 achievement work can use committed result events without changing Fortune weights. PACT-049 should expose provisional standings through authenticated, rate-limited reads. Apply migration `0032_fortune.sql` before restarting the rules worker; do not backfill a paused world's missed hours using wall time.
