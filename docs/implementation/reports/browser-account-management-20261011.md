# PACT-166 — browser account management, 11 October 2026

The founder has three kingdoms and asked to switch or link them without repeatedly logging out. This extension adds `/accounts`, links from the game and guest entry, and the same account chooser during validated MCP OAuth consent. Add an existing guest by private recovery code or a registered account by password/MFA, choose a displayed kingdom, and explicitly connect it. Creating a new kingdom is a separate collapsed option. No production accounts, mandates, schedules, model calls or population settings were changed for verification.

## Authentication and implementation

Each saved account is an independently authenticated existing human session in a host-bound `__Host-pact_saved_<account UUID>` Secure/HttpOnly/SameSite=Lax cookie. The existing active cookie is retained for gameplay. The roster checks token ownership, revocation, idle/absolute expiry, product scope and active account status before projecting names, handles and CSRF values; it never returns session tokens. Invalid saved cookies are pruned. Up to ten accounts can be remembered; switching retains session identity, original authentication time and absolute expiry. Reading inactive accounts does not extend their idle expiry.

Switch and forget require the chosen account's own session cookie, CSRF and allowed Origin. Forget revokes only that session and removes its saved cookie; other devices and MCP grants remain intact. Existing guest recovery keys remain in the pre-existing browser recovery mechanism, now associated with individual owners. Adopting a legacy code requires an authenticated server check that it belongs to the current guest. Passwords and human session tokens never enter JavaScript storage or account URLs. OAuth keeps its standard single-use authorization-code callback and existing PKCE/resource/client/redirect validation.

New OAuth consent includes the selected account identity and fails if the active session changes underneath it. Existing grants never rebind after a browser switch. The game refreshes other tabs on an account-change signal; stale CSRF fails closed. Human-only settings, approvals, leases, ownership and quotas are preserved. No migration or extra credential store is introduced. The production gateway proxies `/accounts` directly to the API, with no-store responses.

## Evidence

Local PostgreSQL fixtures exercise three saved owners, switching without new sessions or reset authentication, unchanged inactive idle expiry, wrong-owner recovery keys, foreign/incorrect/stale CSRF, forged cookie identity, missing credentials, idle expiry, closing accounts, global revocation, selective forgetting with another device, and new/old OAuth grant ownership. Existing identity regressions cover password/MFA/reset/session behavior. OAuth/client SDK regressions preserve dynamic registration, query validation, code exchange, resource and callback rejection. The old browser-form mock was replaced with chooser script compilation plus actual HTTP and browser evidence.

The in-app browser created three disposable local synthetic kingdoms (Amber, Birch, Cedar), selected Amber and reloaded with all three still available, then selected Cedar on the OAuth consent page. Both desktop views are recorded in `evidence/browser-accounts-20261011.png` and `evidence/browser-account-link-20261011.png`. The actual authorization returned successfully and displayed the named continuation. This browser blocks the local `/callback` with `net::ERR_BLOCKED_BY_CLIENT`, including direct navigation; complete browser callback exchange is therefore not claimed. Actual PostgreSQL HTTP code exchange proves binding to the selected owner. No real ChatGPT installation or physical second-device test was performed; these changes do not complete PACT-155/156 certification.

`npm run build`, `npm run typecheck` and `npm run lint` pass, including the 26 unchanged published contract schemas. `npm test` passes 357 unit checks. `npm run test:integration` passes 384 checks across 57 files with one existing skipped integration case. Planning render/check and whitespace validation pass. Local fixture credentials and runtime state remain ignored and excluded from commits.

Release verification is pending deployment at this source commit; completed hosted evidence will be appended separately.

## Specification and tracking

Access specification 1.3 documents this founder-authorized extension. All tickets sourcing access were reviewed before refreshing its recorded hash: existing identity, auth UI, OAuth and channel boundaries remain intact; the extension does not reopen completed original work or satisfy external/scheduled certification. The original deferred production tickets and terminal experiments remain unchanged. PACT-166 is recorded locally because Linear issue creation failed at the free workspace issue limit (request `a48d4ec9afc37397`); no remote issue or completion is invented.

Device memory requires each account to be authenticated once per browser. Idle/absolute expiry, resets and revocation require signing in again. Browser switching does not turn one existing ChatGPT grant into a different kingdom, and host-side multiple-account support must be checked separately. There is no automatically authorized next experiment, paid run or scheduler enrollment.
