# PACT-038 — independent supply settlement

Ticket: [PACT-038 / MNI-102](https://linear.app/mnim/issue/MNI-102/pact-038-implement-independent-contract-delivery-and-default)
Implementation revision/PR: uncommitted workspace changes
Verification date/environment: 2026-09-23, local Node 24 and PostgreSQL test schemas

Commands/results: `npm run build` passed; `npm run typecheck` passed; `npm test` passed (92 tests); `npm run test:integration` passed (84 tests); `npm run lint` passed; `python3 docs/implementation/backlog.py render`, `python3 docs/implementation/backlog.py check`, and `git diff --check` passed locally.

## Result

The rules worker now settles supply contracts in the documented tick phases. It closes due contracts before delivery, captures post-upkeep ordinary/allowance/floor state, proportionally allocates independent outgoing obligations, debits all payers before incoming credits, and then settles defaults and bonds. Exact directional installments, overflow, and private failure causes are persisted. There is no public client command surface yet for notice, release, or refusal; the transaction-bound methods are available for that later adapter.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-038 | Six-hour contract has 360 installments; incoming funds cannot finance outgoing in the same tick | `tests/integration/supply-settlement.test.ts`, 360-minute and circular-funding cases | Passed: 360 rows, none at end boundary; unfunded reverse direction delivered zero despite later incoming credit. |
| PACT-038 | Partial/default independence; both-default bonds, overflow, floors, grant expiry | Same integration suite: proportional shortage, funded counterflow, dual default/refusal, bond return overflow, changed Grain floor and expired allowance; exact one-hour notice and mutual release | Passed in local PostgreSQL test schema. |

## Documentation

`docs/architecture/supply-offers.md` now documents phase order, reserve-floor unit semantics, close methods, overflow, account export/retention, and PACT-039's remaining authority-integration boundary. Migration `packages/kingdom/migrations/0026_supply_settlement.sql` owns terminal metadata, refusal/release signatures, and installments.

## Decisions and limitations

Reserve floors come from the authority module's transaction-bound public read; absent mandate/floor means zero. A default event omits private amounts and causes. PACT-039 still must reconcile future authority exposure on installments and closure. Authenticated client commands for notice/release/refusal and account-deletion-triggered owner default are not wired yet; the settlement service exposes transaction-bound methods for the first, and the latter needs a privacy lifecycle integration before player use. Neither hosted deployment nor live player validation was run. Local synthetic fixture records do not establish production readiness.

## Handoff

Next dependency-ready work: PACT-039, future commitments and exposure authority. Deploy only after reviewing migration/order and completing that integration; no VPS deployment occurred in this ticket.
