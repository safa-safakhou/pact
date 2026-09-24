# PACT-041 — Scouting and private observation reports

Ticket: [PACT-041 / MNI-105](https://linear.app/mnim/issue/MNI-105/pact-041-implement-scouting-and-private-observation-reports)
Implementation revision/PR: uncommitted local checkout at verification time
Verification date/environment: 24 September 2026, Node 24, PostgreSQL 17 synthetic schemas

## Result

Scouts use two committed ordinary Spearmen, one charge, and ordinary Silver/Grain in one transaction. The target gets a factual outbox notice. The timed operation completes in the `battle_and_scouts` phase and creates a private, explicitly shareable coarse report sampled then, with an exact Wall level and stale timestamp.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Home Guard, locked units, self-targets, and insufficient resources cannot start a scout; retries never charge twice. | `tests/integration/scouting.test.ts`, `npm run test:integration` | Passed locally: each invalid start rolls back charge, placement and stock; same operation key returns existing order and one charge spend. Agent action also tests mandate reservation and release. |
| Band boundary/fractional-stock fixtures pass and no visiting-owner names, private contracts, or offsite troops leak into the report. | `packages/kingdom/src/scouting.test.ts`, `tests/integration/scouting.test.ts`; `npm test`, `npm run test:integration` | Passed locally: exact troop/resource edges, positive sub-unit stock, visiting defender included in coarse count, offsite unit excluded, owner-only and explicit-share reads. |

`npm run build`, `npm run typecheck`, `npm test`, `npm run test:integration`, and `npm run lint` passed locally. These checks do not prove hosted CI or an overlapping live battle.

## Documentation

[Scouting module and operations](../../architecture/scouting.md), [module map](../../architecture/modules.md), migration `packages/kingdom/migrations/0030_scout_reports.sql`.

## Decisions and limitations

The report is a typed engine observation, not a live view or an inference. The report-share table records authorized recipients without copying hidden source state. PACT-044 adds final combat-before-scout integration and PACT-049 adds the public gameplay command and approval transport. No VPS deployment or player pilot was run.

## Handoff

Next ready ticket is PACT-044 (raid lifecycle/battle integration), subject to its dependency/status check.
