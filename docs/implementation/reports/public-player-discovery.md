# PACT-054 — public player discovery (game-only Alpha)

Ticket: [PACT-054 / MNI-119](https://linear.app/mnim/issue/MNI-119/pact-054-implement-public-profiles-and-handle-lifecycle). Verification: 1 October 2026, Node 24.19.0, local PostgreSQL 17 disposable schemas. Implementation revision: recorded in the linked Linear completion comment after commit.

## Result

Agents can resolve a known exact handle, case-insensitively, using `pact_player_find_v1({handle})` instead of operator-supplied kingdom UUIDs. Public HTTP `GET /v1/people/:handle` returns the identical profile projection. Both always select public identity/events, even when an owner searches their own handle. Valid missing/closing/retired/erased identities return `found:false`; malformed input is rejected. The guide points connected agents to this entry tool.

This completes the explicitly narrowed [Version 1.4 Alpha](../../pact/alpha.md) ticket, not the postponed original rename/history/reserved-redirect lifecycle. No all-players directory, public notices, contact acceptance, web People UI or new social fields are fabricated; those belong to subsequent Alpha tickets. No application deployment occurred.

## Acceptance evidence

| Current criterion | Evidence | Result |
| --- | --- | --- |
| Exact case-insensitive active founded identity lookup; no private records for unfounded/closing/deleted/unknown identities | New real-database test in `tests/integration/world-views.test.ts`: uppercase resolves exact handle; prefix/malformed/other-product queries do not; closing and erased-account tombstone do not resolve. Draft identities are not queried at all. | Pass; lookup selects ranked kingdom records only, in one repeatable-read snapshot. |
| Public-only fields and equivalent HTTP/MCP projections | Same test checks exact top-level public field allowlist, absence of stock/buildings/troops/contracts/account/online/shared-record data, HTTP/MCP deep equality for the owning agent, scope denial and rejected forged viewer/account fields. | Pass; no write lease or game mutation. Existing public default/battle projection is reused. |

## Checks

- `npm run build` — pass across all existing workspaces; no native/Telegram certification claim.
- `npm run typecheck` — pass.
- `npm run lint` — pass; package boundaries/build order and published contract guard pass. Fourteen existing v1 fingerprints are unchanged; the additive player-find query is now pinned as the fifteenth.
- `npm test` — 175 tests in 53 files passed.
- Focused `npm run test:integration -- tests/integration/world-views.test.ts` — 9 passed.
- Full `npm run test:integration` — 227 passed, one optional local-model test skipped, 39 files. No live provider/model call.
- Backlog render/check and `git diff --check` — pass at completion checkpoint.

## Documentation and boundaries

[World-view module/API](../../architecture/world-views.md) documents the response, invalid/missing behavior, fixed Alpha handles and public visibility. [MCP API](../../api/mcp.md) documents the new tool and its `world:read` requirement. The MCP adapter receives an injected product-neutral read port; only the kingdom module queries its records. No migration, new retained data, extra permission system, infrastructure or hidden model reasoning was added.

## Handoff

Next backlog-order dependency-ready Alpha work is PACT-055 invitations. PACT-057, PACT-058 and PACT-069 are also ready but remain unclaimed. PACT-099 will provide complete new-feature agent access and observable reports after those features exist. The public notice/opportunity feed still needs PACT-059; a new agent without any known handle must truthfully say discovery is limited rather than inventing partners. Hosted release remains the previously verified `alpha-20260929-4` / `2143d92` until a separate deployment is actually run.
