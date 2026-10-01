# PACT-099 — OAuth authorization button follow-up

Date: 1 October 2026. User-reported private Alpha browser blocker; PACT-099/MNI-158 reopened for this focused correction.

## Cause and change

The authorization HTML set `default-src 'none'` without `connect-src`, so browsers blocked its own login/authorization fetches. Chrome recorded repeated `TypeError: Failed to fetch`; server logs showed the page GET but no corresponding login POST. The uncaught error left no visible feedback.

Allow only same-origin connections with `connect-src 'self'`; preserve the other restrictive directives, cookie identity, CSRF, consent scopes and PKCE. Add accessible pending/error text, disable duplicate submissions, bound each request to 20 seconds and re-enable the button after rejection/network failure. No password, user account data or callback credentials are included in evidence.

## Verification

- Node 24 `npm run typecheck`: passed.
- `npm run test:integration -- tests/integration/client-sdk.test.ts`: 4 tests passed against disposable PostgreSQL 17 schemas. The authorization test now checks CSP and executes the generated browser submit handler with synthetic DOM/network fixtures: success redirect/state, login rejection, authorization rejection, network exception and duplicate-click suppression. Existing normal DCR/PKCE exchange and agent-denied human routes pass.
- These handler fixtures do not simulate browser CSP enforcement; the explicit response-header regression guards the discovered omission. Hosted browser completion still requires the owner to submit their consent; no personal password is read or OAuth grant silently authorized.

## Deployment and handoff

Deployment pending. PACT-099 remains In Progress until the correction is rolled out and verified. No Later ticket is selected. [Connection instructions](../../operations/codex-playtest.md) document visible feedback and stale-page recovery. No migration, economy or agent mandate change.
