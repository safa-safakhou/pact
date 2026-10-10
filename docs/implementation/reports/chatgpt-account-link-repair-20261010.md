# PACT-016 — ChatGPT account-link migration repair

The founder reported `INVALID_REQUEST` while adding another account in ChatGPT's plugin section. The supplied link used the owned legacy `/pact/oauth/authorize` endpoint and `https://tinyagenttools.com/pact/mcp` resource. Public requests with synthetic state/PKCE reproduced HTTP 400 for that resource at both old and current authorization endpoints; switching only the resource to the current `/mcp` returned HTTP 200 account-entry HTML. The registered client, exact ChatGPT callback, scopes and `ui_locales` were accepted. No real supplied state/challenge, human credentials or private transcripts are recorded here.

## Correction

The canonical production configuration now explicitly accepts exactly the owned old MCP resource as an address of this same protected application. This completes the already retained legacy proxy compatibility; foreign resources, spelling variants and human native audiences remain rejected. Discovery still advertises the canonical issuer and resource. Authorization-code and rotating refresh grants keep their original resource; swapping it at exchange/refresh fails. PKCE, exact registered callbacks, human-only operations and replay revocation are unchanged.

Validated MCP consent requests arriving on the explicitly configured old host redirect to the configured canonical issuer before rendering the form. State, resource, client, callback, scopes and PKCE survive the redirect. The consent page therefore uses the current owning-human cookie and origin; no legacy origin was added to the CSRF allowlist. Both current and old resources arriving at the old host redirect. The host does not select an arbitrary redirect destination. Unknown locale parameters are tolerated as before.

This is an operational host-migration correction under the founder's covering implementation/release request, not a change to gameplay rules, account ownership or delegated authority. Use the existing guest handoff/sign-in to recover an existing kingdom before linking it. Creating another ChatGPT connection does not itself require another kingdom. The [official OpenAI authentication guidance](https://developers.openai.com/plugins/build/auth) confirms the supplied stable callback and resource-binding requirements; local route acceptance remains separate from an actual consumer-host installation.

## Verification

`npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (356 passed) and `npm run test:integration` (379 passed, one optional provider test skipped) passed on Node 24 with PostgreSQL 17. The build retains its existing large-bundle advisory. No paid provider or local model inference was invoked.

The four OAuth integration tests cover configured/disabled aliases, foreign and variant resources, wrong scope/audience/callback, no-store legacy redirect with preserved security parameters, canonical consent, no redirect for an unconfigured host, correct original-resource code/refresh, wrong-resource and bad-PKCE rejection, single-use codes, refresh replay family revocation, revoked access, human/agent separation and SSRF-safe client metadata. Historical PACT-016 acceptance/evidence is retained; this correction does not certify pending PACT-155/156 scheduled/external routes.

## Release evidence

Pre-release encrypted backup completed with `Result=success` and `ExecMainStatus=0`. Release **`chatgpt-link-20261010-1`** deployed verified implementation commit **`bfe8a64`**. Runtime and gateway image ledger agrees; standard migration/privacy replay and `verify.sh` passed against the actual protected production environment and canonical public origin. Source archive SHA-256 matched before deployment. An initial extraction attempted before transfer completion failed; full transfer, checksum and gzip validation completed before the successful deployment. The old running service remained healthy during image building. Existing build advisories and dependency audit findings remain; this patch does not change dependencies.

Public route proof used only synthetic state/PKCE and the already registered reported client/callback, with no cookie, consent, account creation or token exchange:

| Authorization host | MCP resource | Actual result |
| --- | --- | --- |
| Old `/pact` | Old `/pact/mcp` | 302 to canonical `/oauth/authorize`, then 200 Enter PACT |
| Old `/pact` | Canonical `/mcp` | 302 to canonical `/oauth/authorize`, then 200 Enter PACT |
| Canonical | Old `/pact/mcp` | 200 Enter PACT |
| Canonical | Canonical `/mcp` | 200 Enter PACT |

Both old-host redirects preserved resource, state, client, exact callback, PKCE challenge/method, scopes and response type. OAuth responses carry only `no-store` cache directives (API/gateway duplicate the directive). Foreign resources returned 400 `INVALID_REQUEST` at both hosts; both metadata routes retained the canonical issuer and authorization endpoint. The anonymous production page is **account entry**, not evidence of human consent; the isolated route fixture separately verified consent rendering and code/refresh operations. The founder must start a fresh Add account flow to verify their actual ChatGPT callback/token exchange. An existing read-only `pact_play_view_v1` call succeeded during diagnosis; no separate widget failure was established by the clarification.

Post-release body-free checks found the clock active at tick 19176, historical collection backfill complete (25,312 processed, zero pending/quarantined), zero enrollments/slices and zero new human display saves. Owner collection reads remain 403 anonymously and absent public cards 404. Native fifty-owner task state was Ready with no Ollama process. No new external/scheduled-route certification is claimed.

The original fifty-owner task remains stopped; no schedules, model calls, enrollments, identities or experimental budgets are changed. Finite historical experiments remain terminal. The original 24 Later tasks remain deferred.
