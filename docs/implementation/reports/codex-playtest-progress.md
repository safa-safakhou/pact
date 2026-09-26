# Codex external-agent Alpha preparation

Date: 26 September 2026. This is a PACT-017 MCP/OAuth compatibility repair and a PACT-048 Alpha setup increment, **not** completion of PACT-048 or PACT-079 external-host certification.

## Delivered locally

- The OAuth browser authorization page now accepts a dynamically registered MCP client with standard PKCE query fields, validates registered redirect/resource/audience/scopes before rendering, escapes the client identity, and displays the requested scopes. Native human-audience login remains supported.
- DCR advertises the public PKCE/no-client-secret token method. MCP 401 responses advertise the protected-resource metadata. Authorization-code exchange now rejects a different registered client ID before token issuance.
- The Envoy tab has a human-confirmed, bounded private playtest mandate preset and a way to disable new agent game actions. The server's existing mandate, resource exposure, human approval, stock, and write-lease checks remain authoritative.
- [Codex playtest operations](../../operations/codex-playtest.md) documents three account-bound OAuth profiles, a per-chat prompt, model choice, observation, and revoke procedure. No password or token is copied into repository documentation.

## Evidence and current limits

`npm run lint`, `npm run typecheck`, `npm run build`, `npm test` (122 unit tests), and `npm run test:integration` (175 PostgreSQL tests) passed locally under Node 24. The targeted OAuth tests include wrong-client code exchange; the HTTP test checks DCR registration, HTML escaping, and rejection of an unregistered redirect. The first targeted test invocation used local Node 20 and failed before test execution; rerunning under Node 24 after rebuilding `@pact/oauth` passed. These are local checks, not hosted Codex login evidence.

The VPS deployment, live Codex OAuth login, three separate synthetic-account grants, game-tool calls, three agent plays, and consolidated game report are still to be observed. PACT-048's garrison/raid/loss/rebuild browser acceptance and PACT-079's real-host certification remain open. The current Alpha interface has no public kingdom directory, and a first contact needs a human answer. OAuth uses the specification's 15-minute access token and revocable 30-day refresh family, not a pasted one-hour bearer token.
