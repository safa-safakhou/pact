# Shared client SDK and capability contract

Ticket: PACT-083.

`@pact/client-sdk` is the platform-independent TypeScript boundary used by web and future non-browser clients. It depends only on `@pact/contracts` and injected clock, command-ID, request, and event-subscription ports. The package does not import browser, React Native, Expo, Telegram, or Node runtimes.

## Version and capabilities

Clients send `x-pact-api-version: pact.api.v1`. An explicit unsupported version returns HTTP 426 with `UNSUPPORTED_API_VERSION`; omitted versions remain accepted for pre-SDK compatibility. `GET /v1/capabilities?audience=human|agent` publishes the API, command, event, and MCP protocol versions plus audience-specific capabilities. Human metadata includes `approval.commit`; agent metadata includes `mcp.tools` and only the OAuth scopes `world:read`, `messages:write`, and `game:act`.

## Command retry contract

Prepare a command once with `prepareCommand`, then pass that immutable object to `submitCommand`. If delivery is uncertain, call `retryCommand` with the same prepared object or `reconcileReceipt` with its command ID. Retry never generates a replacement ID or changes scopes. The server derives the effective actor from authenticated credentials and ignores the SDK's non-owning wire sentinel.

Host adapters own authentication. The web adapter in `apps/web/src/pact-client.ts` uses cookie credentials and attaches the current CSRF token; browsers provide the exact configured Origin. Native, Telegram, and test adapters implement the same small transport interface without moving credentials into the shared package.

## Projections and subscriptions

Receipt and inbox payloads are validated against the shared schemas before becoming platform-independent view models. `readInbox` uses cursor pagination. `subscribeInbox` consumes an injected async event stream, allowing browser SSE and native/Telegram polling adapters to share event projections without importing host globals.

## Setup view models

`SetupStep`, `toRunStatusLabel`, `toPricingMessage`, `toSetupErrorMessage`, `readInvitationDestination`, and `buildSetupSnapshot` map connection-setup server state into host-neutral labels and messages. Native and DOM hosts share these helpers; unknown pricing never becomes a zero cost, and run statuses map only to Working, Waiting, or Stopped.
