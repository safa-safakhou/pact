# PACT-042 and PACT-043 — raid randomness and pure combat

Tickets: [PACT-042 / MNI-106](https://linear.app/mnim/issue/MNI-106/pact-042-implement-raid-seed-commitments-and-deterministic-dice) and [PACT-043 / MNI-107](https://linear.app/mnim/issue/MNI-107/pact-043-implement-pure-combat-casualties-and-loot-calculations)

Implementation revision/PR: uncommitted local workspace changes
Verification date/environment: 23 September 2026, Node 24, PostgreSQL 17 synthetic schemas

## PACT-042 result and acceptance

`@pact/kingdom` now generates CSPRNG raid seeds, stores them encrypted with AES-256-GCM under an injected server-only key, publishes the RFC 8785-order SHA-256 commitment, derives unbiased HMAC dice, and reveals/audits the original seed on resolution or cancellation. The verifier is `scripts/verify-raid-seed.mjs` with `tests/fixtures/raid-randomness.json` as the published reference fixture. Migration `0028_raid_randomness.sql` owns commitment and seed-access tables; the privacy retention job removes terminal evidence and audit after 180 days.

| Acceptance criterion | Check | Actual result |
| --- | --- | --- |
| Reference seed yields commitment and attacker 6 / defender 1 | `packages/kingdom/src/raid-randomness.test.ts`; `node scripts/verify-raid-seed.mjs tests/fixtures/raid-randomness.json` | Exact published commitment and dice pass. |
| Reject bytes 252–255 and altered seed/raid/version; deny pre-resolution seed reads; cancel reveals original seed | Pure and `tests/integration/raid-randomness.test.ts` | Rejection, mismatch, denied reveal read, encrypted-at-rest preterminal state, cancellation proof, idempotent retry, and rollback pass. |

## PACT-043 result and acceptance

`@pact/domain` now calculates exact rational troop/counter/hunger/wall/die power, winner and zero/tie branches, owner-and-side casualty groups with deterministic type remainder and immutable-ID selection, surviving carry capacity, priority-based ordinary loot, and leader receipt/overflow. It accepts explicit state and returns a typed participant trace without database or network reads.

| Acceptance criterion | Check | Actual result |
| --- | --- | --- |
| Worked battle: 7 attacker and 14 defender losses, 100 Silver + 44 Iron, 26/36 attacker die-pair wins | `packages/domain/src/combat.test.ts` | All specified figures pass in exact internal units. |
| Reordering/splitting formations preserves results; same owner on both sides remains distinct; nonnegative and zero-power behavior | Same unit suite | Reverse order and seven formation labels give the same trace; same-owner sides remain separate; tie/zero/hungry-Ram/overflow and casualty-bound checks pass. |

## Documentation, checks, and limits

The [module/operations note](../../architecture/raid-randomness-and-combat.md) explains the seed key, declaration/reveal transaction, verifier, retention, calculator input/trace, and PACT-044 handoff; the [module map](../../architecture/modules.md) links it. Local checks passed: `npm run build`, `npm run typecheck`, `npm test` (97 tests), `npm run test:integration` (98 tests), `npm run lint`, the verifier fixture, `python3 docs/implementation/backlog.py render`, `python3 docs/implementation/backlog.py check`, and `git diff --check`. No hosted CI, VPS migration/deployment, real raid, or player check was run.

PACT-044 must authorize the reveal at raid resolution/cancellation, inject the server-only encryption key into its worker, snapshot eligible units and stock, call these components in the authoritative transaction, and publish redacted audience views. This is downstream lifecycle integration, not evidence claimed for these two tickets.
