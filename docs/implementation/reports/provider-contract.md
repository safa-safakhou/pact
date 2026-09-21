# Provider adapter interface and contract harness

Tickets: [PACT-010 / MNI-70](https://linear.app/mnim/issue/MNI-70/pact-010-build-the-provider-adapter-interface-and-contract-harness)

Implementation revision/PR: uncommitted local work on `master`, based on `8ca3911`; no PR.

Verification environment: 21 September 2026; macOS arm64; Node.js 24.21.0; npm 11.19.0; PostgreSQL 17 via Colima Compose.

## Result

`@pact/model-provider` now defines a provider-neutral adapter for model discovery/capabilities, immutable explicit routing, messages and structured tool calls, token allowances and optional usage, exact integer pricing, cancellation, and sanitized errors. `ProviderRouter` validates the selected model before invocation and invokes only the adapter named by the prepared route; it contains no fallback selection.

The deterministic fake provider and reusable `exerciseProviderContract` harness cover success, unknown pricing, absent usage, malformed tool calls, timeout, and quota exhaustion without network access or real credentials. Shared command parsing remains in `@pact/contracts`, so changing provider adapters does not change command envelopes or kingdom actor identity.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-010 | A route can be swapped without changing command schemas or kingdom identity. | `packages/model-provider/src/provider-contract.test.ts` — explicit route swap case | Pass. Two provider IDs returned the same tool command; `validateProviderToolCommand` preserved the identical schema version, command ID, product scope, and kingdom subject. |
| PACT-010 | Unsupported models are rejected before a run; missing price is never rendered as zero; failure never silently switches provider or credential. | `packages/model-provider/src/provider-contract.test.ts`; `exerciseProviderContract` | Pass. An undiscovered model failed during prepare; unknown pricing returned the distinct “Provider price unavailable” state; selected-route quota failure surfaced unchanged and never invoked a fallback. Timeout, missing usage, malformed tools, cancellation, and arbitrary-error sanitization also passed. |

Supporting checks: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` (25), and `npm run test:integration` (26) passed under Node.js 24.

## Documentation

- [Provider adapter contract and harness](../../api/provider-adapters.md)
- [Module boundaries](../../architecture/modules.md)
- [Repository package map](../../../README.md)
- [Account and connection specification](../../pact/access.md)
- [Execution contract](../../pact/runtime.md)

## Decisions and limitations

Provider pricing is represented as integer micro-US-dollars per million tokens and calculated with ceiling division; unknown pricing has its own union branch and cannot become numeric zero. Usage can be explicitly unavailable because several provider routes do not guarantee accounting metadata.

The router accepts a decrypted credential only at invocation and returns the original prepared route with the result. Credential ownership/decryption remains `@pact/credential-vault`; command authority remains the shared application dispatcher. Provider-specific HTTP translation and real-provider checks belong to PACT-011 through PACT-015 and the connection acceptance gate.

No provider SDK, network endpoint, live credential, pricing feed, or provider certification was used or claimed.

## Handoff

PACT-010 is complete. PACT-011 through PACT-015 are now dependency-ready provider-specific tickets; they should implement the documented contract with fake HTTP transports before any real-account certification.
