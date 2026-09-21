# Shared client SDK and capability contract

Tickets: [PACT-083 / MNI-84](https://linear.app/mnim/issue/MNI-84/pact-083-build-the-shared-client-sdk-and-capability-contract)

Implementation revision/PR: uncommitted local work on `master`, based on `8ca3911`; no PR.

Verification environment: 20 September 2026; macOS arm64; Node.js 24.21.0; npm 11.19.0; PostgreSQL 17 via Colima Compose.

## Result

`@pact/client-sdk` now provides platform-independent human and agent clients with injected transports, command ID and clock ports, immutable prepared commands, exact retry, receipt reconciliation, authenticated read projections, cursor subscriptions, typed errors, and shared receipt view models. The web host has a thin cookie/CSRF transport adapter rather than duplicating command behavior.

`GET /v1/capabilities` publishes audience-specific API, command, event, and MCP versions and capabilities. Versioned `/v1/*` requests receive the current API version header; an explicit unsupported version returns `426 UNSUPPORTED_API_VERSION`.

The commit audit also found that recently added cookie-authenticated command, OAuth authorization, mandate, approval, and inbox acknowledgement writes did not call the established origin/CSRF guard. Those routes now enforce it and have regression coverage.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-083 | A web and non-browser test client issue the same sandbox command and observe the same receipt after a timeout/retry | `tests/integration/client-sdk.test.ts` — “reuses one command across web and non-browser clients after a lost response” | Pass. The web request committed and its response was discarded; the non-browser client retried the identical prepared command; receipt reconciliation matched and the counter changed once. |
| PACT-083 | SDK imports no DOM/React Native/Telegram globals; no client retry silently changes an idempotency key or acquires human scopes | `scripts/check-boundaries.mjs`; `packages/client-sdk/src/client.test.ts` | Pass. The portability boundary rejects host imports/globals; both retries shared the same command object and ID; human clients reject agent scopes and agent clients retain only declared agent scopes. |
| PACT-083 | Publish API/schema versions and capabilities with graceful unsupported-version behavior | `tests/integration/client-sdk.test.ts` — capability/version case | Pass. Human capability metadata was audience-filtered and an old explicit API version returned HTTP 426 with `UNSUPPORTED_API_VERSION`. |
| Related security regression | Cookie-authenticated writes require origin and CSRF proof | `tests/integration/client-sdk.test.ts` — cookie-write regression case | Pass. Command, OAuth authorize, mandate, approval, and inbox acknowledgement POSTs without proof each returned HTTP 403. |

Supporting checks: `npm run lint`, `npm run typecheck`, `npm test` (20), `npm run build`, and `npm run test:integration` (24) all passed under Node.js 24.

## Documentation

- [Client SDK and capability contract](../../api/client-sdk.md)
- [Shared API contracts](../../api/contracts.md)
- [OAuth API](../../api/oauth.md)
- [Authority / mandates](../../api/authority.md)
- [Approvals API](../../api/approvals.md)
- [Inbox API](../../api/inbox.md)
- [Module boundaries](../../architecture/modules.md)
- [Repository setup and commands](../../../README.md)

## Decisions and limitations

The SDK never owns credentials or host state: browser, native, Telegram, and test hosts inject transport and storage behavior. Prepared commands use a non-owning actor placeholder that the server always replaces from authenticated credentials. Retries accept the original prepared command instead of rebuilding it, preserving the idempotency key and payload exactly.

Hosted CI, signed native device builds, and a real Telegram Mini App were not run; those belong to PACT-084 and PACT-085 after their remaining dependencies are complete.

## Handoff

PACT-083 is complete. Version 1.2 later removed the hosted-deployment dependency from PACT-009 and replaced AWS with the project single-VPS contract. PACT-084 and PACT-085 still wait on PACT-023, while PACT-009 can proceed locally without claiming VPS deployment evidence.
