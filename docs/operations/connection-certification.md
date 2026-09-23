# MVP connection certification

Tickets: PACT-026 and PACT-086.

The private MVP uses deterministic, synthetic fixtures until eligible third-party client accounts, live provider keys, and consenting unfamiliar testers are available. Run the five-repetition harness with PostgreSQL available through the documented test environment:

```sh
npm run certify:connections
```

Each repetition covers normalized signup/verification/session behavior, OAuth and scope enforcement, both MCP protocol paths, sandbox reads/writes, exact-command approval and durable results, revoke/error paths, Telegram authentication, all five provider adapter contracts, and the public compatibility matrix. The final JSON reports each repetition and elapsed fixture time. It does not represent external account creation, email verification, provider latency, or a human five-minute usability result.

## Published route status

| Route | MVP evidence | Public claim | Deferred release evidence |
| --- | --- | --- | --- |
| OpenAI provider | Recorded Responses/tool fixture, invalid key/error/revoke contracts | Model adapter fixture available | Live test key and quota in PACT-079 |
| Anthropic provider | Recorded Messages/tool fixture | Model adapter fixture available | Live test key and quota in PACT-079 |
| Gemini provider | Recorded generateContent/tool fixture | Model adapter fixture available | Live auth key/quota in PACT-079 |
| xAI provider | Recorded chat-completions/tool fixture | Model adapter fixture available | Live xAI key/quota in PACT-079 |
| OpenRouter | Recorded manual-key and OAuth callback fixtures | Adapter/auth fixtures available | Live account, models, and billing path in PACT-079 |
| ChatGPT / Claude hosts | Shared OAuth/MCP fixture only | Not certified on this environment | Eligible host accounts, versions, and distribution checks in PACT-079 |
| Gemini CLI | Shared fixture; compatibility row `not_tested` | Not certified | Gemini CLI/version/account run in PACT-079 |
| Grok-powered external client | Provider fixture; compatibility row `fixture_only` | Consumer installation not verified | Eligible tool client and xAI account run in PACT-079 |
| Telegram test bot | Real test-bot Mini App/link/webhook evidence plus synthetic API fixtures | Private test bot supported | Production bot/distribution checks in PACT-079/PACT-095 |

## Human study boundary

Automated repetition protects determinism and catches regression; it cannot stand in for unfamiliar people. PACT-079 owns the deferred five-person-per-named-route study, including credential-ready timing, account/verification time, errors, plans, client versions, OS, and sanitized observation evidence. Until that study passes, no unavailable assistant host is advertised as universally installable or production-supported.
