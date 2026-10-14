# Account and connection specification

**Version 1.3 · 11 October 2026 · Owner of identity, model credentials, MCP authorization, and onboarding.**

[Channels and reusable architecture](architecture.md) adds native human sessions, explicitly linked Telegram identities, and additional assistant certification routes. Email/password remains the canonical PACT account; a linked channel is not a new kingdom.

## Account and connection boundaries

| Connection | What it controls | What it never grants |
| --- | --- | --- |
| PACT account | Kingdom ownership, human approvals, settings, purchases, export/deletion | Access to a provider subscription |
| Model connection | PACT may call the selected model during a player-started run | Ownership of the PACT account or new game authority |
| Native / Telegram channel session | Access through a verified first-party app or explicitly linked Telegram identity | A new account, new quotas, or inferred ownership from a display name |
| MCP authorization | An external client may read or act for the specified kingdom within its scopes and mandate | The player's model keys, password, or permission to change authority |

Disconnecting a model does not delete a kingdom. Revoking one chatbot does not revoke another. Deleting the account revokes every session, channel link, MCP grant, and model connection. Neither connecting a provider nor installing a chatbot connector founds a kingdom automatically.

## Multiple accounts in one browser — founder extension, 11 October 2026

A browser may remember up to ten independently authenticated human accounts and select its active kingdom without signing the others out. Add each existing account by password/MFA or its private guest recovery code; a nickname is not proof of ownership. Browser memory uses host-bound Secure/HttpOnly/SameSite cookies for existing sessions, never passwords or human session tokens in JavaScript storage, URLs or MCP. Existing sessions keep their original authenticated time and seven-idle/30-absolute expiry; listing saved accounts does not refresh inactive sessions. Switching requires that saved session's valid CSRF and an allowed Origin and changes the browser's active account, not account ownership. Other open game tabs refresh; stale controls cannot write under the new account's CSRF. Expired, revoked, closed and unproven accounts are unavailable.

The account chooser names the selected kingdom during MCP OAuth linking, supports adding another existing account without a logout, and requires explicit final connection consent. The issued grant is bound to the selected authenticated account. Switching later never rebinds existing MCP grants, starts inference, merges kingdoms, shares quotas, changes mandates, or approves another account's exception. Forget removes this browser's saved login and revokes only that session; global sign-out/reset/closure retain their existing per-account behavior. Browser account memory is device-local; on another device, authenticate each desired account once using its existing credentials.

## Email/password account

Signup requires email, password, accepted terms/privacy version, and an 18+ declaration. The UI and support language are English; player messages may use any language. Store the age declaration, not a birth date or identity document.

Normalize email by trimming surrounding whitespace, normalizing the domain, and using case-insensitive comparison for the PACT login identifier. Do not strip plus tags or dots. Verify ownership with a single-use, random 256-bit token, valid for 24 hours and stored only as a hash. Reserve no public handle before verification. Delete unverified registrations after seven days. Signup/login/recovery responses do not disclose whether an email already has an account.

Passwords are 15–128 Unicode code points, maximum 1,024 UTF-8 bytes; allow paste, password managers, and spaces. Reject known compromised passwords without transmitting the password to a third party. No composition rules or scheduled password rotation. Store Argon2id hashes with a unique salt, 64 MiB memory, three iterations, and parallelism one. These settings exceed OWASP's published Argon2id minimum; benchmark server capacity without weakening the specified baseline. [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Use an opaque, random, server-stored session identifier in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie. Sessions expire after seven idle days or 30 absolute days. Rotate after authentication. Check CSRF tokens and allowed origins for cookie-authenticated writes. Password reset tokens last 15 minutes, are single-use, and revoke all web sessions and MCP grants when used; also stop running Envoys. Security settings show active connections and a **Sign out everywhere** control.

Recovery uses the verified email. Email changes require the current password, verification of the new address, and a notice to the old address. Re-authentication within five minutes is required for password/email changes, model-key replacement, deleting an account, exporting data, or raising game authority. Optional TOTP with one-use recovery codes is supported; staff accounts use MFA by default. The founder-authorized independent administrator surface uses the identity-owned password-only staff authentication policy specified in [administration](administration.md), with username/password sign-in and ordinary session expiry. Players cannot select a staff policy or role. Losing both email access and recovery credentials is not bypassed by an agent or an unverifiable support claim.

Initial abuse limits: five failed password checks per account per 15 minutes, 30 per IP per 15 minutes, and three verification/reset emails per address per hour. Throttle instead of permanently locking accounts. Apply additional IP limits at the edge without displaying account existence.

## Draft and activation

After verification, create one private kingdom draft and save a valid invitation destination. The draft contains the selected display name, proposed handle, portrait, and connection-test result. It has no military or economic identity and cannot be targeted. An unused draft expires after seven days; the verified account remains and can create another draft.

Activation requires the authenticated human, verified email, valid terms acceptance, and one successful model/MCP connection test in the preceding seven days. A serializable transaction claims the handle, creates exactly one kingdom, awards the founding allowances, fills action charges, and records activation time. Retries return the same kingdom. Reject conflicting handles with suggestions; never silently rename. Only then does gameplay time affect this player. Existing owners can keep playing manually if every model route later fails.

## Models inside PACT

All five adapters are required for Version 1. They share the same game tools, authority, state, and allowances. A player can save five connections and switch between runs; a running job pins one connection and one model identifier. Each adapter exposes available, tool-capable models rather than permanently naming a marketing flagship.

