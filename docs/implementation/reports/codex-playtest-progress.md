# Codex external-agent Alpha playtest progress

Date: 26 September 2026. This is a PACT-017 MCP/OAuth compatibility repair and a PACT-048 Alpha setup increment, **not** completion of PACT-048 or PACT-079 external-host certification.

## Delivered locally

- The OAuth browser authorization page now accepts a dynamically registered MCP client with standard PKCE query fields, validates registered redirect/resource/audience/scopes before rendering, escapes the client identity, and displays the requested scopes. Native human-audience login remains supported.
- DCR advertises the public PKCE/no-client-secret token method. MCP 401 responses advertise the protected-resource metadata. Authorization-code exchange now rejects a different registered client ID before token issuance.
- The Envoy tab has a human-confirmed, bounded private playtest mandate preset and a way to disable new agent game actions. The server's existing mandate, resource exposure, human approval, stock, and write-lease checks remain authoritative.
- [Codex playtest operations](../../operations/codex-playtest.md) documents three account-bound OAuth profiles, a per-chat prompt, model choice, observation, and revoke procedure. No password or token is copied into repository documentation.
- The server now exposes `pact_game_action_v1` through authenticated MCP, deriving the actor from the OAuth account and MCP session. It uses the same command dispatcher and receipts as the web client. Normal tool denials return an MCP `isError` result without tearing down the session.
- Three separate synthetic kingdoms (Aster, Briar, Cinder) were provisioned on the single VPS and granted bounded authority. Their passwords remain in mode-0600 VPS test-secret files; Codex holds distinct OAuth grants, not passwords in prompts. The three Codex profiles use unique URL aliases to avoid sharing a rotating refresh credential.

## Evidence and current limits

`npm run lint`, `npm run typecheck`, `npm run build`, `npm test` (122 unit tests), and `npm run test:integration` (178 PostgreSQL tests) passed locally under Node 24 before the final MCP error-result increment. The final targeted integration invocation passed 42 tests across MCP and game-social suites, including actor binding, duplicate receipt handling, and session reuse after a tool denial. A first invocation under Node 20 failed at Vitest startup (`node:util.styleText`), then passed under the project's Node 24. These are local checks, not external-client certification.

Live Codex OAuth login succeeded for all three distinct accounts. In the first GPT-6 Luna moves, Aster committed Farm III (`b2db511b-ced2-4873-bc52-28e7510f6e18`) and Mine II (`a032c954-1dd4-4f4c-bbab-72875086f8b2`); Briar committed Farm II (`aa638694-9913-4f8f-b937-d9f5fabddf31`) and a contact request to Aster (`25140558-e40f-4c44-b9ec-d1321ee85ee1`); Cinder committed Farm II (`a8dc73b9-c621-4682-8a09-ff7a78d88859`). Aster's synthetic human owner accepted Briar's contact with receipt `1dad86c7-e8dc-43c4-a772-a9891336738f`. These were actual VPS receipts, not simulated tool text. Agent attempts to train troops returned `INSUFFICIENT_STOCK`, and attempted scouting without unit IDs was invalid. Early Codex chats also created several pending human-review proposals, which are **not** committed game actions.

This is a working autonomous single-turn opening, not yet a complete fun multiplayer session: no trade contract, direct negotiation, battle, or three-way contact has been observed. The agents reported that unexplained resource/prerequisite denials and approval/schema friction made strategy hard to judge. PACT-048's garrison/raid/loss/rebuild browser acceptance and PACT-079's real-host certification remain open. The Alpha interface has no public kingdom directory; a first contact needs a human answer. OAuth uses the specification's 15-minute access token and revocable 30-day refresh family, not a pasted one-hour bearer token.
