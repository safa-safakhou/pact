# Setup UI features

Ticket: PACT-023.

`@pact/ui-features` provides reusable English setup screens for account/security, private draft, provider selection, credentials, model choice, allowance confirmation, Envoy run controls, and the approval inbox. Components accept injected props and callbacks; they do not hard-code `fetch` to a local API. Host shells own cookies, CSRF, and transport (for example `createWebPactClient` in `apps/web`).

## Hosting

1. Depend on `@pact/ui-features` and React 19.
2. Import `SetupFlow` and ensure `setup.css` is loaded (the package exports `./setup.css`; `SetupFlow` also imports it).
3. Pass the current `SetupStep`, invitation fields from URL `invite` / `destination`, and server-hydrated draft/run/approval props on reopen.
4. Wire callbacks to application commands through the host SDK adapter. Telegram Mini Apps can reuse the same components with a different shell.

Platform-independent copy and status mapping live in `@pact/client-sdk` (`toRunStatusLabel`, `toPricingMessage`, `toSetupErrorMessage`, `buildSetupSnapshot`) so native clients can share behavior without DOM.
