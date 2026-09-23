# Authoritative clock and atomic tick coordinator

Ticket: [PACT-029 / MNI-93](https://linear.app/mnim/issue/MNI-93/pact-029-implement-the-authoritative-clock-and-atomic-tick-coordinator)

Implementation revision/PR: uncommitted local work on `master`; no PR or push.

Verification environment: 23 September 2026; macOS arm64; Node.js 24; PostgreSQL 17 test database.

## Result

The `@pact/world` module persists a game-minute clock, fenced world-worker lease, committed tick sequence, and transactional phase coordinator. The rules worker polls that coordinator. Delayed heartbeats or overdue ticks suspend rather than catching up missed production/upkeep. Operator status/pause/resume commands are available on one VPS. Future gameplay tickets supply the phase handlers; no live economy is claimed yet.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Second worker, lease expiry, duplicate tick, or crash between phases cannot publish mixed-time state | `tests/integration/world-clock.test.ts` | PostgreSQL tests pass for fencing, duplicate suppression, rollback of phase writes, mid-phase lease expiry, retry at the same due tick, and command/tick serialization. |
| Exact boundaries and outage recovery freeze game windows/harvest while account expiries use real time | `packages/world/src/clock.test.ts`, `tests/integration/world-clock.test.ts` | Strict next-minute deadline fixtures pass; a command at a due boundary waits for the tick. An injected 61-second heartbeat gap pauses at unchanged game time, rejects game commands, and resumes at the next real minute without catch-up. Production/upkeep phase hooks receive the same next game minute only after resume. An expired account session remains expired by database real UTC. |

Supporting checks passed under Node.js 24: `npm run lint` (including boundaries), `npm run typecheck`, `npm run build`, `npm test` (83 tests across 28 files), and `npm run test:integration` (41 tests across 14 files). The integration/smoke suite migrated isolated PostgreSQL 17 schemas through `0017_world_clock.sql`. Planning render/check and `git diff --check` passed before ticket close. No hosted CI, deployed-worker uptime, or live gameplay observation is claimed.

## Documentation

[World clock operation and integration](../../architecture/world-clock.md) covers units, lease/admission boundaries, phase order, migration, pause/resume, and outage recovery. [Module boundaries](../../architecture/modules.md) names the new owner.

## Decisions and limitations

Clock truth and worker election use PostgreSQL on the existing single VPS, not Redis or another infrastructure service. A tick either commits all registered handlers and its outbox record or none. The coordinator does not itself produce resources or settle contracts; PACT-030 onward must register transaction-bound handlers. Gameplay command handlers must call `admitCommand` once they exist. Operator resume after a fault is deliberate, so unreliable outcomes are not silently resumed.

## Handoff

PACT-030 can now implement the resource ledger and production phase against this coordinator. PACT-031 can use the committed game timestamp for activation and founding-grant expiry.
