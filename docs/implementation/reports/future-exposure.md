# PACT-039 — future exposure accounting and human exceptions

Ticket: [PACT-039 / MNI-103](https://linear.app/mnim/issue/MNI-103/pact-039-complete-future-exposure-accounting-and-human-exceptions)
Implementation revision/PR: uncommitted workspace changes
Verification date/environment: 2026-09-23, local Node 24 and PostgreSQL test schemas

## Result

The product-neutral authority module has transaction-bound future commitments, 24-game-hour actual-spend records, troop-count commitments, exact one-use human permits, and idempotent consume/release operations. Kingdom adapters connect agent supply signing/bonds/installments/closure, building queue/start/cancel, direct transfers, and training to that ledger. A real supply signature consumes a permit issued under a live human session; an agent cannot attach that permit. The issuer also accepts a live first-party human OAuth grant with `game:act` and rejects a revoked grant. The rules worker composes the validator. Privacy export and retention include the new records. No game stock is escrowed by permission reservations.

## Acceptance evidence

| Acceptance criterion | Check/artifact | Result |
| --- | --- | --- |
| Two concurrent signatures cannot each reserve the last allowance; provider switching never creates a second ledger | `tests/integration/authority-exposure.test.ts` concurrent transactions use two `ExposureService` instances against one account | Local synthetic check passes: one reservation commits, one rejects. No provider key exists in the ledger. |
| Refunds/incoming trades do not replenish spent authority; canceled offers release once; lowered mandates and approved exceptions follow existing-commitment behavior | Exposure, supply-offer, construction, social-transfer, and troop-training integration cases | Local checks pass for rolling spend, no refund credit, canceled-offer release, lowered mandate, and separately labeled one-use human-permit commitments. A real supply signature consumes a DB-backed exact permit; agent reuse is denied. |

## Downstream integration boundary

This ticket implements the authority ledger and game-service transaction boundary, not public game tools. The shared dispatcher still accepts sandbox actions only; PACT-049 explicitly owns replacing sandbox-only routing with typed game commands and approvals across web, adapter, and MCP. It must issue and consume these exact permits within its authenticated command transaction and prove denial of agent self-approval, retries, and rollback. PACT-040 must call the generic troop/upkeep commitment methods for its garrison lifecycle. Neither public gameplay approval nor actual garrison operation is claimed as completed here.

## Documentation and operations

`docs/architecture/authority-exposure.md` describes ledger ownership, 24-game-hour accounting, domain adapters, permit issue/consume behavior, retention, and migration/restart procedure. `docs/architecture/building-queues.md`, `docs/architecture/supply-offers.md`, and `docs/architecture/modules.md` describe integration boundaries. Migration `packages/authority/migrations/0027_future_exposure.sql` is local only; no VPS migration or deployment occurred.

## Verification

Local commands/results: `npm run build` passed; `npm run typecheck` passed; `npm test` passed (97 tests); `npm run test:integration` passed (99 tests across 25 files, including durable session/OAuth permits and a real supply signature); `npm run lint` passed. `python3 docs/implementation/backlog.py render`, `python3 docs/implementation/backlog.py check`, and `git diff --check` are rerun after Linear reconciliation. No hosted CI, live provider, or player checks were run.
