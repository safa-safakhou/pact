# Private Alpha web controls

The web root at `https://safa.dedyn.io/pact/` is the first human gameplay client. It uses the existing first-party session and CSRF-protected API; it does not run a separate game engine. Use synthetic test accounts only. The registration notice is temporary MVP test data, not a production legal identity. Verification mail is captured inside the VPS, so the operator must deliver each synthetic account's one-time token through a private channel. Do not put passwords or tokens in Git, Linear, screenshots, or logs. See [VPS deployment](vps-deployment.md) and [identity operations](identity.md).

The first text-first release is `alpha-20260926-1` (26 September 2026). The immutable deployment verifier and authenticated API smoke passed. Browser verification so far covers the unauthenticated login screen only; the full two-account workflow remains unobserved.

Sign in, or create and verify a synthetic test account. An unactivated account saves its kingdom name and handle, submits a harmless sandbox echo, records the connection check, and presses **Found kingdom**. Founding is server-idempotent. Returning accounts read `/v1/kingdom/me` and the owner-scoped `/v1/world/kingdoms/:id` view. The browser keeps only the CSRF token in tab session storage; passwords are not persisted. Refreshing the world and inbox uses a 15-second fallback poll plus the authenticated inbox event stream.

The four tabs currently expose:

- **Kingdom:** server balances and versions, buildings, two builder slots, training, upkeep, active contracts, threats, and forecast assumptions.
- **Envoy:** owner inbox, exact approval preview/decision, account export and closure. Manual gameplay does not require a working model provider.
- **People:** public kingdom lookup by ID, contact requests/answers, messages, direct transfers, supply terms and exact-version signing, scouting, garrison lending offers/signing, and raids.
- **Chronicle:** committed event summaries and report lookup by an operation/raid ID from a receipt or inbox event. Event IDs are not report IDs.

Copy the other player's kingdom ID from their own header/receipt. Share offer IDs and versions through a direct message or test channel; do not infer a counterparty's private stock from a public view. Every write is a shared `PactClient.prepareCommand`/`submitCommand` call. The server decides ownership, charges, available stock, locks, action limits, and receipts; a UI disable state is never authorization. On an uncertain network response, reconcile the same command ID before retrying.

This is a work-in-progress PACT-048 surface. It has not passed the required two-player browser walkthrough or a deployed accessibility check. The tab presently requires explicit IDs for counterparties, offers, and reports rather than a browsable discovery/inbox sheet. Server-side social features beyond the Phase 1 rules prototype belong to later tickets. Do not advertise this as a certified public release.

For a harmless authenticated smoke without printing the test password, use `node scripts/smoke-alpha-api.mjs https://safa.dedyn.io/pact/ pact-mvp-owner@example.test /srv/pact/secrets/connection-test/operator_test_password` on the VPS. It reads the host-only password file, signs in through the public origin, checks the owner projection, submits a sandbox echo, reconciles its receipt, and reads the inbox. The command prints only a pass line and kingdom ID.
