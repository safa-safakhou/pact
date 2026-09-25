# Account privacy API

`@pact/privacy` implements the phase-0 account export, closure, retention, and restore-suppression lifecycle. All routes are human-cookie routes under `/v1/privacy`, emit `Cache-Control: no-store`, and derive the account from the authenticated session. Caller-supplied account IDs are never accepted.

## Export

`POST /v1/privacy/exports` requires the current session cookie, `Origin`, `X-CSRF-Token`, and `{ "password": "...", "mfaCode": "..." }` when MFA is enabled. It reauthenticates and rotates the session before building the export. The response contains an authenticated `downloadUrl`, its seven-day expiry, and the rotated CSRF token.

`GET /v1/privacy/exports/:token` requires the rotated human session. The opaque token is stored only as a SHA-256 digest. The JSON response contains a readable index and explicitly selected account-owned data, including bounded Envoy tool results. Explicit inbox and direct-conversation reads may include owner-visible private game prose within these results; automatic convenience context does not. Password hashes, token hashes, MFA material, provider ciphertext/wrapping material, internal security signals, legacy draft internals, and other accounts' rows are not selected.

## Account closure

`POST /v1/privacy/deletion` has the same recent-password, MFA, origin, and CSRF requirements. A successful request:

- marks the account `closing` and clears the browser cookie;
- revokes human sessions, OAuth grants/refresh tokens, MCP sessions, pending approvals, and active model credentials;
- stops active Envoy runs and releases their write leases;
- removes OpenRouter authorization flows, Telegram link bootstraps, links, and channel sessions;
- writes the deletion deadlines to PostgreSQL and fsyncs an opaque tombstone to the separately mounted deletion registry.

The phase-0 account and its cascading private rows are removed within 30 days unless a scoped, reviewed legal hold is active. Gameplay retirement and later social data remain owned by their later implementation tickets.

## Retention and restore replay

The API runs retention daily. Expired exports are removed after seven days; revoked/expired authentication material has a one-day processing tolerance; unused drafts expire after seven days; completed run records and their tool-result summaries expire after 30 days; inbox prose expires after 90 days; and Telegram launch bootstraps expire at their declared deadline.

Production requires `PACT_DELETION_REGISTRY_FILE`. The file contains only deletion UUID, product scope, opaque account UUID, and three timestamps. It is outside the PostgreSQL backup volume. `privacy-replay` imports it after migrations and before API/workers start, then reapplies closure or purge to data resurrected by an older restore. Records are compacted after the 65-day backup-suppression window.

Operators can attach narrowly scoped legal-hold metadata through `PrivacyService.placeLegalHold`; every hold requires a basis, data scope, and future review date. Releasing the hold allows the next replay/retention pass to purge a due account.
