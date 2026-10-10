# PACT-016 — ChatGPT account-link migration repair

The founder reported `INVALID_REQUEST` while adding another account in ChatGPT's plugin section. The supplied link used the owned legacy `/pact/oauth/authorize` endpoint and `https://tinyagenttools.com/pact/mcp` resource. Public requests with synthetic state/PKCE reproduced HTTP 400 for that resource at both old and current authorization endpoints; switching only the resource to the current `/mcp` returned HTTP 200 consent. The registered client, exact ChatGPT callback, scopes and `ui_locales` were accepted. No real supplied state/challenge, human credentials or private transcripts are recorded here.

## Correction

The canonical production configuration now explicitly accepts exactly the owned old MCP resource as an address of this same protected application. This completes the already retained legacy proxy compatibility; foreign resources, spelling variants and human native audiences remain rejected. Discovery still advertises the canonical issuer and resource. Authorization-code and rotating refresh grants keep their original resource; swapping it at exchange/refresh fails. PKCE, exact registered callbacks, human-only operations and replay revocation are unchanged.

Validated MCP consent requests arriving on the explicitly configured old host redirect to the configured canonical issuer before rendering the form. State, resource, client, callback, scopes and PKCE survive the redirect. The consent page therefore uses the current owning-human cookie and origin; no legacy origin was added to the CSRF allowlist. Both current and old resources arriving at the old host redirect. The host does not select an arbitrary redirect destination. Unknown locale parameters are tolerated as before.

This is an operational host-migration correction under the founder's covering implementation/release request, not a change to gameplay rules, account ownership or delegated authority. Use the existing guest handoff/sign-in to recover an existing kingdom before linking it. Creating another ChatGPT connection does not itself require another kingdom. The [official OpenAI authentication guidance](https://developers.openai.com/plugins/build/auth) confirms the supplied stable callback and resource-binding requirements; local route acceptance remains separate from an actual consumer-host installation.

## Verification

`npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (356 passed) and `npm run test:integration` (379 passed, one optional provider test skipped) passed on Node 24 with PostgreSQL 17. The build retains its existing large-bundle advisory. No paid provider or local model inference was invoked.

The four OAuth integration tests cover configured/disabled aliases, foreign and variant resources, wrong scope/audience/callback, no-store legacy redirect with preserved security parameters, canonical consent, no redirect for an unconfigured host, correct original-resource code/refresh, wrong-resource and bad-PKCE rejection, single-use codes, refresh replay family revocation, revoked access, human/agent separation and SSRF-safe client metadata. Historical PACT-016 acceptance/evidence is retained; this correction does not certify pending PACT-155/156 scheduled/external routes.

## Release evidence

Pre-release encrypted backup completed with `Result=success` and `ExecMainStatus=0`. Release `chatgpt-link-20261010-1` deployment and public verification are pending at this implementation commit. Record actual results after deployment; synthetic public consent checks do not prove a completed human ChatGPT callback/token exchange.

The original fifty-owner task remains stopped; no schedules, model calls, enrollments, identities or experimental budgets are changed. Finite historical experiments remain terminal. The original 24 Later tasks remain deferred.
