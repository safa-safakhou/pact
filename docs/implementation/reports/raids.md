# PACT-044 — Raid lifecycle, contributors, and overlapping battles

Ticket: [PACT-044 / MNI-108](https://linear.app/mnim/issue/MNI-108/pact-044-implement-raids-contributors-locks-and-overlapping)
Implementation revision/PR: uncommitted local checkout at verification time
Verification date/environment: 24 September 2026, Node 24, PostgreSQL 17 synthetic schemas

## Result

The transaction-bound raid service now declares timed raids with one encrypted committed seed, commits each attacking kingdom's UUID units/charge/ordinary provisions, handles up to two nominated contributors and pre-lock withdrawals, pins wall and eligible defender/attacker IDs at T−5, and resolves battles in deadline/declaration order. Resolution rechecks surviving IDs and current hunger/ordinary stock, applies exact combat casualties and leader-only loot atomically, returns survivors, and stores participant/public report variants. The rules worker resolves battles before same-boundary scouts.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| An earlier battle's casualties are absent from every later resolution; no unit can fight from two placements or be duplicated as reinforcement. | `tests/integration/raids.test.ts`, `tests/integration/troops.test.ts`, `packages/domain/src/combat.test.ts`; `npm run test:integration`, `npm test` | Passed locally: two same-deadline raids snapshot the same home defenders but later resolution omits killed UUIDs; attacking placement and one-active-attack checks prevent duplicate offensive commitment. |
| Same-boundary completion/lock/withdrawal, hunger changes, leader cancellation, pinned visitors, last-second requests, and missing units resolve exactly once. | `tests/integration/raids.test.ts`, `workers/rules/src/main.ts`; `npm run test:integration` | Passed locally: completion-before-lock synthetic fixture enters the snapshot, post-lock addition/wall change does not; exact lock-time acceptance/withdrawal rejects; locked visitor return rejects; resolution reads later hunger, skips removed units, and replay transfers no extra loot. Leader cancellation is idempotent and reveals its original seed. |

`npm run build`, `npm run typecheck`, `npm test` (99), `npm run test:integration` (111), `npm run lint`, `sh -n infra/production/bin/deploy.sh`, and `sh -n infra/production/container-entrypoint.sh` passed locally. Backlog and diff checks are recorded below after tracker reconciliation. Docker Compose validation was unavailable on this Mac (`docker: unknown command: docker compose`). These checks do not prove hosted CI, a deployed worker, or real player behavior.

## Documentation

[Raid lifecycle and operations](../../architecture/raids.md), [world-clock phase order](../../architecture/world-clock.md), [module map](../../architecture/modules.md), [seed/combat boundary](../../architecture/raid-randomness-and-combat.md), and migration `packages/kingdom/migrations/0031_raids.sql`. The single-VPS Compose/deploy configuration now mounts a persistent, generated-once raid seed key into the rules worker.

## Decisions and limitations

The strictly next minute boundary plus twenty minutes defines resolution; the lock is five game minutes earlier. Earlier battles' deaths remove those UUIDs from all later eligibility via the troop foreign key. A battle report is never used as a public inventory projection. The key is stable server-only material; restoring a backup containing unresolved raids without its matching key cannot resolve them. PACT-049 adds authenticated public command/approval routing and read projections. No VPS deployment or player pilot was run.

## Handoff

PACT-045 (authorized world views/forecasts) is dependency-ready after this ticket. Apply migration `0031_raids.sql` before starting a rules worker with `RAID_SEED_ENCRYPTION_KEY_BASE64` configured; do not change that key during an active world.
