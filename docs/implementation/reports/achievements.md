# PACT-047 — Achievement triggers and earned cosmetics

Ticket: [PACT-047 / MNI-111](https://linear.app/mnim/issue/MNI-111/pact-047-implement-achievement-triggers-and-earned-cosmetic-entitlements)
Implementation revision/PR: uncommitted local checkout at verification time
Verification date/environment: 24 September 2026, Node 24, PostgreSQL 17 synthetic schemas

## Result

The rules worker now evaluates trusted committed events for eight one-time achievements. An award, its exclusive ornament, and +25 earned Gems commit together in a separate cosmetic ledger. Existing building, supply, raid, training, and upkeep records provide mechanical proof; future Seal and season events have internal test fixtures only.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Replayed events cannot award duplicate Gems or ornaments. | `tests/integration/achievements.test.ts`, migration `0033_achievements.sql` | Passed locally: same event replay and distinct qualifying event both leave one award, one entitlement, and one +25 wallet entry; processed-event and per-account unique keys are transaction-bound. |
| Achievements grant no resource/authority/production benefit; a private dev event injector is absent from public HTTP and MCP surfaces. | `tests/integration/achievements.test.ts`, `packages/kingdom/src/achievements.ts`, route inventory | Passed locally: award fixture leaves resource balances unchanged; engine writes only cosmetic/achievement tables and outbox, and no HTTP/MCP event-injection route was added. Future Seal/low-harvest events are synthetic direct outbox fixtures, not shipped player commands. |

`npm run build`, `npm run typecheck`, `npm test` (102), `npm run test:integration` (120), `npm run lint`, `backlog.py render/check`, and `git diff --check` passed locally. The winter fixture includes all 10,080 observed minutes and an underfunded failure case. Hosted CI, a deployed worker, and player pilot were not run.

## Documentation

[Achievement engine and operations](../../architecture/achievements.md), [module map](../../architecture/modules.md), [world-clock phase order](../../architecture/world-clock.md), and migration `packages/kingdom/migrations/0033_achievements.sql`.

## Decisions and limitations

The season clock and Seal publisher are not yet implemented; their trusted event shapes are exercised by private synthetic fixtures. PACT-069 must define retention and rollover for upkeep-check evidence and produce truthful low-harvest-week events. Missing minute coverage fails closed. These checks do not establish hosted CI, deployment, or player validation.

## Handoff

PACT-048 can read earned achievements/ornaments through an authenticated adapter. PACT-049 must not expose event injection. Apply migration `0033_achievements.sql` before restarting the rules worker.