| Provider | Version 1 connection | API route / behavior |
| --- | --- | --- |
| OpenAI | User-supplied API key | Responses API; server-side bearer credential; model must support the required function calls |
| Anthropic | User-supplied API key; workspace identifier when required | Messages API; `anthropic-version: 2023-06-01`; provider-supported API authentication |
| Google Gemini | Current Gemini API auth key from AI Studio | Gemini `generateContent` with function calling; reject unsupported legacy credentials with provider instructions |
| xAI | User-supplied API key | xAI API with tool calls; bearer credential |
| OpenRouter | **Connect OpenRouter** authorization or manually supplied API key | OpenRouter API; explicit model selection and disclosed upstream routing policy |

OpenAI documents API keys as application credentials; Anthropic directs third-party applications to its API credentials or supported cloud routes. PACT therefore does not accept a ChatGPT/Claude session cookie, scraped login token, or subscription login as an unofficial API key. [OpenAI API authentication](https://developers.openai.com/api/reference/overview), [Anthropic authentication](https://platform.claude.com/docs/en/manage-claude/authentication), [Claude third-party access policy](https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account).

Google's current key guidance includes migration to auth keys. The connection screen must follow that credential type and validate a real call instead of assuming every older key remains usable. xAI is an API model connection; this specification does not claim the Grok consumer chat product accepts arbitrary MCP servers. [Gemini API keys](https://ai.google.dev/gemini-api/docs/api-key), [xAI quickstart](https://docs.x.ai/developers/quickstart).

OpenRouter's documented PKCE flow opens its authorization page with a callback and S256 challenge, then exchanges the returned code plus verifier at `/api/v1/auth/keys`. The resulting credential is an API key. Bind the single-use callback to the authenticated PACT session with an unpredictable state value in the registered callback URL, expire the flow after ten minutes, and keep the verifier server-side. Do not implement refresh-token behavior that this key exchange does not provide. [OpenRouter authorization](https://openrouter.ai/docs/guides/overview/auth/oauth).

Provider keys travel over TLS directly into the PACT backend, are envelope-encrypted with AES-256-GCM, and are never returned by reads or tools. Each credential uses a fresh data-encryption key that is sealed through an injected wrapping-key port. The single-VPS adapter exposes public wrapping material to the API but mounts private unwrapping material only into the inference worker; VPS root remains a trusted operator. Wrapped records carry a key identifier so rotation can retain or rewrap older ciphertext deliberately. The interface displays a label and last four characters. Keys, authorization codes, and bearer tokens are redacted from logs and excluded from prompts. Provider errors are sanitized. Key deletion blocks new calls immediately; already submitted provider requests may complete.

Before the first run, display the recipient provider, chosen model, token allowance, and a cost estimate when current pricing is available. If pricing is unavailable, show **Provider price unavailable** and require a token-bounded run confirmation. Never present zero as an unknown cost. OpenRouter's upstream routing choices are disclosed; no silent cross-provider fallback is allowed. A failed provider pauses the run rather than switching credentials or billing destinations.

## ChatGPT, Claude, and other MCP clients

PACT exposes one authenticated remote endpoint: `{PACT_ORIGIN}/mcp`, using Streamable HTTP. Support MCP **2025-11-25**, plus a tested **2025-06-18** compatibility path selected during initialization. Unknown versions fail explicitly. Use typed JSON schemas, structured tool results, pagination, and resumable event cursors. GET may stream notifications; POST processes JSON-RPC calls. Origin validation, authorization, and session isolation apply to every transport connection. [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

PACT is the OAuth resource and authorization service for this connection. Use authorization code with PKCE S256, exact redirect matching, protected-resource metadata, authorization-server metadata, resource indicators, and tokens restricted to the MCP audience. Support preregistered clients, verified HTTPS client-ID metadata documents, and dynamic registration for compatible clients. Metadata fetches reject private network destinations, redirects to them, oversized documents, and excessive recursion. Never forward a client's access token to a model provider. These requirements follow the pinned MCP authorization specification; provider login and PACT OAuth remain separate. [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).

Access tokens expire in 15 minutes. Rotating refresh grants expire after 30 days, with reuse detection revoking the token family. A PACT password reset, client revocation, or account suspension invalidates relevant grants immediately. Scopes are `world:read`, `messages:write`, and `game:act`. A player can grant read-only access. None of these scopes permits human approval, credential reads, authority increases, checkout, or account deletion.

Connecting shows the app identity, selected kingdom, requested scopes, and a link to the current mandate. The chatbot may then read a briefing, negotiate, and submit permitted game actions. It cannot authenticate a human approval by writing “the player agreed.” External hosts may impose their own tool-confirmation steps; those do not replace PACT's checks.

ChatGPT, Claude, and Gemini CLI each receive a dedicated connection guide and a shared certification fixture. A Grok-powered external tool client uses the same fixture. The private synthetic MVP may publish recorded fixture results while labeling unavailable hosts `not_tested` or `fixture_only`; this does not certify or advertise those consumer applications. Actual host/account certification, the unfamiliar-user setup study, and distribution review are deferred to PACT-079 at the release stage. A client is labeled production-supported only after the full signup → OAuth → read → authorized write → approval-link → revoke flow passes in that real host. [Connect from ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt), [ChatGPT distribution](https://developers.openai.com/plugins/deploy/submission), [Claude remote connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

Other standards-compatible MCP clients use the same published endpoint and setup contract. They can be added to the certification matrix without a new gameplay implementation. When a particular consumer chatbot has no supported connector route, its model remains usable through PACT's API adapters where available; the interface explains that distinction.
