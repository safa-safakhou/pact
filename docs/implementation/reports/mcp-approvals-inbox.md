# MCP, approvals, and inbox

Tickets: [PACT-017 / MNI-77](https://linear.app/mnim/issue/MNI-77/pact-017-implement-the-remote-mcp-transport-and-tool-registry), [PACT-020 / MNI-80](https://linear.app/mnim/issue/MNI-80/pact-020-implement-exact-command-human-approvals), [PACT-022 / MNI-82](https://linear.app/mnim/issue/MNI-82/pact-022-implement-the-durable-inbox-and-live-event-delivery)

Implementation revision/PR: local commit after this report (see git log); no PR.

Verification environment: 20 September 2026; macOS arm64; Node.js 24.21.0; npm 11.19.0; PostgreSQL 17 via Colima Compose.

## Result

`@pact/mcp` exposes Streamable HTTP `POST/GET /mcp` with pinned protocol versions `2025-11-25` and `2025-06-18`, origin checks, account-bound sessions, typed sandbox/`pact_command_v1` tools, and dispatcher-backed structured results.

`@pact/approvals` stores immutable exact-command requests with hashes and expiry. Authenticated human `POST` approve/reject commits once; `GET` and deep links never approve; status remains readable after disconnect.

`@pact/inbox` persists audience-filtered events with cursor pagination, acknowledgement, deduplication, SSE delivery, and resync when a cursor predates retention. Delivery never invokes a provider adapter.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-017 | Protocol fixtures pass for initialization, supported/unsupported versions, POST results, GET stream behavior, and isolated client sessions | `tests/integration/mcp-approval-inbox.test.ts` (MCP describe) | Pass |
| PACT-017 | Listing or invoking a tool never grants broader scope; another account cannot resume or read a private stream | Same file (cross-account `openStream` → `FORBIDDEN`; origin mismatch) | Pass |
| PACT-020 | GET, chatbot text, or a host tool confirmation cannot approve; changed/expired terms fail | Same file (review GET path + expired approve → `EXPIRED`) | Pass |
| PACT-020 | Double approval commits once; a successful approval can be read after the original chatbot disconnects | Same file (double `approve` + post-disconnect `review`) | Pass |
| PACT-022 | Disconnect/reconnect returns ordered authorized events without duplicate user-visible cards | Same file (dedupe insert + cursor paging) | Pass |
| PACT-022 | Notification/outbox workers never invoke the provider adapter; omitted delivery cannot change an action receipt | Same file (`assertNoProviderInvocation`) | Pass |

Supporting checks: `npm run lint`, `npm run typecheck`, `npm test` (18), `npm run test:integration` (21), `npm run build:packages`, `npm run build --workspace @pact/api`.

## Documentation

- [MCP API](../../api/mcp.md)
- [Approvals API](../../api/approvals.md)
- [Inbox API](../../api/inbox.md)
- [Module boundaries](../../architecture/modules.md)
- [Database operations](../../operations/database.md)

## Decisions and limitations

Approval commit runs the dispatcher outside the row lock transaction to avoid nested pool transactions, then records the receipt idempotently. Full run leases remain PACT-021. Hosted CI and real MCP host certification were not run.

## Handoff

Next ready work includes PACT-021 (bounded Envoy runs; needs 020). PACT-023 still waits on 017/020/021/022. PACT-004 remains blocked on AWS credentials.
