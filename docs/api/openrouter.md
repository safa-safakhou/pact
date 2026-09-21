# OpenRouter authorization and adapter

`@pact/openrouter` owns the official OpenRouter PKCE authorization flow: session-bound state, exact callback URL validation, single-use claim, and a ten-minute expiry. The API exchanges the returned code for an API key outside the database transaction after the flow row is claimed.

Cookie-authenticated routes (Origin + CSRF required):

- `POST /v1/openrouter/authorize` — body `{ callbackUrl }`; returns `{ authorizeUrl, state, expiresAt }`.
- `POST /v1/openrouter/callback` — body `{ state, code, callbackUrl, label? }`; exchanges the code and, when the credential vault is configured, attaches the resulting key as an `openrouter` model connection.

Manual key entry continues through `POST /v1/model-connections` with `provider: "openrouter"`. Both paths produce the same vault credential shape.

`@pact/model-provider` owns `OpenRouterChatCompletionsAdapter`. Calls require an explicit routing disclosure; the request sets `provider.allow_fallbacks: false`. Undisclosed routing refuses the invoke. Tool calls, usage, and sanitized provider failures follow the shared adapter contract. Live OpenRouter account certification remains outside this ticket.
