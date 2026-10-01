# Articles and mutual allegiance

Ticket: [PACT-057 / MNI-122](https://linear.app/mnim/issue/MNI-122/pact-057-implement-articles-and-mutual-allegiance).
Revision: implementation commit pending; tests verified 1 October 2026 with Node 24.19 / npm 11.19 / disposable PostgreSQL 17 schemas and synthetic accounts.

## Acceptance evidence

1. **Concurrent choices/signatures and stale terms:** nine PostgreSQL tests in `tests/integration/politics.test.ts` cover concurrent Article limit, competing patron signatures, simultaneous opposite edges, a longer cycle, self/outsider/block denial, proposer-only revision, former participant denial, stale versions, expiry, either-party exact-edge termination and idempotent replay. Product graph lock and active-subject uniqueness retain the graph invariants. An old edge request cannot end a newer patron relationship.
2. **No automatic gameplay authority:** actual allegiance survives Court join/leave/closure. Article demands create no supply/garrison contract, troop or contact. A real typed active supply contract, troop row and ledger balances remain byte-for-byte equivalent across Article publication/withdrawal and mutual edge creation/termination. Public HTTP/MCP outputs match and exclude private state; pending proposals are participant-only. Agent writes through the human handler are denied. Three Articles and three Court pins exhaust the same six-publications/game-day allowance; replacement failure rolls back and withdrawal remains available. Privacy export, erasure and 180-day inactive-content pruning pass.

## Checks

- `npm run build`, `npm run typecheck`: passed.
- `npm test`: 183 passed / 57 files, including two political UI control checks.
- `npm run test:integration`: 262 passed, one optional local-model skipped / 42 files.
- `npm run lint`: passed; boundaries/build order and 20 published schema fingerprints pass, previous 18 unchanged. Three non-blocking warnings, no errors.
- Planning render/check and diff check are recorded in the tracker after reconciliation.

Initial schema syntax blocked build; fixed and rebuilt before behavior testing. No failed/omitted check is counted as success. The normal full suite uses synthetic/fake-provider scenarios, not new live-agent observations.

## Documentation and handoff

[Module/API/player instructions](../../architecture/politics.md) explain strict command shapes, human receipt signatures, active/retained versions, projection pagination, exact-edge recovery, quota and noninterference. The server guide teaches the new read tool and human handoff; People contains labeled human publication/replacement/withdrawal/proposal/sign/decline/end controls. Broader responsive/keyboard/browser rehearsal stays with PACT-061.

Not pushed or deployed; hosted remains `alpha-20260929-4` / `2143d92`. No new player, Chrome, model, production, key/certification or enjoyment claim. PACT-058 (Seals) is the other claimed ticket in this batch; PACT-059 becomes ready after it. Twenty-eight Later tickets remain postponed.
