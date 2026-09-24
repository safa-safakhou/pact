# PACT-051 rules verification — progress record

Ticket: [PACT-051 / MNI-115](https://linear.app/mnim/issue/MNI-115/pact-051-run-transaction-replay-and-adversarial-rules-tests) — in progress. Implementation revision/PR: uncommitted local checkout. Verification: 24 Sep 2026, Node 24, PostgreSQL 17 with PostgreSQL client 18.4.

The new seeded integration fixture runs 120 deterministic ledger operations with pre-commit failure injection, idempotent replay, an independent balance model, and journal reconciliation. The restore rehearsal dumps and restores an isolated synthetic schema and verifies recovered stock, troop placement, committed receipt, and deduplicated outbox delivery. Both checks passed locally. `npm run build`, `npm run typecheck`, `npm test` (104), and `npm run test:integration` (129) passed; lint passed after formatting. See [verification instructions](../../architecture/rules-verification.md).

PACT-051 remains open: the [R01–R06 matrix](../../architecture/rules-verification.md#r01r06-evidence-matrix-incomplete) maps current fixtures and gaps, but generated cross-module scenarios and fault injection around every durable command/tick transition have not been completed. This rehearsal is not a full VPS base/WAL backup restore, hosted CI run, or pilot observation.
