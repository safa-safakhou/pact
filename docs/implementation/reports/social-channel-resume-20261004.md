# Resumed social/channel roadmap - 4 October 2026

Founder selected the original Later roadmap. This batch implements PACT-060/MNI-125, PACT-063/MNI-128, PACT-088/MNI-132 and PACT-089/MNI-133 without narrowing their original acceptance. Other unfinished roadmap tickets remain separate. Source is the existing extensively dirty, uncommitted checkout; no hosted CI, commit, PR or paid provider run is claimed.

## Acceptance evidence

| Ticket | Result and evidence |
| --- | --- |
| PACT-060 | Opt-in defaults/revocation, category and ownership policy, encrypted endpoint registration, generic authenticated previews, first-critical and ten-minute grouping, retries/deduplication, endpoint invalidation and retention. Tests: notifications integration, notification routes/policy. Incoming/offline alerts do not change game deadlines or enqueue inference; service-worker clicks are authenticated navigation only. SMTP/Web Push adapters are implemented; transports are fixture tested. |
| PACT-063 | Reporter-visible encrypted evidence; recent real MFA and assigned-case staff access; urgent/ordinary deadlines; audit reasons, scoped holds and bounded retention; hide/suspend/closure/appeal. Seven moderation integration tests include seeded doxxing/abuse across public content types, unchanged Seal signatures, no staff asset effects, real privacy closure, one-use post-closure appeal, separate appeal reviewer, hold expiry and 180-day purge. API tests cover origin, CSRF, ownership, agent denial and forbidden transfer requests. Shared API and inference command paths enforce sanctions. |
| PACT-088 | Shared four-tab Mini App with validated first linking and renewed launches, canonical parent assets/destinations, host themes/safe areas/Back and session expiry. Integration uses actual SupplyOffer/ledger/contracts/shared dispatcher: web offer, Telegram exact-term approval and web retry produce one contract/receipt/signature. Browser host fixtures at 390 and 1440 pixels exercise retained approval destination, Back navigation, reports/appeals and session expiry, with no page errors or overflow. Real Telegram device certification is not claimed. |
| PACT-089 | Deterministic linked private-chat commands and encrypted preview/reply outboxes; explicit owned model/allowance plus delivered-message-bound one-use confirmation. Five bot integration tests cover groups/bots/forwarding/unlinked users, callback copies/repeats/expiry/revocation, one run/job, shared MCP lease and /stop, rollback/retry and offline acknowledgments. Two delivery unit tests cover configured endpoint/protected markup/error sanitization. No message or notification starts a model; chat cannot approve game exceptions. No real bot message or paid inference was used. |

Owned migrations 0046-0050 cover optional notifications, game projection, MFA session stamps, moderation cases and Telegram bot controls. Module retention hooks are composed into API privacy handling. Public v1 contracts remain unchanged.

## Verification

Final local checks passed:
- npm run typecheck
- npm run lint, including package boundaries/build order and 26 published v1 schemas
- npm test: 278 passed
- npm run test:integration: 315 passed, one existing skipped test, 50 test files
- npm run build: all packages and processes, web/native/Telegram
- Nested Telegram build with PACT_TELEGRAM_BASE_PATH=/pact/telegram/
- Browser fixtures at phone/desktop sizes: reports, appeals, scoped denial keeps session, expiry clears private views, host Back, canonical destination, no password entry, no overflow or browser errors

Browser artifacts: [results](evidence/social-channel-browser-20261004.json), [phone](evidence/social-channel-phone-20261004.png), [desktop](evidence/social-channel-desktop-20261004.png), [reproducible harness](evidence/social-channel-browser-harness.txt). These use synthetic Telegram host/HTTP fixtures; integration tests separately exercise real game/database handlers.

API routes: [social/channel additions](../../api/social-channels.md). Local check counts and dependency audit: [results](evidence/social-channel-local-checks-20261004.json).

Operational instructions: [social channels](../../operations/social-channels.md). VAPID provisioning generates its own key pair without external accounts or paid tools. Optional delivery is consent-based. SMTP/Telegram network acknowledgment can be uncertain after a crash, so advisory delivery is at least once; game receipts and explicit run creation remain idempotent.

The supplementary production-dependency audit reports 23 advisories (16 high, seven moderate), in the existing unchanged Expo/React Native ecosystem and its tools. It reports none for the added Web Push dependencies. Audit remediation and actual native release certification remain outstanding; no clean-audit claim is made.

## Testing deployment

Verified testing release **social-channel-20261004-2**, https://safa.dedyn.io/pact/. The initial rollout exposed a missing telegramBot argument in API composition (run-settings returned 404); the explicit wiring fix was followed by a full passing regression rerun and replacement deployment. The endpoint now returns authenticated 403/no-store anonymously, matching notifications and moderation.

- Encrypted Restic pre-batch database/WAL snapshot 9ac803f7; before replacement release, snapshot 3ea60253. This database backup script does not back up operator secret files; VAPID provisioning is recorded separately.
- Uploaded source archive SHA-256 65287d303f7c9802afdb99cf86942bffbc6258bf3c717a8400d7549e4461d196 matched on VPS. The archive contains the final implementation and preceding report state; completion documentation/tracker evidence is a subsequent metadata-only source overlay.
- Docker build with Node 24.21.0 passed for runtime and gateway. Migrations through 0050 applied; deletion registry replay completed before API traffic.
- Deployment verification passed: readiness, public web/Telegram, pinned SDK/nested asset path/embedding CSP, no PostgreSQL host listener, private model key limited to inference, bot token limited to API/channel, SMTP/private VAPID key limited to notification, Mailpit unexposed, no-store setup.
- All seven application/gateway services running with zero restarts. Live paid model configuration remains PACT_ENABLE_LIVE_MODEL_CALLS=0. Telegram configuration files and the generated VAPID pair are present; no token or private key is included in evidence and no actual Bot API/token validation is claimed.
- [Public checks](evidence/social-channel-public-20261004.json), [service/configuration metadata](evidence/social-channel-server-20261004.json).
- [Actual served appeal-page check](evidence/social-channel-live-appeal-20261004.json) loads the deployed bundle, with a synthetic appeal response: fragment stripped, one bounded submission, submit then disabled, no overflow/page errors. This is not a real moderation case or human playtest.

Operator logs: /srv/pact/state/operator/social-channel-{backup,deploy,verify}-20261004.log. Host-only deployment environment/secrets and the shared AgenticWorld host routes were preserved. No commits, pushes or PRs were created.

## Remaining scope

Real browser push receipt, actual Telegram device/chat behavior, staffed moderation/translation, hosted CI and independent human pilots are not inferred from fixtures. Original downstream PACT-064/065/090-092 and release/pilot gates remain unfinished. Existing testing inference stays disabled unless explicitly exercised later with bounded cheap-model settings.

## Tracker reconciliation

All four issues freshly read back Done with checked original acceptance, assignee and completed milestone. Full project readback: 126 issues, **102 Done / 24 Backlog**, no further page. [Evidence](evidence/social-channel-linear-final-20261004.json). Local tasks/map and generated views reconciled. Next dependency-ready: PACT-064; PACT-065 follows. PACT-090 retains its original APNs/Firebase/device prerequisites.
