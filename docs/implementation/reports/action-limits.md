# PACT-035 — Kingdom-wide charges and action limits

Ticket: [PACT-035 / MNI-99](https://linear.app/mnim/issue/MNI-99/pact-035-implement-kingdom-wide-charges-and-action-limits)
Implementation revision/PR: uncommitted local checkout at verification time
Verification date/environment: 23 September 2026, Node 24, PostgreSQL 17 synthetic schemas

## Result

Raid/scout charges now have exact, serial game-time regeneration and persistent spend receipts. A transaction-bound service enforces successful-action rolling windows across all clients and agents for the same kingdom. It is an internal port for later gameplay handlers; no public raid, scout, social, or read-quota routes are exposed yet.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Spend from full starts timer; further spends do not reset it; capped pools bank no extra time. | `tests/integration/action-limits.test.ts` | Exact 8-hour boundary, full restoration, and fresh timer after capped idle time pass locally. |
| Provider/client swaps and retries cannot refill charges or bypass quotas; rejected/idempotent commands incur no additional fee or successful-action count. | Same integration test; kingdom-keyed schema and transaction-bound API | Cross-client charge depletion and post-regeneration replay pass. Rolling quota denial, idempotent replay, and rollback pass. The service never charges a fee; owning action handlers will charge it in the same transaction after validation. |

## Documentation

[Action-limit module and operations](../../architecture/action-limits.md), [module map](../../architecture/modules.md), and [world-clock phase order](../../architecture/world-clock.md). Migration `0023_action_limits.sql` adds successful-action and charge-spend provenance tables.

## Decisions and limitations

Security/receipt reads deliberately bypass the gameplay read counter. Open negotiations and notices are active-state capacities, left to their own modules. Game action handler integration remains with the corresponding later tickets; no hosted CI, deployment, or player test was run.

## Handoff

PACT-036 can consume message/cold-contact/transfer counters; PACT-037 consumes offer counters, and PACT-041/044 use scout/raid charges. The caller must commit each counter alongside its action and receipt.
