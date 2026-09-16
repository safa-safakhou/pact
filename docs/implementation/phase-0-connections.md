# Phase 0 — Connection experiment

**32 tickets · 0 completed.** [Backlog overview](README.md) · [Machine-readable tickets](tasks.json)

Dependencies are completion requirements. Later phases also depend on the preceding gate. Owner roles are disciplines, not assigned people. Size is complexity, not a time commitment.

<a id="pact-001"></a>
## PACT-001 — Bootstrap the application workspace and continuous integration

**Status:** todo · **Role:** Platform · **Size:** M · **Type:** implementation

**Depends on:** None — start here.

**Components:** workspace, CI, local environment.

**Specification:** [runtime](../pact/runtime.md), [architecture](../pact/architecture.md) · **Release checks:** A01

**Implement / deliver**

- Create a Node 24 / TypeScript workspace with React web, Fastify API, and separate rules, inference, and notification worker entry points; lock dependencies.
- Add PostgreSQL 17 local services, environment validation, migration commands, lint/typecheck/build jobs, and a test database per suite.
- Scaffold platform/domain/transport package boundaries for web, native, and Telegram; do not implement a separate game backend per surface.

**Acceptance**

- [ ] A fresh checkout starts the web/API/database using the documented commands without real provider credentials.
- [ ] CI builds every process and runs migrations plus a minimal API/database smoke test; no secrets or real user data are committed.

<a id="pact-082"></a>
## PACT-082 — Establish reusable package boundaries and product isolation

**Status:** todo · **Role:** Architecture · **Size:** M · **Type:** implementation

**Depends on:** [PACT-001](phase-0-connections.md#pact-001)

**Components:** workspace packages, domain ports, CI boundaries.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md) · **Release checks:** A09

**Implement / deliver**

- Define explicit platform/domain/transport package exports, ownership/migration boundaries, scoped principal/event types, and transaction interfaces.
- Configure CI import/dependency rules, contract versioning, injected infrastructure ports, and a single composition root; do not split every module into a network service.

**Acceptance**

- [ ] A forbidden platform-to-PACT import fails CI; packages expose only declared interfaces and carry explicit product scope.
- [ ] Document and fixture-test the atomic unit of work spanning domain stock and authorization reservations; notification delivery remains an outbox effect.

