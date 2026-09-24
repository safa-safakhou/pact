# PACT-040 — Garrison contracts, recall, return, and seizure

Ticket: [PACT-040 / MNI-104](https://linear.app/mnim/issue/MNI-104/pact-040-implement-garrison-contracts-recall-return-and-seizure)
Implementation revision/PR: uncommitted local checkout at verification time
Verification date/environment: 24 September 2026, Node 24, PostgreSQL 17 synthetic schemas

## Result

Hall-III lenders can create expiring, exact-version offers for ordinary units and optional bonds. Two signatures activate a transaction-bound contract, immediately assign UUID-identifiable visitors, and reserve agent authority for bonds/host upkeep. The worker settles expiry and first-tick host underfunding; parties can recall, return, or mutually release. Pending exits exclude new battle locks. A host can seize only all surviving units with free owned capacity, no active lock, and an exact human-session permit. Closed garrison records are exported and retained for 180 real days.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Owner and host capacity remain consistent through return/death/seizure; seized units keep IDs and transfer wealth once. | `tests/integration/garrison-admission.test.ts`, `tests/integration/upkeep.test.ts`, `tests/integration/troops.test.ts`; `npm run test:integration` | Passed locally (103 tests): immediate visiting placement, return to original owner, starvation removal, seizure with unchanged UUID and new owner; owned/visiting capacity is enforced by `TroopService`. Wealth is derived from current ownership in future PACT-048; no separate wealth credit is posted on seizure. |
| Underfunded host default and pending return do not extend upkeep exposure beyond the prescribed lock allowance; seizure cannot bypass a lock or human approval. | Same integration suite; `packages/kingdom/src/garrison.ts`, `packages/kingdom/src/upkeep.ts` | Passed locally: first insufficient visiting-upkeep tick defaults host, returns survivors and transfers host bond; agent host reservation includes 5 lock minutes and is released on close; locked recall excludes later battle, and seizure fails without exact permit or before lock end. |

`npm run build`, `npm run typecheck`, `npm test` (97), `npm run test:integration` (103), and `npm run lint` all passed locally. These checks do not prove hosted CI or a VPS deployment.

## Documentation

[Garrison module and operations](../../architecture/garrison.md), [module map](../../architecture/modules.md), and migration `packages/kingdom/migrations/0029_garrison_contracts.sql`.

## Decisions and limitations

The public gameplay command and approval transport remains PACT-049; this is a transaction-bound rules service, not a client endpoint. PACT-044 finalizes overlapping battle resolution. PACT-048 computes Fortune from surviving unit ownership; there is no independent scoring mutation to duplicate. No hosted deployment, player pilot, or external certification was run.

## Handoff

PACT-041 (scouting/private observations) is dependency-ready in backlog order. Keep future command adapters on the same authenticated transaction boundary and pass game time from the world clock.
