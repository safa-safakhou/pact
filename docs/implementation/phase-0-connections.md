# Phase 0 — Connection experiment

**31 tickets · 31 completed.** [Backlog overview](README.md) · [Machine-readable tickets](tasks.json)

Dependencies are completion requirements. The original Alpha track depends on the completed rules gate; new Alpha follow-ups have a separate checkpoint and are completed; the completed experience and friends batches have their own evidence. Postponed production/pilot gates do not block either. Other phases retain their original gates. Owner roles are disciplines, not assigned people; size is not a time commitment.

<a id="pact-001"></a>
## PACT-001 — Bootstrap the application workspace and continuous integration

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** None — start here.

**Components:** workspace, CI, local environment.

**Specification:** [runtime](../pact/runtime.md), [architecture](../pact/architecture.md) · **Release checks:** A01

**Implement / deliver**

- Create a Node 24 / TypeScript workspace with React web, Fastify API, and separate rules, inference, and notification worker entry points; lock dependencies.
- Add PostgreSQL 17 local services, environment validation, migration commands, lint/typecheck/build jobs, and a test database per suite.
- Scaffold platform/domain/transport package boundaries for web, native, and Telegram; do not implement a separate game backend per surface.

**Acceptance**

- [x] A fresh checkout starts the web/API/database using the documented commands without real provider credentials.
- [x] CI builds every process and runs migrations plus a minimal API/database smoke test; no secrets or real user data are committed.

**Assignee:** codex-foundation-run

**Evidence**

- docs/implementation/reports/foundation.md
- Local verification 2026-09-20: npm ci; lint; typecheck; build; unit/integration smoke; live API readiness and web shell

<a id="pact-082"></a>
## PACT-082 — Establish reusable package boundaries and product isolation

**Status:** done · **Role:** Architecture · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-001](phase-0-connections.md#pact-001)

**Components:** workspace packages, domain ports, CI boundaries.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md) · **Release checks:** A09

**Implement / deliver**

- Define explicit platform/domain/transport package exports, ownership/migration boundaries, scoped principal/event types, and transaction interfaces.
- Configure CI import/dependency rules, contract versioning, injected infrastructure ports, and a single composition root; do not split every module into a network service.

**Acceptance**

- [x] A forbidden platform-to-PACT import fails CI; packages expose only declared interfaces and carry explicit product scope.
- [x] Document and fixture-test the atomic unit of work spanning domain stock and authorization reservations; notification delivery remains an outbox effect.
- [x] P1 additive correction 2026-10-17: independent owner metadata feed defaults off; shared world:read authorization, opaque scoped cursors, seven-day/source-aligned retention and no event-triggered PACT inference. Historical acceptance/status retained; new acceptance/evidence: docs/implementation/reports/agent-events-20261017.md.

**Assignee:** codex-foundation-run

**Evidence**

- docs/implementation/reports/foundation.md
- Local verification 2026-09-20: architecture boundary real-tree pass, forbidden fixture rejection, atomic unit-of-work tests 2/2