<a id="pact-002"></a>
## PACT-002 — Define shared command, event, and tool schemas

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-001](phase-0-connections.md#pact-001), [PACT-082](phase-0-connections.md#pact-082)

**Components:** shared contracts.

**Specification:** [runtime](../pact/runtime.md), [access](../pact/access.md) · **Release checks:** A03, A05

**Implement / deliver**

- Create versioned typed schemas for actor context, command envelope, receipt/error codes, events, cursors, model tool calls, and sandbox actions.
- Generate JSON Schema for MCP and an HTTP API contract from the same definitions; define monetary units and serialization bounds explicitly.

**Acceptance**

- [ ] Web, MCP, and provider tool validators accept the same valid command fixture and reject the same malformed payload.
- [ ] Schemas cannot accept arbitrary code, actor impersonation, unrestricted database queries, credential reads, or human-only account operations as game tools.

<a id="pact-003"></a>
## PACT-003 — Create account persistence and transaction/outbox infrastructure

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-001](phase-0-connections.md#pact-001), [PACT-002](phase-0-connections.md#pact-002)

**Components:** persistence, job/outbox infrastructure.

**Specification:** [runtime](../pact/runtime.md), [access](../pact/access.md), [privacy](../pact/privacy.md) · **Release checks:** A01, A06

**Implement / deliver**

- Add migrations for accounts, drafts, sessions, connection records, command receipts, durable jobs, inbox events, and outbox rows; add unique constraints and foreign keys.
- Implement a transaction boundary with stable lock ordering and bounded retries, plus job leases and idempotent outbox consumers. Domain tables arrive with their feature tickets.

**Acceptance**

- [ ] Two workers cannot hold the same live job lease; an abandoned lease can be recovered.
- [ ] Transaction rollback writes neither a receipt nor an outbox event; successful commit survives worker restart and duplicate delivery.

<a id="pact-004"></a>
## PACT-004 — Provision the isolated connection-test environment

**Status:** todo · **Role:** Platform · **Size:** L · **Type:** implementation

**Depends on:** [PACT-001](phase-0-connections.md#pact-001), [PACT-003](phase-0-connections.md#pact-003)

**Components:** infrastructure, deployment.

**Specification:** [runtime](../pact/runtime.md), [privacy](../pact/privacy.md) · **Release checks:** A06

**Implement / deliver**

- Define AWS Frankfurt infrastructure as code for isolated test ECS services, RDS PostgreSQL, private S3, KMS, SES, TLS, and secret injection; use separate environment identities.
- Configure 35-day backup lifecycle, least-privilege process roles, deployment/rollback commands, and outbound-provider access. Synthetic identities only until PACT-025 passes.

**Acceptance**

- [ ] Deploy and restore a synthetic account database in the test environment; deleted/revoked-record replay hooks are available for PACT-024.
- [ ] Inference credentials are inaccessible to the web bundle and unrelated worker roles; no private API response is CDN-cached.

**External prerequisites:** AWS test account, deployment domain, verified sender identity.

<a id="pact-005"></a>
## PACT-005 — Add redacted operational telemetry and failure correlation

**Status:** todo · **Role:** Platform · **Size:** M · **Type:** implementation

**Depends on:** [PACT-002](phase-0-connections.md#pact-002), [PACT-003](phase-0-connections.md#pact-003)

**Components:** observability.

**Specification:** [runtime](../pact/runtime.md), [privacy](../pact/privacy.md) · **Release checks:** A06

**Implement / deliver**

- Add structured request/command/run/job IDs, health probes, metrics for queue lag and provider errors, and sanitized error reporting.
- Apply credential, authorization-header, email, prompt, and message-body redaction; configure security/IP retention classes.

**Acceptance**

- [ ] Seed secrets and private text into failed requests and confirm none appear in application logs or client error payloads.
- [ ] A failed command can be traced through API, transaction, outbox, and worker using IDs without transcript logging.

<a id="pact-006"></a>
## PACT-006 — Implement signup, verification, and human sessions

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-003](phase-0-connections.md#pact-003), [PACT-005](phase-0-connections.md#pact-005)

**Components:** identity, email.

**Specification:** [access](../pact/access.md), [privacy](../pact/privacy.md) · **Release checks:** A01

**Implement / deliver**

- Implement email normalization, 18+ and terms-version acceptance, compromised-password checks, Argon2id settings, verification tokens, and session cookies exactly as specified.
- Add CSRF/origin checks, login and email throttles, generic account-existence responses, idle/absolute expiry, and transactional security email.

**Acceptance**

- [ ] Duplicate concurrent signup/verification cannot create two accounts or reuse an expired token.
- [ ] Password and session expiry, CSRF, cross-account access, throttling, and email enumeration fixtures pass.

<a id="pact-007"></a>
## PACT-007 — Implement recovery, reauthentication, and account security

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-006](phase-0-connections.md#pact-006)

**Components:** identity, access revocation.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A01, A05

**Implement / deliver**

- Implement password reset, verified email changes, five-minute recent-auth checks, optional TOTP/recovery codes, and staff MFA.
- Add a revocation service and session/connection inventory; password reset and sign-out-everywhere revoke applicable access and signal active-run cancellation.

**Acceptance**

- [ ] A reset token is single-use and expires after 15 minutes; resetting revokes old cookies and OAuth grants.
- [ ] An Envoy cannot raise authority, replace a credential, export, delete, or approve using a game token; TOTP recovery codes cannot be reused.

<a id="pact-008"></a>
## PACT-008 — Implement private kingdom drafts and resumable setup

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-006](phase-0-connections.md#pact-006), [PACT-002](phase-0-connections.md#pact-002)

**Components:** onboarding, drafts.

**Specification:** [access](../pact/access.md), [social](../pact/social.md) · **Release checks:** A01

**Implement / deliver**

- Persist draft name, proposed handle, portrait, connection-check timestamp, and typed invitation destination; purge unused drafts after seven days.
- Add a sandbox-only activation fixture with exactly-once acceptance; real founding is PACT-031 and cannot be invoked in the connection experiment.

**Acceptance**

- [ ] A draft has no stocks, troops, score, or targetable public kingdom identity.
- [ ] OAuth redirect, logout/recovery, and repeated setup submissions preserve the same permitted destination; stale checks and unverified accounts fail activation validation.

<a id="pact-009"></a>
## PACT-009 — Build encrypted model credential storage

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-004](phase-0-connections.md#pact-004), [PACT-007](phase-0-connections.md#pact-007)

**Components:** credential vault.

**Specification:** [access](../pact/access.md), [privacy](../pact/privacy.md) · **Release checks:** A02, A06

**Implement / deliver**

- Implement save/replace/revoke for five saved model connections with AES-256-GCM envelope encryption and KMS wrapping.
- Restrict decryption to the inference worker, show only labels/suffixes, and remove live encrypted keys within 24 hours of revocation.

**Acceptance**

- [ ] Key substitution across accounts fails and no key is returned by read/MCP endpoints or included in prompts.
- [ ] Revocation immediately prevents a new call; a credential already submitted to a provider is reported truthfully rather than claimed recalled.

<a id="pact-010"></a>
## PACT-010 — Build the provider adapter interface and contract harness

**Status:** todo · **Role:** Integrations · **Size:** M · **Type:** implementation

**Depends on:** [PACT-002](phase-0-connections.md#pact-002), [PACT-009](phase-0-connections.md#pact-009)

**Components:** provider interface, provider test harness.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A02

**Implement / deliver**

- Define model discovery/capabilities, structured tool calls/results, token accounting, cancellation, sanitized errors, and optional pricing metadata.
- Build a deterministic fake provider for CI and adapter fixtures for unknown pricing, absent usage, malformed tools, timeout, and quota exhaustion.

**Acceptance**

- [ ] A route can be swapped without changing command schemas or kingdom identity.
- [ ] Unsupported models are rejected before a run; missing price is never rendered as zero; failure never silently switches provider or credential.

<a id="pact-011"></a>
## PACT-011 — Implement the OpenAI model adapter

**Status:** todo · **Role:** Integrations · **Size:** M · **Type:** implementation

**Depends on:** [PACT-010](phase-0-connections.md#pact-010)

**Components:** OpenAI adapter.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A02

**Implement / deliver**

- Implement the specified Responses API route, server-side credentials, tool-call continuation, selected model validation, and usage mapping.
- Add provider-backed smoke evidence using an operator test key alongside recorded/sanitized fixtures.

**Acceptance**

- [ ] A real supported model reads the draft, proposes a valid sandbox write, and consumes its tool receipt in a final response.
- [ ] Invalid key, tool error, cancellation, unavailable model, and quota failure produce the shared adapter result without leaking credentials.

**External prerequisites:** Operator-provided test API key and quota.

<a id="pact-012"></a>
## PACT-012 — Implement the Anthropic model adapter

**Status:** todo · **Role:** Integrations · **Size:** M · **Type:** implementation

**Depends on:** [PACT-010](phase-0-connections.md#pact-010)

**Components:** Anthropic adapter.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A02

**Implement / deliver**

- Implement Messages API with the pinned API version, supported authentication/workspace fields, tool-result continuation, and usage mapping.
- Keep subscription login separate from API credentials and record the successful model identifier.

**Acceptance**

- [ ] A real supported model completes the same draft-read/sandbox-write/tool-result fixture as other adapters.
- [ ] Required workspace errors, malformed tools, quota failure, and cancellation map to shared results without starting a fallback route.

**External prerequisites:** Operator-provided test API key/workspace and quota.

<a id="pact-013"></a>
## PACT-013 — Implement the Gemini model adapter

**Status:** todo · **Role:** Integrations · **Size:** M · **Type:** implementation

**Depends on:** [PACT-010](phase-0-connections.md#pact-010)

**Components:** Gemini adapter.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A02

**Implement / deliver**

- Implement the specified Gemini auth-key route, function calls/results, capability checks, and provider-specific context/usage handling.
- Validate a real supported credential instead of accepting legacy-key syntax as proof of working access.

**Acceptance**

- [ ] A real tool-capable model completes the common connection fixture.
- [ ] Unsupported credentials/models, blocked responses, missing usage, and provider throttles stop or report correctly without fabricated game success.

**External prerequisites:** Operator-provided Gemini auth key and quota.

<a id="pact-014"></a>
## PACT-014 — Implement the xAI model adapter

**Status:** todo · **Role:** Integrations · **Size:** M · **Type:** implementation

**Depends on:** [PACT-010](phase-0-connections.md#pact-010)

**Components:** xAI adapter.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A02

**Implement / deliver**

- Implement the specified API bearer-key route, tool-call continuation, model selection, and usage/error conversion.
- Label this as xAI model access in PACT; do not present it as an unverified Grok consumer-chat MCP integration.

**Acceptance**

- [ ] A real supported model passes the common connection fixture.
- [ ] Invalid key, model mismatch, repeated tool-call IDs, and provider timeouts cannot cause duplicate sandbox actions.

**External prerequisites:** Operator-provided test API key and quota.

<a id="pact-015"></a>
## PACT-015 — Implement OpenRouter authorization and model adapter

**Status:** todo · **Role:** Integrations · **Size:** L · **Type:** implementation

**Depends on:** [PACT-010](phase-0-connections.md#pact-010), [PACT-007](phase-0-connections.md#pact-007)

**Components:** OpenRouter adapter, authorization callback.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A02

**Implement / deliver**

- Implement manual-key entry and the official PKCE authorization/code-to-key exchange with session-bound state, exact callback validation, single use, and ten-minute expiry.
- Implement explicit model/upstream routing disclosure, tool results, usage accounting, and provider-failure handling.

**Acceptance**

- [ ] Both key entry and authorization complete the common real-provider fixture.
- [ ] Swapped state/verifier, replayed callback, expired flow, or an undisclosed routing fallback cannot attach a credential or run a model.

**External prerequisites:** OpenRouter test account/key and quota.

<a id="pact-016"></a>
## PACT-016 — Implement PACT OAuth for external clients

**Status:** todo · **Role:** Security · **Size:** L · **Type:** implementation

**Depends on:** [PACT-007](phase-0-connections.md#pact-007), [PACT-002](phase-0-connections.md#pact-002)

**Components:** OAuth authorization/resource service.

**Specification:** [access](../pact/access.md), [architecture](../pact/architecture.md) · **Release checks:** A03, A05

**Implement / deliver**

- Implement the authorization-code/PKCE flow, resource and authorization metadata, audience-bound scopes, refresh rotation, revocation, and exact redirect checks.
- Support preregistration, validated client-ID metadata, and dynamic registration; protect metadata fetches against SSRF. Use reviewed OAuth primitives rather than inventing cryptographic protocols.
- Separate first-party native human client registrations/audiences from MCP agent grants; authorization-code primitives are reusable but human permissions cannot be delegated to agent tokens.

**Acceptance**

- [ ] Wrong audience/scope, refresh replay, revoked access, redirect mismatch, and private-network metadata requests fail.
- [ ] Consent names the client and draft/kingdom; OAuth tokens cannot read provider keys or authorize human-only operations.

<a id="pact-017"></a>
## PACT-017 — Implement the remote MCP transport and tool registry

**Status:** todo · **Role:** Integrations · **Size:** L · **Type:** implementation

**Depends on:** [PACT-016](phase-0-connections.md#pact-016), [PACT-002](phase-0-connections.md#pact-002)

**Components:** MCP transport.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A03

**Implement / deliver**

- Expose the single Streamable HTTP endpoint with the two pinned protocol versions, initialization, typed tool listing, structured results, bounded reads, and origin checks.
- Bind every tool invocation to the authenticated actor; use an injectable command dispatcher until PACT-018 is connected.

**Acceptance**

- [ ] Protocol fixtures pass for initialization, supported/unsupported versions, POST results, GET stream behavior, and isolated client sessions.
- [ ] Listing or invoking a tool never grants broader scope; another account cannot resume or read a private stream.

<a id="pact-018"></a>
## PACT-018 — Implement the shared dispatcher and sandbox receipts

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-003](phase-0-connections.md#pact-003), [PACT-007](phase-0-connections.md#pact-007), [PACT-002](phase-0-connections.md#pact-002)

**Components:** command gateway, receipts.

**Specification:** [runtime](../pact/runtime.md) · **Release checks:** A03, A05

**Implement / deliver**

- Build one command gateway with authenticated actor derivation, payload/version checks, idempotency keys, receipts, and transactional outbox.
- Add harmless private-draft read/write fixtures under a sandbox-only namespace; defer economic handlers to phase 1.

**Acceptance**

- [ ] Same ID and payload produce one mutation and the original receipt; changed payload with reused ID returns conflict.
- [ ] A timed-out write can be reconciled through receipt lookup without re-execution or exposing another account’s result.

<a id="pact-019"></a>
## PACT-019 — Implement mandate permissions and immediate-spend checks

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-018](phase-0-connections.md#pact-018)

**Components:** authority service.

**Specification:** [runtime](../pact/runtime.md) · **Release checks:** A05

**Implement / deliver**

- Persist human-editable versioned mandates and implement action/target restrictions, session/troop ceilings, reserve floors, and default deny/approval rules.
- Add the immediate authorization ledger interface using synthetic amounts; full future-commitment integration is PACT-039.

**Acceptance**

- [ ] Agents cannot mutate their mandate or obtain human-only permissions by changing payload text.
- [ ] Two sandbox requests sharing an allowance cannot both spend it; raising authority requires recent human authentication and increments its version.

<a id="pact-020"></a>
## PACT-020 — Implement exact-command human approvals

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-019](phase-0-connections.md#pact-019)

**Components:** approval service.

**Specification:** [runtime](../pact/runtime.md), [access](../pact/access.md) · **Release checks:** A05

**Implement / deliver**

- Store immutable approval requests, command hashes, current-state preconditions, minimum expiry deadlines, and one-use human permits.
- Implement authenticated approval/reject POSTs, status reads, and deep links that expose no bearer approval secret.

**Acceptance**

- [ ] GET, chatbot text, or a host tool confirmation cannot approve; changed/expired terms fail.
- [ ] Double approval commits once; a successful approval can be read after the original chatbot disconnects.

<a id="pact-021"></a>
## PACT-021 — Implement bounded Envoy runs and exclusive write leases

**Status:** todo · **Role:** Backend · **Size:** L · **Type:** implementation

**Depends on:** [PACT-010](phase-0-connections.md#pact-010), [PACT-018](phase-0-connections.md#pact-018), [PACT-019](phase-0-connections.md#pact-019), [PACT-020](phase-0-connections.md#pact-020)

**Components:** run service, inference worker.

**Specification:** [runtime](../pact/runtime.md) · **Release checks:** A04, A05

**Implement / deliver**

- Implement PACT run start/stop/wait/resume, durable worker jobs, one write lease and one in-flight request per kingdom, pinned connection/model, and token/call/message/deadline reservations.
- Implement MCP lease acquisition without provider inference; takeovers and revocation prevent new commands while preserving already-committed jobs.

**Acceptance**

- [ ] A fake-provider run stops at each limit, preserves allowance on resume, and cannot be extended by repeated callbacks.
- [ ] Close the browser during a real run and observe bounded completion; inject an inbox event while idle and observe zero model calls. Ambiguous provider-call crashes are surfaced without an unbounded retry/billing loop.

<a id="pact-022"></a>
## PACT-022 — Implement the durable inbox and live event delivery

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-003](phase-0-connections.md#pact-003), [PACT-018](phase-0-connections.md#pact-018)

**Components:** inbox service, SSE.

**Specification:** [runtime](../pact/runtime.md), [privacy](../pact/privacy.md) · **Release checks:** A03, A04

**Implement / deliver**

- Persist audience-filtered events with cursor pagination, acknowledgement, deduplication, and app SSE delivery.
- Add event subscriptions for approvals, run state, and security notices; define resync behavior when a cursor predates retained events.

**Acceptance**

- [ ] Disconnect/reconnect returns ordered authorized events without duplicate user-visible cards.
- [ ] Notification/outbox workers never invoke the provider adapter; omitted or unavailable delivery cannot change an action receipt.

<a id="pact-023"></a>
## PACT-023 — Build account, connection, and Envoy setup screens

**Status:** todo · **Role:** Frontend · **Size:** L · **Type:** implementation

**Depends on:** [PACT-008](phase-0-connections.md#pact-008), [PACT-009](phase-0-connections.md#pact-009), [PACT-015](phase-0-connections.md#pact-015), [PACT-016](phase-0-connections.md#pact-016), [PACT-017](phase-0-connections.md#pact-017), [PACT-020](phase-0-connections.md#pact-020), [PACT-021](phase-0-connections.md#pact-021), [PACT-022](phase-0-connections.md#pact-022)

**Components:** account and Envoy UI.

**Specification:** [product](../pact/product.md), [access](../pact/access.md), [runtime](../pact/runtime.md), [architecture](../pact/architecture.md) · **Release checks:** A01, A02, A03, A04, A05

**Implement / deliver**

- Build English responsive signup/security, draft, provider selection, credentials, model choice, allowance confirmation, run controls, and approval-inbox screens.
- Preserve the invitation destination; show truthful Working/Waiting/Stopped states, unknown pricing, external-host usage, and connector prerequisites. Wire MCP tools to the same dispatcher/run services.
- Separate reusable DOM feature components from the web host shell so Telegram can reuse them; expose platform-independent view models for native screens.

**Acceptance**

- [ ] Complete setup and a sandbox approval on phone and desktop using keyboard as well as touch.
- [ ] Closing/reopening the page shows server state; expired approval, revoked key, and unsupported host produce actionable messages without founding a live kingdom.

<a id="pact-083"></a>
## PACT-083 — Build the shared client SDK and capability contract

**Status:** todo · **Role:** Backend / Frontend · **Size:** M · **Type:** implementation

**Depends on:** [PACT-002](phase-0-connections.md#pact-002), [PACT-016](phase-0-connections.md#pact-016), [PACT-018](phase-0-connections.md#pact-018), [PACT-020](phase-0-connections.md#pact-020), [PACT-022](phase-0-connections.md#pact-022), [PACT-082](phase-0-connections.md#pact-082)

**Components:** TypeScript SDK, generated types, capability metadata.

**Specification:** [architecture](../pact/architecture.md), [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A08, A09

**Implement / deliver**

- Generate reusable HTTP/tool client types, command IDs, receipt reconciliation, authenticated read projections, cursor subscriptions, error mapping, and platform-independent view models.
- Publish API/schema versions and capabilities with graceful unsupported-version behavior; separate human and agent audiences in the SDK.

**Acceptance**

- [ ] A web and non-browser test client issue the same sandbox command and observe the same receipt after a timeout/retry.
- [ ] SDK imports no DOM/React Native/Telegram globals; no client retry silently changes an idempotency key or acquires human scopes.

<a id="pact-084"></a>
## PACT-084 — Prove native iOS and Android login, linking, and approval

**Status:** todo · **Role:** Mobile · **Size:** L · **Type:** implementation

**Depends on:** [PACT-007](phase-0-connections.md#pact-007), [PACT-023](phase-0-connections.md#pact-023), [PACT-083](phase-0-connections.md#pact-083)

**Components:** React Native Expo shell, native identity, secure storage.

**Specification:** [architecture](../pact/architecture.md), [access](../pact/access.md), [privacy](../pact/privacy.md) · **Release checks:** A08

**Implement / deliver**

- Create one native application with iOS/Android development builds, system-browser PACT PKCE login, verified app links, secure refresh storage, and in-memory access tokens.
- Complete private-draft read, sandbox command, exact human approval, reconnect, and revoke on both platforms; full gameplay comes in PACT-087.

**Acceptance**

- [ ] A malicious callback, wrong audience, stale approval, duplicate tap, and revoked session fail or return the original receipt correctly.
- [ ] Credentials do not appear in app preferences/logs/backups; backgrounding/reopening shows server state without a new run.

**External prerequisites:** iOS/Android build environment and test devices; platform signing for device builds.

<a id="pact-085"></a>
## PACT-085 — Prove Telegram identity linking and Mini App authentication

**Status:** todo · **Role:** Integrations · **Size:** L · **Type:** implementation

**Depends on:** [PACT-007](phase-0-connections.md#pact-007), [PACT-023](phase-0-connections.md#pact-023), [PACT-083](phase-0-connections.md#pact-083)

**Components:** Telegram adapter, Mini App shell, linking sessions.

**Specification:** [architecture](../pact/architecture.md), [access](../pact/access.md), [privacy](../pact/privacy.md) · **Release checks:** A08

**Implement / deliver**

- Create the test bot/Mini App shell; implement validated bot-bound initData, five-minute age check, single-use bootstrap exchange, webhook secret/update deduplication, and linked PACT account confirmation.
- Add sandbox read/write and human approval in the authenticated Mini App, unlink/revoke, and denied group-chat control paths.

**Acceptance**

- [ ] Forged/stale/replayed launch data, changed usernames, forwarded callbacks, and swapped PACT sessions cannot link or operate another account.
- [ ] Unlink immediately revokes channel sessions; no game privilege is inferred from a Telegram handle or message text.

**External prerequisites:** Operator-owned Telegram bot token and HTTPS test endpoint.

<a id="pact-024"></a>
## PACT-024 — Implement first-account retention, export, and deletion

**Status:** todo · **Role:** Security · **Size:** L · **Type:** implementation

**Depends on:** [PACT-004](phase-0-connections.md#pact-004), [PACT-008](phase-0-connections.md#pact-008), [PACT-009](phase-0-connections.md#pact-009), [PACT-016](phase-0-connections.md#pact-016), [PACT-021](phase-0-connections.md#pact-021), [PACT-022](phase-0-connections.md#pact-022), [PACT-084](phase-0-connections.md#pact-084), [PACT-085](phase-0-connections.md#pact-085)

**Components:** privacy jobs, export, deletion registry.

**Specification:** [privacy](../pact/privacy.md), [access](../pact/access.md), [architecture](../pact/architecture.md) · **Release checks:** A06

**Implement / deliver**

- Implement account/draft/key/session/run/inbox retention jobs, JSON export with readable index and authenticated download, legal-hold metadata, and deletion/revocation registry.
- Add purge/restore replay for phase-0 data and a privacy Settings screen; gameplay retirement and social data are added in later tickets.
- Include native and Telegram sandbox-session/link cleanup and backup suppression before recruiting real connection testers.

**Acceptance**

- [ ] Export excludes credentials and other players’ data; delete disables access immediately and meets specified live-store deadlines.
- [ ] Restore a pre-deletion backup and replay the deletion/revocation registry before traffic; removed credentials and content cannot reappear.

<a id="pact-025"></a>
## PACT-025 — Complete the real-account environment preflight

**Status:** todo · **Role:** Operations · **Size:** M · **Type:** operations

**Depends on:** [PACT-004](phase-0-connections.md#pact-004), [PACT-005](phase-0-connections.md#pact-005), [PACT-006](phase-0-connections.md#pact-006), [PACT-007](phase-0-connections.md#pact-007), [PACT-024](phase-0-connections.md#pact-024)

**Components:** operator configuration, policies.

**Specification:** [privacy](../pact/privacy.md), [access](../pact/access.md), [architecture](../pact/architecture.md) · **Release checks:** A06

**Implement / deliver**

- Populate actual controller/support identity, terms/privacy versions, processor disclosures, provider agreements/transfer records, and transactional email sender configuration.
- Keep registration disabled when required values are missing; use synthetic data for all earlier development and restore tests. Record privacy/support ownership for connection testers.
- Include Telegram and device-session data flows in actual operator notices before cross-channel testers register.

**Acceptance**

- [ ] A deployment with an empty required legal/operator field cannot accept a real signup.
- [ ] The configured notices, email delivery, privacy-request channel, staff MFA, and restore/deletion checks are demonstrated before inviting a tester.

**External prerequisites:** Actual operator identity and processor agreements.

<a id="pact-086"></a>
## PACT-086 — Certify additional assistant routes and publish a capability matrix

**Status:** todo · **Role:** Integrations · **Size:** M · **Type:** verification

**Depends on:** [PACT-017](phase-0-connections.md#pact-017), [PACT-023](phase-0-connections.md#pact-023), [PACT-025](phase-0-connections.md#pact-025), [PACT-083](phase-0-connections.md#pact-083)

**Components:** Gemini CLI certification, Grok tool-client fixture, compatibility registry.

**Specification:** [architecture](../pact/architecture.md), [access](../pact/access.md), [delivery](../pact/delivery.md) · **Release checks:** A03, A09

**Implement / deliver**

- Run the authenticated MCP read/action/approval/revoke fixture in Gemini CLI and a Grok-powered external tool client using the standard adapter/SDK.
- Record supported model APIs separately from consumer chatbot installation, OAuth eligibility/billing, tool capabilities, client versions, and readable versus writable surfaces.

**Acceptance**

- [ ] Named supported routes have real fixture evidence; unsupported consumer-app connections are not advertised as working.
- [ ] The Grok/Gemini routes share PACT receipts and authority, use scoped game credentials, and never treat subscription login as an unverified hosted API credential.

**External prerequisites:** Eligible Gemini client and xAI test access/quota.

<a id="pact-026"></a>
## PACT-026 — Certify every connection route and measure unaided setup

**Status:** todo · **Role:** QA · **Size:** L · **Type:** verification

**Depends on:** [PACT-011](phase-0-connections.md#pact-011), [PACT-012](phase-0-connections.md#pact-012), [PACT-013](phase-0-connections.md#pact-013), [PACT-014](phase-0-connections.md#pact-014), [PACT-015](phase-0-connections.md#pact-015), [PACT-017](phase-0-connections.md#pact-017), [PACT-023](phase-0-connections.md#pact-023), [PACT-024](phase-0-connections.md#pact-024), [PACT-025](phase-0-connections.md#pact-025), [PACT-084](phase-0-connections.md#pact-084), [PACT-085](phase-0-connections.md#pact-085), [PACT-086](phase-0-connections.md#pact-086)

**Components:** connection certification, setup guides.

**Specification:** [access](../pact/access.md), [delivery](../pact/delivery.md), [architecture](../pact/architecture.md) · **Release checks:** A01, A02, A03, A04, A05, A06, A07, A08, A09

**Implement / deliver**

- Run the full signup/OAuth/read/write/approval/revoke fixture in ChatGPT, Claude, and Gemini CLI and real-key runs through all five PACT adapters.
- Publish tested host/model/protocol/date requirements; test five unfamiliar people per named route and record credential-ready timing, errors, usage, and a sanitized evidence link.
- Include Gemini CLI certification and native/Telegram sandbox setup evidence from the dedicated new tickets.

**Acceptance**

- [ ] Each route reaches at least four of five successful unaided sandbox outcomes within five minutes after credentials/host eligibility; verification time is reported separately.
- [ ] Every required route has evidence for expiry, revocation, browser/host closure, and approval; unavailable distribution is recorded accurately and cannot be claimed universally installed.

**External prerequisites:** Eligible ChatGPT/Claude test accounts and consenting setup testers.

<a id="pact-027"></a>
## PACT-027 — Accept the connection experiment

**Status:** todo · **Role:** Release · **Size:** S · **Type:** gate

**Depends on:** [PACT-001](phase-0-connections.md#pact-001), [PACT-002](phase-0-connections.md#pact-002), [PACT-003](phase-0-connections.md#pact-003), [PACT-004](phase-0-connections.md#pact-004), [PACT-005](phase-0-connections.md#pact-005), [PACT-006](phase-0-connections.md#pact-006), [PACT-007](phase-0-connections.md#pact-007), [PACT-008](phase-0-connections.md#pact-008), [PACT-009](phase-0-connections.md#pact-009), [PACT-010](phase-0-connections.md#pact-010), [PACT-011](phase-0-connections.md#pact-011), [PACT-012](phase-0-connections.md#pact-012), [PACT-013](phase-0-connections.md#pact-013), [PACT-014](phase-0-connections.md#pact-014), [PACT-015](phase-0-connections.md#pact-015), [PACT-016](phase-0-connections.md#pact-016), [PACT-017](phase-0-connections.md#pact-017), [PACT-018](phase-0-connections.md#pact-018), [PACT-019](phase-0-connections.md#pact-019), [PACT-020](phase-0-connections.md#pact-020), [PACT-021](phase-0-connections.md#pact-021), [PACT-022](phase-0-connections.md#pact-022), [PACT-023](phase-0-connections.md#pact-023), [PACT-024](phase-0-connections.md#pact-024), [PACT-025](phase-0-connections.md#pact-025), [PACT-026](phase-0-connections.md#pact-026), [PACT-082](phase-0-connections.md#pact-082), [PACT-083](phase-0-connections.md#pact-083), [PACT-084](phase-0-connections.md#pact-084), [PACT-085](phase-0-connections.md#pact-085), [PACT-086](phase-0-connections.md#pact-086)

**Components:** connection release gate.

**Specification:** [delivery](../pact/delivery.md) · **Release checks:** A01, A02, A03, A04, A05, A06, A07, A08, A09

**Implement / deliver**

- Collect A01–A09 evidence, supported-route matrix, setup recordings, privacy preflight, and the test-environment release revision.
- Record pass/fail for every criterion and defects that must close before phase 1 starts.

**Acceptance**

- [ ] All A01–A09 checks pass, including native/Telegram sandbox identities and reusable-module contracts, with no live economic world exposed.
- [ ] A gate cannot be marked done from a mock-provider result, missing host test, or assumed privacy operation.
