# PACT-034 — Upkeep, hunger, and desertion

Ticket: [PACT-034 / MNI-98](https://linear.app/mnim/issue/MNI-98/pact-034-implement-upkeep-hunger-recovery-and-desertion)
Implementation revision/PR: uncommitted local checkout at verification time
Verification date/environment: 23 September 2026, Node 24, PostgreSQL 17 synthetic schemas

## Result

The rules worker now deducts placement-based upkeep after production in the atomic game tick. Payer state records Hungry, funded recovery, warning, and attrition. Visiting-detachment default hooks are durable; garrison bond/return execution remains PACT-040.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Recovery requires 60 consecutive funded minutes; first desertion is minute 180, then each additional underfunded hour. | `tests/integration/upkeep.test.ts`, `packages/domain/src/upkeep.test.ts`; `npm run test:integration`, `npm test` | Passed locally: recovery interruption resets, warning at 120, removals at 180/240, and ordinary Grain precedes allowance. |
| Splitting units across contracts or display stacks changes no losses; operational locks do not create starvation immunity. | Pure allocation test, PostgreSQL host/original-owner test with locked visitor | Passed locally: deterministic type/UUID allocation independent of input ordering; separate owner-group losses and locked troop removal/cascaded eligibility. |

## Documentation

[Upkeep module and operations](../../architecture/upkeep.md), [module map](../../architecture/modules.md), and [world-clock phase order](../../architecture/world-clock.md). Migration `0022_upkeep_hunger.sql` adds the two kingdom-owned tables.

## Decisions and limitations

Hunger is keyed by food payer rather than copied onto troop rows, so changing placement changes responsibility without duplicating state. The garrison hook is once per detachment reference and is emitted from the same tick transaction. Future combat must read payer state for the 75% factor; no battle engine exists yet. No hosted deployment, CI, garrison settlement, player pilot, or external certification was run.

## Handoff

PACT-035 (charges/action limits) is next in backlog order and dependency-ready. PACT-040 consumes the durable garrison default hook after its own dependencies are complete.
