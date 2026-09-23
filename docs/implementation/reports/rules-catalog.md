# Versioned rules catalog and exact arithmetic

Ticket: [PACT-028 / MNI-92](https://linear.app/mnim/issue/MNI-92/pact-028-encode-the-versioned-rules-catalog-and-exact-arithmetic)

Implementation revision/PR: `aca145f` on local `master`; no PR or push.

Verification environment: 23 September 2026; macOS arm64; Node.js 24 for tests.

## Result

`@pact/domain` exports the validated `pact-s1-v1` catalog and exact resource/rational helpers. Published Season One numeric tables and limits are encoded as schema-checked data. No authoritative game process or live API command was changed by this ticket.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Published values have catalog entries and explicit units; no floating-point combat/settlement comparison | `packages/domain/src/rules-catalog.ts`, `packages/domain/src/rational.ts`, [unit contract](../../architecture/rules-catalog.md), focused Vitest | Pass for the pure rules layer. Resource helpers use `bigint`; power and comparisons use reduced rationals. Later combat/settlement handlers must consume these helpers. |
| Construction affordability, six-hour food, rational power, and exact API quantities | `packages/domain/src/rules-catalog.test.ts` | Pass. Tests cover grant-first Farm II and unaffordable Hall VI, 288 Grain / 48 per hour = 360 minutes, published 332.5 attack power, and decimal-string JSON/API schema round-trips. |

Supporting checks passed under Node.js 24: `npm run build` (all packages, workers, and clients), `npm exec vitest run -- packages/domain/src/rules-catalog.test.ts` (7 tests), `npm test` (81 tests across 27 files), `npm run typecheck`, and `npm run lint` (including package-boundary fixture). Planning render/check and `git diff --check` passed before ticket close. No hosted CI or deployed-game check is claimed.

## Documentation

[Rules catalog and arithmetic](../../architecture/rules-catalog.md) documents units, JSON semantics, and the boundary between catalog and later authoritative handlers.

## Decisions and limitations

The catalog holds whole-resource design constants as safe integers, but live quantities are `bigint` internal units. Fixture validation is strict on the published rules ID. Generic command receipts already use decimal strings; PACT-specific production commands and persistence arrive in later tickets. Tests do not claim deployed gameplay or hosted CI.

## Handoff

PACT-029 is the next dependency-ready rules ticket. Its worker must use game-time boundaries and catalog values; it must not create resources during a suspended-world catch-up.
