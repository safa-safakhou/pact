# Troop training, placement, and capacity

Ticket: [PACT-033 / MNI-97](https://linear.app/mnim/issue/MNI-97/pact-033-implement-troop-identity-training-placement-and-capacity)

Implementation revision/PR: `35af1b4` on local `master`; no PR or push.

Verification environment: 23 September 2026; macOS arm64; Node.js 24; PostgreSQL 17 test database.

## Result

`TroopService` extends founding identities with a single paid sequential training batch, reserved owned slots, immutable trained unit IDs, exclusive home/visiting/scouting/attacking placements, zero-refund disband, and identity-based battle eligibility/locks. It reuses the resource ledger's ordinary-only training provenance and partial-cancellation logic. The rules worker settles due units in the atomic boundary phase. No client-facing troop command or live raid/garrison integration is claimed.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Simultaneous training/assignment cannot overfill owned or visiting pools or reuse a unit | `tests/integration/troops.test.ts`, `0021_troop_training.sql` | Concurrent training attempts leave one active batch and never exceed owned capacity including Home Guard. Two owners racing to place 12 visitors in a 20-slot host pool produce one successful commitment. Two simultaneous claims on the same trained ID produce one success. Placements reuse the original ID. |
| Home Guard cannot raid/scout/lend/refund, but can disband for zero | Same integration tests and troop queries | Explicit Home Guard IDs are rejected from all three commitments. Home Guard participates in defensive eligibility, is blocked during a battle lock, and can disband afterward with no balance change. |
| Partial training cancellation refunds only uncompleted reserved costs | Same integration tests and ledger provenance | Two of four Spearmen complete with immutable UUIDv7 IDs; cancellation refunds 80% of the remaining two ordinary Iron/Silver costs once. Already completed units remain. Triggered unit-insert failure rolls back consumption, identity creation, and batch progress; retry completes once. |

Supporting checks: `npm run build`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run lint`, backlog render/check, and `git diff --check` after final edits. No hosted CI or VPS deployment observation is claimed.

## Documentation

[Troop service contract](../../architecture/troop-training.md) covers command boundaries, capacity, cost/identity, placement, battle locks, migration, and worker phase. [Module boundaries](../../architecture/modules.md) are updated.

## Decisions and limitations

The module exposes transaction-bound internal ports; future garrison/scout/raid handlers must validate their own terms and call these ports in the shared transaction. `returnPlacement` is not a player-visible scout cancellation. Battle snapshots contain IDs and side membership, not copied statistics/inventories. Combat outcomes, casualty records, upkeep, and client navigation belong to later tickets. Real provider, pilot, and deployment evidence is not inferred from local PostgreSQL tests.

## Handoff

PACT-034 can count the living identities and hosting responsibility for minute upkeep. PACT-040/041/044 can use the existing-ID placement and battle snapshot interfaces. Apply migration `0021_troop_training.sql` before the updated rules worker on the single VPS.
