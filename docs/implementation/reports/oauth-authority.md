# OAuth and mandate authority

Tickets: [PACT-016 / MNI-76](https://linear.app/mnim/issue/MNI-76/pact-016-implement-pact-oauth-for-external-clients), [PACT-019 / MNI-79](https://linear.app/mnim/issue/MNI-79/pact-019-implement-mandate-permissions-and-immediate-spend-checks)

Implementation revision/PR: local commit after this report (see git log); no PR.

Verification environment: 20 September 2026; macOS arm64; Node.js 24.21.0; npm 11.19.0; PostgreSQL 17 via Colima Compose.

## Result

`@pact/oauth` provides authorization-code/PKCE S256, preregistered/metadata/dynamic clients, audience-bound MCP vs human tokens, rotating refresh with family revoke on reuse, revocation, and SSRF-safe metadata URL checks. Consent surfaces client name and draft/kingdom label. MCP tokens cannot authorize human-only operations.

`@pact/authority` persists versioned mandates and an immediate synthetic allowance ledger. Agents cannot mutate mandates; raising authority requires recent human authentication and increments version; concurrent spends cannot overdraw a shared allowance.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-016 | Wrong audience/scope, refresh replay, revoked access, redirect mismatch, and private-network metadata requests fail | `tests/integration/oauth.test.ts` | Pass |
| PACT-016 | Consent names the client and draft/kingdom; OAuth tokens cannot read provider keys or authorize human-only operations | Same file (consent assertions + `assertNotHumanOnly`) | Pass |
| PACT-019 | Agents cannot mutate their mandate or obtain human-only permissions by changing payload text | `tests/integration/authority.test.ts` | Pass |
| PACT-019 | Two sandbox requests sharing an allowance cannot both spend it; raising authority requires recent human authentication and increments its version | Same file | Pass |

Supporting checks: `npm run lint`, `npm run typecheck`, `npm test` (18), `npm run test:integration` (18), `npm run build`.

## Documentation

- [OAuth API](../../api/oauth.md)
- [Authority / mandates](../../api/authority.md)
- [Module boundaries](../../architecture/modules.md)
- [Database operations](../../operations/database.md)

## Decisions and limitations

Refresh reuse detection commits family revocation before returning `INVALID_GRANT` (throw-inside-transaction would roll back the revoke). Full future-commitment exposure remains PACT-039. Hosted CI and real MCP host certification were not run.

Post-completion audit: cookie-authenticated OAuth authorization and mandate writes now call the shared origin/CSRF guard. `tests/integration/client-sdk.test.ts` verifies a session cookie alone receives HTTP 403 on both routes.

## Handoff

At the time of completion, next ready work included PACT-022 (inbox/SSE), PACT-017 (MCP transport), and PACT-020 (approvals). Version 1.2 later replaced the AWS gate with a single-VPS deployment contract and decoupled local credential-vault work from PACT-004.
