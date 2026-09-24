# PACT-037 — Supply offers and activation

Ticket: [PACT-037 / MNI-101](https://linear.app/mnim/issue/MNI-101/pact-037-implement-supply-offers-signatures-bonds-and-contract)
Implementation revision/PR: uncommitted local checkout at verification time
Verification date/environment: 23 September 2026, Node 24, PostgreSQL 17 synthetic schemas

## Result

Typed supply terms, exact-version signatures, provisional authority hooks, capacity checks, ordinary-stock bond locks, and atomic contract activation are implemented as internal transaction-bound services. Delivery, notices, release, and default settlement are PACT-038.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| A counteroffer invalidates old signatures; simultaneous acceptances cannot duplicate a contract or exceed bond/contract capacity. | `tests/integration/supply-offers.test.ts` | Counter releases the old agent reservation; stale signature fails. Concurrent final signing yields one contract; ninth active flow and over-cap bond fail. |
| Half-funded bonds, zero/zero flows, invalid notice, self-contracts, expired offers, and blocked parties fail without partial activation. | Same integration test | Both-side bond activation rolls back if the second party cannot fund; invalid terms/self/expired/blocked paths reject. Failed actions create no contract or extra offer quota. |

## Documentation

[Supply-offer module and operations](../../architecture/supply-offers.md), [module map](../../architecture/modules.md), and [world-clock phase order](../../architecture/world-clock.md). Migration `0025_supply_offers.sql` adds offers, signatures, and contracts. Privacy export and closed-offer retention are updated.

## Decisions and limitations

The agent-authority port fails closed until PACT-039 connects the production exposure ledger; tests inject a transactional fake and verify reserve/release/activate behavior and exact exposure. Human signatures must still arrive through the shared authenticated command path when gameplay routes are added. No hosted CI, deployment, or player validation was run.

## Handoff

PACT-038 consumes active contracts, terms, bond balances, and exact start/end times for ordered minute settlement and terminal states. PACT-039 completes the authority-ledger adapter.