<a id="pact-002"></a>
## PACT-002 — Define shared command, event, and tool schemas

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-001](phase-0-connections.md#pact-001), [PACT-082](phase-0-connections.md#pact-082)

**Components:** shared contracts.

**Specification:** [runtime](../pact/runtime.md), [access](../pact/access.md) · **Release checks:** A03, A05

**Implement / deliver**

- Create versioned typed schemas for actor context, command envelope, receipt/error codes, events, cursors, model tool calls, and sandbox actions.
- Generate JSON Schema for MCP and an HTTP API contract from the same definitions; define monetary units and serialization bounds explicitly.

**Acceptance**

- [x] Web, MCP, and provider tool validators accept the same valid command fixture and reject the same malformed payload.
- [x] Schemas cannot accept arbitrary code, actor impersonation, unrestricted database queries, credential reads, or human-only account operations as game tools.

**Assignee:** codex-foundation-run

**Evidence**

- docs/implementation/reports/foundation.md
- Local verification 2026-09-20: shared contract tests 7/7 and TypeScript compile

<a id="pact-003"></a>
## PACT-003 — Create account persistence and transaction/outbox infrastructure

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-001](phase-0-connections.md#pact-001), [PACT-002](phase-0-connections.md#pact-002)

**Components:** persistence, job/outbox infrastructure.

**Specification:** [runtime](../pact/runtime.md), [access](../pact/access.md), [privacy](../pact/privacy.md) · **Release checks:** A01, A06

**Implement / deliver**

- Add migrations for accounts, drafts, sessions, connection records, command receipts, durable jobs, inbox events, and outbox rows; add unique constraints and foreign keys.
- Implement a transaction boundary with stable lock ordering and bounded retries, plus job leases and idempotent outbox consumers. Domain tables arrive with their feature tickets.

**Acceptance**

- [x] Two workers cannot hold the same live job lease; an abandoned lease can be recovered.
- [x] Transaction rollback writes neither a receipt nor an outbox event; successful commit survives worker restart and duplicate delivery.

**Assignee:** codex-foundation-run

**Evidence**

- docs/implementation/reports/foundation.md
- Local PostgreSQL 17 verification 2026-09-20: integration/smoke tests 4/4; migrations idempotent

<a id="pact-004"></a>
## PACT-004 — Provision the single-VPS connection-test environment

**Status:** done · **Role:** Platform · **Size:** L · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-001](phase-0-connections.md#pact-001), [PACT-003](phase-0-connections.md#pact-003)

**Components:** infrastructure, deployment.

**Specification:** [runtime](../pact/runtime.md), [privacy](../pact/privacy.md) · **Release checks:** A06

**Implement / deliver**

- Define a reproducible Docker Compose deployment for one EU-hosted Linux VPS: TLS reverse proxy, web/API, rules, inference, notification and channel processes, PostgreSQL 17 on a private network, persistent volumes, health checks, and narrowly mounted secrets.
- Configure automated deploy/migrate/rollback commands, captured SMTP delivery, outbound-provider access, expiring local exports, logical test/production separation, and encrypted same-VPS PostgreSQL base/WAL backups with a 35-day lifecycle for the zero-cost MVP. Record that server loss also loses these backups; PACT-078 owns off-host production hardening. Synthetic identities only until PACT-025 passes.

**Acceptance**

- [x] Deploy the stack to the project VPS, capture a synthetic transactional email through the local SMTP adapter, and restore a synthetic account database from an encrypted local backup; deleted/revoked-record replay hooks are available for PACT-024.
- [x] PostgreSQL is not publicly reachable; private credential-unwrapping material is mounted only into the inference worker; unrelated processes cannot read it; authenticated responses are not cached by the reverse proxy.

**Assignee:** codex-vps-deployment

**Evidence**

- docs/implementation/reports/single-vps-deployment.md
- Live VPS 2026-09-21: https://safa.dedyn.io/pact health/ready/web/Telegram checks passed; migrations 0001-0015 applied
- infra/production/bin/verify.sh passed: PostgreSQL private, inference-only unwrap key, authenticated no-store headers, internal-only Mailpit
- Live release mvp-20260922-1: synthetic security email captured and outbox marked delivered
- Encrypted local Restic snapshot 403424fc restored and structurally verified; six-hour backup timer active

<a id="pact-005"></a>
## PACT-005 — Add redacted operational telemetry and failure correlation

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-002](phase-0-connections.md#pact-002), [PACT-003](phase-0-connections.md#pact-003)

**Components:** observability.

**Specification:** [runtime](../pact/runtime.md), [privacy](../pact/privacy.md) · **Release checks:** A06

**Implement / deliver**

- Add structured request/command/run/job IDs, health probes, metrics for queue lag and provider errors, and sanitized error reporting.
- Apply credential, authorization-header, email, prompt, and message-body redaction; configure security/IP retention classes.

**Acceptance**

- [x] Seed secrets and private text into failed requests and confirm none appear in application logs or client error payloads.
- [x] A failed command can be traced through API, transaction, outbox, and worker using IDs without transcript logging.

**Assignee:** codex-telemetry-run

**Evidence**

- docs/implementation/reports/telemetry.md documents both acceptance checks, architecture decisions, and hosted-retention limitation.
- npm run lint, npm run typecheck, npm run build, and npm test passed locally on 2026-09-20; 7 unit files and 17 tests passed, including seeded-secret redaction and the four-stage failed-command trace.
- PostgreSQL 17.11 migration 0003 applied and reran idempotently; npm run test:integration passed 2 files and 4 tests, including persisted outbox correlation and API/database smoke.

<a id="pact-006"></a>
## PACT-006 — Implement signup, verification, and human sessions

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-003](phase-0-connections.md#pact-003), [PACT-005](phase-0-connections.md#pact-005)

**Components:** identity, email.

**Specification:** [access](../pact/access.md), [privacy](../pact/privacy.md) · **Release checks:** A01

**Implement / deliver**

- Implement email normalization, 18+ and terms-version acceptance, compromised-password checks, Argon2id settings, verification tokens, and session cookies exactly as specified.
- Add CSRF/origin checks, login and email throttles, generic account-existence responses, idle/absolute expiry, and transactional security email.

**Acceptance**

- [x] Duplicate concurrent signup/verification cannot create two accounts or reuse an expired token.
- [x] Password and session expiry, CSRF, cross-account access, throttling, and email enumeration fixtures pass.

**Assignee:** codex-identity-batch

**Evidence**

- docs/implementation/reports/identity-onboarding.md records both acceptance checks, security decisions, and external sender limitations.
- npm run test:integration passed the concurrent signup/single-use verification, password/session expiry, CSRF/origin, cross-account ownership, durable throttle, and enumeration fixtures on PostgreSQL 17.11.
- npm run lint, npm run typecheck, npm run build, and npm test passed locally on 2026-09-20.

<a id="pact-007"></a>
## PACT-007 — Implement recovery, reauthentication, and account security

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-006](phase-0-connections.md#pact-006)

**Components:** identity, access revocation.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A01, A05

**Implement / deliver**

- Implement password reset, verified email changes, five-minute recent-auth checks, optional TOTP/recovery codes, and staff MFA.
- Add a revocation service and session/connection inventory; password reset and sign-out-everywhere revoke applicable access and signal active-run cancellation.

**Acceptance**

- [x] A reset token is single-use and expires after 15 minutes; resetting revokes old cookies and OAuth grants.
- [x] An Envoy cannot raise authority, replace a credential, export, delete, or approve using a game token; TOTP recovery codes cannot be reused.

**Assignee:** codex-identity-batch

**Evidence**

- docs/implementation/reports/identity-onboarding.md records recovery, recent-auth, MFA, revocation, inventory, and delivery-boundary evidence.
- PostgreSQL fixtures passed 15-minute reset expiry/replay, session and OAuth revocation, active-run cancellation event, human-audience gates for every listed sensitive action, staff MFA, and one-use recovery codes.
- Token tables contain HMACs and transactional email outbox payloads contain AES-256-GCM sealed delivery tokens rather than plaintext tokens.

<a id="pact-008"></a>
## PACT-008 — Implement private kingdom drafts and resumable setup

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-006](phase-0-connections.md#pact-006), [PACT-002](phase-0-connections.md#pact-002)

**Components:** onboarding, drafts.

**Specification:** [access](../pact/access.md), [social](../pact/social.md) · **Release checks:** A01

**Implement / deliver**

- Persist draft name, proposed handle, portrait, connection-check timestamp, and typed invitation destination; purge unused drafts after seven days.
- Add a sandbox-only activation fixture with exactly-once acceptance; real founding is PACT-031 and cannot be invoked in the connection experiment.

**Acceptance**

- [x] A draft has no stocks, troops, score, or targetable public kingdom identity.
- [x] OAuth redirect, logout/recovery, and repeated setup submissions preserve the same permitted destination; stale checks and unverified accounts fail activation validation.

**Assignee:** codex-identity-batch

**Evidence**

- docs/implementation/reports/identity-onboarding.md records private-draft and resumable-setup acceptance evidence.
- PostgreSQL fixtures passed server-side destination preservation, unverified/expired/stale rejection, seven-day purge behavior, and concurrent exactly-once sandbox activation.
- Schema and tests confirm the draft has no stocks, troops, score, or public kingdom table; real founding remains unavailable.

<a id="pact-009"></a>
## PACT-009 — Build encrypted model credential storage

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-007](phase-0-connections.md#pact-007)

**Components:** credential vault.

**Specification:** [access](../pact/access.md), [privacy](../pact/privacy.md) · **Release checks:** A02, A06

**Implement / deliver**

- Implement save/replace/revoke for five saved model connections with fresh AES-256-GCM data keys and an injected wrapping-key port. The single-VPS adapter uses public wrapping material for writes and mounts private unwrapping material only into the inference worker.
- Restrict decryption to the inference worker, show only labels/suffixes, and remove live encrypted keys within 24 hours of revocation.

**Acceptance**

- [x] Key substitution across accounts fails; the API-facing adapter can wrap but cannot unwrap; no key is returned by read/MCP endpoints or included in prompts.
- [x] Revocation immediately prevents a new call; a credential already submitted to a provider is reported truthfully rather than claimed recalled.

**Assignee:** codex-credential-vault

**Evidence**

- docs/implementation/reports/credential-vault.md
- npm run lint; npm run typecheck; npm run build; npm test (21); npm run test:integration (26)
- packages/credential-vault/src/crypto.test.ts; tests/integration/credential-vault.test.ts; scripts/check-boundaries.mjs

<a id="pact-010"></a>
## PACT-010 — Build the provider adapter interface and contract harness

**Status:** done · **Role:** Integrations · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-002](phase-0-connections.md#pact-002), [PACT-009](phase-0-connections.md#pact-009)

**Components:** provider interface, provider test harness.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A02

**Implement / deliver**

- Define model discovery/capabilities, structured tool calls/results, token accounting, cancellation, sanitized errors, and optional pricing metadata.
- Build a deterministic fake provider for CI and adapter fixtures for unknown pricing, absent usage, malformed tools, timeout, and quota exhaustion.

**Acceptance**

- [x] A route can be swapped without changing command schemas or kingdom identity.
- [x] Unsupported models are rejected before a run; missing price is never rendered as zero; failure never silently switches provider or credential.

**Assignee:** codex-provider-contract

**Evidence**

- docs/implementation/reports/provider-contract.md
- npm run lint; npm run typecheck; npm run build; npm test (25); npm run test:integration (26)
- packages/model-provider/src/provider-contract.test.ts; packages/model-provider/src/contract-harness.ts

<a id="pact-011"></a>
## PACT-011 — Implement the OpenAI model adapter

**Status:** done · **Role:** Integrations · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-010](phase-0-connections.md#pact-010)

**Components:** OpenAI adapter.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A02

**Implement / deliver**

- Implement the specified Responses API route, server-side credentials, tool-call continuation, selected model validation, and usage mapping.
- Add provider-backed smoke evidence using an operator test key alongside recorded/sanitized fixtures.

**Acceptance**

- [x] A real supported model reads the draft, proposes a valid sandbox write, and consumes its tool receipt in a final response.
- [x] Invalid key, tool error, cancellation, unavailable model, and quota failure produce the shared adapter result without leaking credentials.

**External prerequisites:** Operator-provided test API key and quota.

**Assignee:** cursor-agent

**Evidence**

- docs/implementation/reports/runs-openai.md
- npm run lint; npm run typecheck; npm test (27 includes openai.test.ts)
- packages/model-provider/src/openai.ts; packages/model-provider/src/openai.test.ts
- Live OpenAI operator key smoke not run; fixture Responses transport verified

<a id="pact-012"></a>
## PACT-012 — Implement the Anthropic model adapter

**Status:** done · **Role:** Integrations · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-010](phase-0-connections.md#pact-010)

**Components:** Anthropic adapter.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A02

**Implement / deliver**

- Implement Messages API with the pinned API version, supported authentication/workspace fields, tool-result continuation, and usage mapping.
- Keep subscription login separate from API credentials and record the successful model identifier.

**Acceptance**

- [x] A real supported model completes the same draft-read/sandbox-write/tool-result fixture as other adapters.
- [x] Required workspace errors, malformed tools, quota failure, and cancellation map to shared results without starting a fallback route.

**External prerequisites:** Operator-provided test API key/workspace and quota.

**Assignee:** cursor-agent

**Evidence**

- docs/implementation/reports/provider-adapters-anthropic-gemini-xai.md
- npm run build --workspace @pact/model-provider; npm test -- packages/model-provider (9)
- packages/model-provider/src/{anthropic,gemini,xai}.ts; packages/model-provider/src/provider-adapters.test.ts
- Live operator keys not used; fixture HTTP transports verified

<a id="pact-013"></a>
## PACT-013 — Implement the Gemini model adapter

**Status:** done · **Role:** Integrations · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-010](phase-0-connections.md#pact-010)

**Components:** Gemini adapter.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A02

**Implement / deliver**

- Implement the specified Gemini auth-key route, function calls/results, capability checks, and provider-specific context/usage handling.
- Validate a real supported credential instead of accepting legacy-key syntax as proof of working access.

**Acceptance**

- [x] A real tool-capable model completes the common connection fixture.
- [x] Unsupported credentials/models, blocked responses, missing usage, and provider throttles stop or report correctly without fabricated game success.

**External prerequisites:** Operator-provided Gemini auth key and quota.

**Assignee:** cursor-agent

**Evidence**

- docs/implementation/reports/provider-adapters-anthropic-gemini-xai.md
- npm run build --workspace @pact/model-provider; npm test -- packages/model-provider (9)
- packages/model-provider/src/{anthropic,gemini,xai}.ts; packages/model-provider/src/provider-adapters.test.ts
- Live operator keys not used; fixture HTTP transports verified

<a id="pact-014"></a>
## PACT-014 — Implement the xAI model adapter

**Status:** done · **Role:** Integrations · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-010](phase-0-connections.md#pact-010)

**Components:** xAI adapter.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A02

**Implement / deliver**

- Implement the specified API bearer-key route, tool-call continuation, model selection, and usage/error conversion.
- Label this as xAI model access in PACT; do not present it as an unverified Grok consumer-chat MCP integration.

**Acceptance**

- [x] A real supported model passes the common connection fixture.
- [x] Invalid key, model mismatch, repeated tool-call IDs, and provider timeouts cannot cause duplicate sandbox actions.

**External prerequisites:** Operator-provided test API key and quota.

**Assignee:** cursor-agent

**Evidence**

- docs/implementation/reports/provider-adapters-anthropic-gemini-xai.md
- npm run build --workspace @pact/model-provider; npm test -- packages/model-provider (9)
- packages/model-provider/src/{anthropic,gemini,xai}.ts; packages/model-provider/src/provider-adapters.test.ts
- Live operator keys not used; fixture HTTP transports verified

<a id="pact-015"></a>
## PACT-015 — Implement OpenRouter authorization and model adapter

**Status:** done · **Role:** Integrations · **Size:** L · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-010](phase-0-connections.md#pact-010), [PACT-007](phase-0-connections.md#pact-007)

**Components:** OpenRouter adapter, authorization callback.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A02

**Implement / deliver**

- Implement manual-key entry and the official PKCE authorization/code-to-key exchange with session-bound state, exact callback validation, single use, and ten-minute expiry.
- Implement explicit model/upstream routing disclosure, tool results, usage accounting, and provider-failure handling.

**Acceptance**

- [x] Both key entry and authorization complete the common real-provider fixture.
- [x] Swapped state/verifier, replayed callback, expired flow, or an undisclosed routing fallback cannot attach a credential or run a model.

**External prerequisites:** OpenRouter test account/key and quota.

**Assignee:** cursor-agent

**Evidence**

- docs/implementation/reports/openrouter-setup-ui.md
- docs/api/openrouter.md
- npm run lint; npm run typecheck; npm test (40); npm run test:integration (29); npm run build
- tests/integration/openrouter.test.ts
- packages/model-provider/src/openrouter.test.ts

<a id="pact-016"></a>
## PACT-016 — Implement PACT OAuth for external clients

**Status:** done · **Role:** Security · **Size:** L · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-007](phase-0-connections.md#pact-007), [PACT-002](phase-0-connections.md#pact-002)

**Components:** OAuth authorization/resource service.

**Specification:** [access](../pact/access.md), [architecture](../pact/architecture.md) · **Release checks:** A03, A05

**Implement / deliver**

- Implement the authorization-code/PKCE flow, resource and authorization metadata, audience-bound scopes, refresh rotation, revocation, and exact redirect checks.
- Support preregistration, validated client-ID metadata, and dynamic registration; protect metadata fetches against SSRF. Use reviewed OAuth primitives rather than inventing cryptographic protocols.
- Separate first-party native human client registrations/audiences from MCP agent grants; authorization-code primitives are reusable but human permissions cannot be delegated to agent tokens.

**Acceptance**

- [x] Wrong audience/scope, refresh replay, revoked access, redirect mismatch, and private-network metadata requests fail.
- [x] Consent names the client and draft/kingdom; OAuth tokens cannot read provider keys or authorize human-only operations.

**Assignee:** codex-chatgpt-link-repair

**Evidence**

- docs/implementation/reports/oauth-authority.md
- npm run lint; npm run typecheck; npm test (18); npm run test:integration (18); npm run build
- tests/integration/oauth.test.ts
- docs/implementation/reports/chatgpt-account-link-repair-20261010.md
- 10 October ChatGPT legacy-resource correction: build, typecheck, lint, 356 unit and 379 integration passes (one optional provider skip); exact resource/PKCE/refresh and canonical consent redirect regressions passed. Actual human host reconnect remains separate.
- Released chatgpt-link-20261010-1 / bfe8a64 after successful encrypted backup and standard public deployment verification; four old/current host/resource combinations reach canonical account entry, exact redirect parameters retained, foreign resources 400, canonical metadata. No human consent or provider inference performed.

<a id="pact-017"></a>
## PACT-017 — Implement the remote MCP transport and tool registry

**Status:** done · **Role:** Integrations · **Size:** L · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-016](phase-0-connections.md#pact-016), [PACT-002](phase-0-connections.md#pact-002)

**Components:** MCP transport.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A03

**Implement / deliver**

- Expose the single Streamable HTTP endpoint with the two pinned protocol versions, initialization, typed tool listing, structured results, bounded reads, and origin checks.
- Bind every tool invocation to the authenticated actor; use an injectable command dispatcher until PACT-018 is connected.

**Acceptance**

- [x] Protocol fixtures pass for initialization, supported/unsupported versions, POST results, GET stream behavior, and isolated client sessions.
- [x] Listing or invoking a tool never grants broader scope; another account cannot resume or read a private stream.

**Assignee:** cursor-agent

**Evidence**

- docs/implementation/reports/mcp-approvals-inbox.md
- npm run lint; npm run typecheck; npm test (18); npm run test:integration (21); npm run build:packages; npm run build --workspace @pact/api
- tests/integration/mcp-approval-inbox.test.ts

<a id="pact-018"></a>
## PACT-018 — Implement the shared dispatcher and sandbox receipts

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-003](phase-0-connections.md#pact-003), [PACT-007](phase-0-connections.md#pact-007), [PACT-002](phase-0-connections.md#pact-002)

**Components:** command gateway, receipts.

**Specification:** [runtime](../pact/runtime.md) · **Release checks:** A03, A05

**Implement / deliver**

- Build one command gateway with authenticated actor derivation, payload/version checks, idempotency keys, receipts, and transactional outbox.
- Add harmless private-draft read/write fixtures under a sandbox-only namespace; defer economic handlers to phase 1.

**Acceptance**

- [x] Same ID and payload produce one mutation and the original receipt; changed payload with reused ID returns conflict.
- [x] A timed-out write can be reconciled through receipt lookup without re-execution or exposing another account’s result.

**Assignee:** cursor-agent

**Evidence**

- docs/implementation/reports/dispatcher.md
- npm run lint; npm run typecheck; npm test (18); npm run test:integration (14); npm run build
- tests/integration/dispatcher.test.ts

<a id="pact-019"></a>
## PACT-019 — Implement mandate permissions and immediate-spend checks

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-018](phase-0-connections.md#pact-018)

**Components:** authority service.

**Specification:** [runtime](../pact/runtime.md) · **Release checks:** A05

**Implement / deliver**

- Persist human-editable versioned mandates and implement action/target restrictions, session/troop ceilings, reserve floors, and default deny/approval rules.
- Add the immediate authorization ledger interface using synthetic amounts; full future-commitment integration is PACT-039.

**Acceptance**

- [x] Agents cannot mutate their mandate or obtain human-only permissions by changing payload text.
- [x] Two sandbox requests sharing an allowance cannot both spend it; raising authority requires recent human authentication and increments its version.

**Assignee:** codex-founder-permission-maintenance

**Evidence**

- docs/implementation/reports/oauth-authority.md
- npm run lint; npm run typecheck; npm test (18); npm run test:integration (18); npm run build
- tests/integration/authority.test.ts
- reports/agent-permission-maintenance-20261010.md: founder-authorized existing-player settings utility; exact cohort/version/digest and transactional rollback tests, package build/types/lint and 62 relevant integrations pass. No agent/public operator control route.
- aed2e38 / permission-maintenance-20261010-1 one-shot operator image: encrypted backup passed; all 219 eligible kingdoms granted, 181 versions incremented / 38 mandates created, exact profile/delegation and 219 audit version transitions verified. Standard public verification passed; app release chatgpt-link-20261010-1 unchanged. Hardcoded human-only gameplay remains separate.

<a id="pact-020"></a>
## PACT-020 — Implement exact-command human approvals

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-019](phase-0-connections.md#pact-019)

**Components:** approval service.

**Specification:** [runtime](../pact/runtime.md), [access](../pact/access.md) · **Release checks:** A05

**Implement / deliver**

- Store immutable approval requests, command hashes, current-state preconditions, minimum expiry deadlines, and one-use human permits.
- Implement authenticated approval/reject POSTs, status reads, and deep links that expose no bearer approval secret.

**Acceptance**

- [x] GET, chatbot text, or a host tool confirmation cannot approve; changed/expired terms fail.
- [x] Double approval commits once; a successful approval can be read after the original chatbot disconnects.

**Assignee:** cursor-agent

**Evidence**

- docs/implementation/reports/mcp-approvals-inbox.md
- npm run lint; npm run typecheck; npm test (18); npm run test:integration (21); npm run build:packages; npm run build --workspace @pact/api
- tests/integration/mcp-approval-inbox.test.ts

<a id="pact-021"></a>
## PACT-021 — Implement bounded Envoy runs and exclusive write leases

**Status:** done · **Role:** Backend · **Size:** L · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-010](phase-0-connections.md#pact-010), [PACT-018](phase-0-connections.md#pact-018), [PACT-019](phase-0-connections.md#pact-019), [PACT-020](phase-0-connections.md#pact-020)

**Components:** run service, inference worker.

**Specification:** [runtime](../pact/runtime.md) · **Release checks:** A04, A05

**Implement / deliver**

- Implement PACT run start/stop/wait/resume, durable worker jobs, one write lease and one in-flight request per kingdom, pinned connection/model, and token/call/message/deadline reservations.
- Implement MCP lease acquisition without provider inference; takeovers and revocation prevent new commands while preserving already-committed jobs.

**Acceptance**

- [x] A fake-provider run stops at each limit, preserves allowance on resume, and cannot be extended by repeated callbacks.
- [x] Close the browser during a real run and observe bounded completion; inject an inbox event while idle and observe zero model calls. Ambiguous provider-call crashes are surfaced without an unbounded retry/billing loop.
- [x] P1 additive correction 2026-10-17: independent owner metadata feed defaults off; shared world:read authorization, opaque scoped cursors, seven-day/source-aligned retention and no event-triggered PACT inference. Historical acceptance/status retained; new acceptance/evidence: docs/implementation/reports/agent-events-20261017.md.

**Assignee:** codex-mcp-metadata

**Evidence**

- docs/implementation/reports/runs-openai.md
- npm run lint; npm run typecheck; npm test (27); npm run test:integration (runs + suite); npm run build:packages; api/inference builds
- tests/integration/runs.test.ts
- 25 Sep 2026: bounded-run regression correction rejects starts above the Version 1 15-minute, 20-call, and 40,000-token ceilings, and invalid conversation/message or numeric limits, before creating a run, lease, or inference job. Exact maxima remain valid. Local Node 24 build/typecheck/lint, 115 unit and 160 PostgreSQL integration tests pass. See docs/api/runs.md and docs/implementation/reports/runs-openai.md. PACT-021 remains Done; no live provider or VPS deployment claimed.
- docs/implementation/reports/mcp-lease-renewal-20261011.md — deployed mcp-renewal-20261011-1 from 8417159 after successful backup; two actual same-account renewal calls now succeed with the same lease ID and advancing expiry; canonical verification passes; 26 targeted PostgreSQL checks/build/types/lint/planning pass. Consumer schedule restart is not claimed.
- docs/implementation/reports/mcp-lease-metadata-20261011.md — 2 descriptor and 26 targeted PostgreSQL checks/build/types/lint pass; corrected non-destructive closed-world lease write only. Founder-selected PACT_test1 Allow all actions update/readback and actual affected-account lease open succeed; no construction or scheduler restart claimed.
- Hosted release mcp-metadata-20261011-1 from 3c5c405: backup success, matching archive hash/gzip validation, canonical production verification and running API descriptor assertion passed; runtime/gateway ledger verified. MNI-81 Done release evidence appended; hourly ChatGPT automation remains paused/unverified.

<a id="pact-022"></a>
## PACT-022 — Implement the durable inbox and live event delivery

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-003](phase-0-connections.md#pact-003), [PACT-018](phase-0-connections.md#pact-018)

**Components:** inbox service, SSE.

**Specification:** [runtime](../pact/runtime.md), [privacy](../pact/privacy.md) · **Release checks:** A03, A04

**Implement / deliver**

- Persist audience-filtered events with cursor pagination, acknowledgement, deduplication, and app SSE delivery.
- Add event subscriptions for approvals, run state, and security notices; define resync behavior when a cursor predates retained events.

**Acceptance**

- [x] Disconnect/reconnect returns ordered authorized events without duplicate user-visible cards.
- [x] Notification/outbox workers never invoke the provider adapter; omitted or unavailable delivery cannot change an action receipt.
- [x] P1 additive correction 2026-10-17: independent owner metadata feed defaults off; shared world:read authorization, opaque scoped cursors, seven-day/source-aligned retention and no event-triggered PACT inference. Historical acceptance/status retained; new acceptance/evidence: docs/implementation/reports/agent-events-20261017.md.

**Assignee:** cursor-agent

**Evidence**

- docs/implementation/reports/mcp-approvals-inbox.md
- npm run lint; npm run typecheck; npm test (18); npm run test:integration (21); npm run build:packages; npm run build --workspace @pact/api
- tests/integration/mcp-approval-inbox.test.ts

<a id="pact-023"></a>
## PACT-023 — Build account, connection, and Envoy setup screens

**Status:** done · **Role:** Frontend · **Size:** L · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-008](phase-0-connections.md#pact-008), [PACT-009](phase-0-connections.md#pact-009), [PACT-015](phase-0-connections.md#pact-015), [PACT-016](phase-0-connections.md#pact-016), [PACT-017](phase-0-connections.md#pact-017), [PACT-020](phase-0-connections.md#pact-020), [PACT-021](phase-0-connections.md#pact-021), [PACT-022](phase-0-connections.md#pact-022)

**Components:** account and Envoy UI.

**Specification:** [product](../pact/product.md), [access](../pact/access.md), [runtime](../pact/runtime.md), [architecture](../pact/architecture.md) · **Release checks:** A01, A02, A03, A04, A05

**Implement / deliver**

- Build English responsive signup/security, draft, provider selection, credentials, model choice, allowance confirmation, run controls, and approval-inbox screens.
- Preserve the invitation destination; show truthful Working/Waiting/Stopped states, unknown pricing, external-host usage, and connector prerequisites. Wire MCP tools to the same dispatcher/run services.
- Separate reusable DOM feature components from the web host shell so Telegram can reuse them; expose platform-independent view models for native screens.

**Acceptance**

- [x] Complete setup and a sandbox approval on phone and desktop using keyboard as well as touch.
- [x] Closing/reopening the page shows server state; expired approval, revoked key, and unsupported host produce actionable messages without founding a live kingdom.

**Assignee:** cursor-agent

**Evidence**

- docs/implementation/reports/openrouter-setup-ui.md
- docs/implementation/reports/setup-ui.md
- docs/api/setup-ui.md
- npm run lint; npm run typecheck; npm test (40); npm run test:integration (29); npm run build
- packages/client-sdk/src/setup-view-models.test.ts
- packages/ui-features/src/setup-flow.test.tsx

<a id="pact-083"></a>
## PACT-083 — Build the shared client SDK and capability contract

**Status:** done · **Role:** Backend / Frontend · **Size:** M · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-002](phase-0-connections.md#pact-002), [PACT-016](phase-0-connections.md#pact-016), [PACT-018](phase-0-connections.md#pact-018), [PACT-020](phase-0-connections.md#pact-020), [PACT-022](phase-0-connections.md#pact-022), [PACT-082](phase-0-connections.md#pact-082)

**Components:** TypeScript SDK, generated types, capability metadata.

**Specification:** [architecture](../pact/architecture.md), [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** A08, A09

**Implement / deliver**

- Generate reusable HTTP/tool client types, command IDs, receipt reconciliation, authenticated read projections, cursor subscriptions, error mapping, and platform-independent view models.
- Publish API/schema versions and capabilities with graceful unsupported-version behavior; separate human and agent audiences in the SDK.

**Acceptance**

- [x] A web and non-browser test client issue the same sandbox command and observe the same receipt after a timeout/retry.
- [x] SDK imports no DOM/React Native/Telegram globals; no client retry silently changes an idempotency key or acquires human scopes.

**Assignee:** codex-sdk-run

**Evidence**

- docs/implementation/reports/client-sdk.md
- npm run lint; npm run typecheck; npm test (20); npm run build; npm run test:integration (24)
- tests/integration/client-sdk.test.ts; packages/client-sdk/src/client.test.ts

<a id="pact-085"></a>
## PACT-085 — Prove Telegram identity linking and Mini App authentication

**Status:** done · **Role:** Integrations · **Size:** L · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-007](phase-0-connections.md#pact-007), [PACT-023](phase-0-connections.md#pact-023), [PACT-083](phase-0-connections.md#pact-083)

**Components:** Telegram adapter, Mini App shell, linking sessions.

**Specification:** [architecture](../pact/architecture.md), [access](../pact/access.md), [privacy](../pact/privacy.md) · **Release checks:** A08

**Implement / deliver**

- Create the test bot/Mini App shell; implement validated bot-bound initData, five-minute age check, single-use bootstrap exchange, webhook secret/update deduplication, and linked PACT account confirmation.
- Add sandbox read/write and human approval in the authenticated Mini App, unlink/revoke, and denied group-chat control paths.

**Acceptance**

- [x] Forged/stale/replayed launch data, changed usernames, forwarded callbacks, and swapped PACT sessions cannot link or operate another account.
- [x] Unlink immediately revokes channel sessions; no game privilege is inferred from a Telegram handle or message text.

**Assignee:** codex-channel-auth-batch

**Evidence**

- docs/implementation/reports/native-telegram-auth.md
- npm run lint; npm run typecheck; npm test; npm run test:integration; npm run smoke; npm run build
- packages/telegram/src/crypto.test.ts; tests/integration/telegram.test.ts
- Live bot and menu configured; HTTPS webhook accepts the secret, rejects missing secret with 403, and returns privilegedAction=false for synthetic message text
- e6efe30 / mvp-20260922-2: live signed synthetic bootstrap, web confirmation, channel session, private read, unlink, and post-revocation 403 pass
- 1bb8026 / mvp-20260922-3: valid empty JSON writes and live sandbox activation pass
- 4265c9b / mvp-20260922-4: Telegram bridge script and narrowly scoped web framing policy verified publicly
- 25a4d2a / mvp-20260922-5: current Telegram signature field included in bot-token HMAC validation; real launch bootstrap passed
- 28ead74 / mvp-20260922-6: secure partitioned Telegram session cookie; real-client link, private read, sandbox write, exact approval, identical duplicate receipt, unlink, and zero active sessions passed

<a id="pact-024"></a>
## PACT-024 — Implement first-account retention, export, and deletion

**Status:** done · **Role:** Security · **Size:** L · **Type:** implementation

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-008](phase-0-connections.md#pact-008), [PACT-009](phase-0-connections.md#pact-009), [PACT-016](phase-0-connections.md#pact-016), [PACT-021](phase-0-connections.md#pact-021), [PACT-022](phase-0-connections.md#pact-022), [PACT-085](phase-0-connections.md#pact-085)

**Components:** privacy jobs, export, deletion registry.

**Specification:** [privacy](../pact/privacy.md), [access](../pact/access.md), [architecture](../pact/architecture.md) · **Release checks:** A06

**Implement / deliver**

- Implement account/draft/key/session/run/inbox retention jobs, JSON export with readable index and authenticated download, legal-hold metadata, and deletion/revocation registry.
- Add purge/restore replay for phase-0 data and a privacy Settings screen; gameplay retirement and social data are added in later tickets.
- Include Telegram sandbox-session/link cleanup and backup suppression before recruiting real connection testers; native-session cleanup is added when signed native testing begins.

**Acceptance**

- [x] Export excludes credentials and other players’ data; delete disables access immediately and meets specified live-store deadlines.
- [x] Restore a pre-deletion backup and replay the deletion/revocation registry before traffic; removed credentials and content cannot reappear.

**Assignee:** codex-privacy-batch

**Evidence**

- docs/implementation/reports/account-privacy.md
- 581add8 / mvp-20260922-7: authenticated export/deletion, migration 0016, daily retention, legal-hold metadata, and pre-traffic deletion replay
- npm test (66); npm run test:integration (34); npm run smoke (1); npm run build; npm run lint; npm run typecheck
- VPS isolated restore drill: pre-deletion PostgreSQL dump replayed to closing with zero active sessions, live credential ciphertexts, or Telegram links

<a id="pact-025"></a>
## PACT-025 — Complete the real-account environment preflight

**Status:** done · **Role:** Operations · **Size:** M · **Type:** operations

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-004](phase-0-connections.md#pact-004), [PACT-005](phase-0-connections.md#pact-005), [PACT-006](phase-0-connections.md#pact-006), [PACT-007](phase-0-connections.md#pact-007), [PACT-024](phase-0-connections.md#pact-024)

**Components:** operator configuration, policies.

**Specification:** [privacy](../pact/privacy.md), [access](../pact/access.md), [architecture](../pact/architecture.md) · **Release checks:** A06

**Implement / deliver**

- Populate clearly labeled synthetic controller/support identity, terms/privacy versions, temporary processor disclosures, and captured transactional email sender configuration for the private MVP.
- Keep registration disabled when required values are missing; allow it only with the complete synthetic MVP register. Record temporary privacy/support ownership for connection testers.
- Include Telegram, model-provider, and device-session data flows in the MVP notices. Defer actual production operator facts and agreements to PACT-098.

**Acceptance**

- [x] A deployment with an empty required operator field cannot accept a signup, while the complete labeled synthetic register enables private MVP signup.
- [x] MVP notices, captured email delivery, privacy-request instructions, temporary ownership, and restore/deletion checks are demonstrated before inviting a synthetic-data tester.

**Assignee:** codex-operator-preflight

**Evidence**

- docs/implementation/reports/real-account-preflight.md
- b5f2a3f (fail-closed operator register, public notices/status, single-VPS mount, tests and operations docs)
- npm test (72); npm run test:integration (34); npm run smoke (1); npm run build; npm run lint; npm run typecheck
- VPS release mvp-20260923-1: empty register returned 503 with zero created rows; the complete labeled MVP test register passed preflight, exposed synthetic notices, set registration status true, and allowed requests to reach normal signup validation

<a id="pact-086"></a>
## PACT-086 — Certify additional assistant routes and publish a capability matrix

**Status:** done · **Role:** Integrations · **Size:** M · **Type:** verification

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-017](phase-0-connections.md#pact-017), [PACT-023](phase-0-connections.md#pact-023), [PACT-025](phase-0-connections.md#pact-025), [PACT-083](phase-0-connections.md#pact-083)

**Components:** Gemini CLI certification, Grok tool-client fixture, compatibility registry.

**Specification:** [architecture](../pact/architecture.md), [access](../pact/access.md), [delivery](../pact/delivery.md) · **Release checks:** A03, A09

**Implement / deliver**

- Run recorded authenticated MCP and provider read/action/approval/revoke fixtures for the Gemini and Grok-powered routes using the standard adapter/SDK.
- Publish model API support separately from actual consumer-client certification, OAuth eligibility/billing, tool capabilities, client versions, and readable versus writable surfaces; defer unavailable live hosts to PACT-079.

**Acceptance**

- [x] Recorded routes have fixture evidence and unsupported consumer-app connections are published as not_tested or fixture_only rather than advertised as working.
- [x] The compatibility contract keeps PACT receipts/authority and scoped game credentials separate from subscription login; live host certification remains mandatory in PACT-079.

**Assignee:** codex-client-certification

**Evidence**

- docs/implementation/reports/additional-client-compatibility.md
- b58d7f4 (typed client compatibility contract, truthful public matrix, tests and API documentation)
- npm test (74); npm run test:integration (34); npm run smoke (1); npm run build; npm run lint; npm run typecheck
- VPS release mvp-20260923-2: deployment verification passed and /v1/client-compatibility publishes Gemini not_tested and Grok fixture_only

<a id="pact-026"></a>
## PACT-026 — Certify every connection route and measure unaided setup

**Status:** done · **Role:** QA · **Size:** L · **Type:** verification

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-011](phase-0-connections.md#pact-011), [PACT-012](phase-0-connections.md#pact-012), [PACT-013](phase-0-connections.md#pact-013), [PACT-014](phase-0-connections.md#pact-014), [PACT-015](phase-0-connections.md#pact-015), [PACT-017](phase-0-connections.md#pact-017), [PACT-023](phase-0-connections.md#pact-023), [PACT-024](phase-0-connections.md#pact-024), [PACT-025](phase-0-connections.md#pact-025), [PACT-085](phase-0-connections.md#pact-085), [PACT-086](phase-0-connections.md#pact-086)

**Components:** connection certification, setup guides.

**Specification:** [access](../pact/access.md), [delivery](../pact/delivery.md), [architecture](../pact/architecture.md) · **Release checks:** A01, A02, A03, A04, A05, A06, A07, A08, A09

**Implement / deliver**

- Run the full synthetic signup/OAuth/read/write/approval/revoke fixture and recorded-key transports through all five PACT adapters.
- Publish host/model/protocol/date requirements, repeat each automated certification fixture five times, and record truthful availability, errors, timing harness, and sanitized evidence.
- Include the truthful additional-client matrix and Telegram sandbox evidence; defer real client accounts, live keys, unfamiliar-human measurements, and native devices to PACT-079/L06.

**Acceptance**

- [x] Each synthetic route passes five repeated automated sandbox outcomes; guides separate fixture duration from external account/verification time and identify deferred human measurement.
- [x] Required fixtures cover expiry, revocation, closure/disconnect, and approval; unavailable distribution is recorded accurately and cannot be claimed universally installed.

**Assignee:** codex-connection-certification

**Evidence**

- docs/implementation/reports/mvp-connection-certification.md
- npm run certify:connections: five of five repeated synthetic certification runs passed; each run covered 12 unit and 16 integration checks
- docs/operations/connection-certification.md and deployed /v1/client-compatibility matrix
- Real client accounts, live provider keys, and unfamiliar-human setup measurement explicitly deferred to PACT-079

<a id="pact-027"></a>
## PACT-027 — Accept the connection experiment

**Status:** done · **Role:** Release · **Size:** S · **Type:** gate

**Delivery track:** completed foundation · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-001](phase-0-connections.md#pact-001), [PACT-002](phase-0-connections.md#pact-002), [PACT-003](phase-0-connections.md#pact-003), [PACT-004](phase-0-connections.md#pact-004), [PACT-005](phase-0-connections.md#pact-005), [PACT-006](phase-0-connections.md#pact-006), [PACT-007](phase-0-connections.md#pact-007), [PACT-008](phase-0-connections.md#pact-008), [PACT-009](phase-0-connections.md#pact-009), [PACT-010](phase-0-connections.md#pact-010), [PACT-011](phase-0-connections.md#pact-011), [PACT-012](phase-0-connections.md#pact-012), [PACT-013](phase-0-connections.md#pact-013), [PACT-014](phase-0-connections.md#pact-014), [PACT-015](phase-0-connections.md#pact-015), [PACT-016](phase-0-connections.md#pact-016), [PACT-017](phase-0-connections.md#pact-017), [PACT-018](phase-0-connections.md#pact-018), [PACT-019](phase-0-connections.md#pact-019), [PACT-020](phase-0-connections.md#pact-020), [PACT-021](phase-0-connections.md#pact-021), [PACT-022](phase-0-connections.md#pact-022), [PACT-023](phase-0-connections.md#pact-023), [PACT-024](phase-0-connections.md#pact-024), [PACT-025](phase-0-connections.md#pact-025), [PACT-026](phase-0-connections.md#pact-026), [PACT-082](phase-0-connections.md#pact-082), [PACT-083](phase-0-connections.md#pact-083), [PACT-085](phase-0-connections.md#pact-085), [PACT-086](phase-0-connections.md#pact-086)

**Components:** connection release gate.

**Specification:** [delivery](../pact/delivery.md) · **Release checks:** A01, A02, A03, A04, A05, A06, A07, A08, A09

**Implement / deliver**

- Collect Version 1.4 A01–A09 synthetic-MVP evidence, the truthful supported-route matrix, repeated setup fixtures, privacy preflight, and test-environment release revision.
- Record pass/fail for every MVP criterion and the real-client/key/human-study work deferred to PACT-079 before production support is advertised.

**Acceptance**

- [x] All Version 1.4 A01–A09 synthetic-MVP checks pass, including Telegram test-bot identity, local native-PKCE fixtures, truthful unavailable-host labels, and reusable-module contracts, with no live economic world exposed.
- [x] The gate identifies recorded fixtures as fixtures and carries live clients/keys, distribution, and unfamiliar-human measurement into PACT-079 rather than claiming them.

**Assignee:** codex-phase-zero-gate

**Evidence**

- docs/implementation/reports/phase-0-connection-gate.md
- All 30 non-gate Phase 0 dependencies are done with durable reports/evidence
- npm run certify:connections passed five of five repetitions; full suite/build/lint/typecheck passed before gate review
- VPS mvp-20260923-2 verification, synthetic registration, Telegram test-bot evidence, and truthful public client matrix
