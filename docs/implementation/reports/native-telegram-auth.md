# Native and Telegram channel authentication

Tickets: [PACT-084 / MNI-85](https://linear.app/mnim/issue/MNI-85/pact-084-prove-native-ios-and-android-login-linking-and-approval), [PACT-085 / MNI-86](https://linear.app/mnim/issue/MNI-86/pact-085-prove-telegram-identity-linking-and-mini-app-authentication)

Implementation revision/PR: local `master` batch; final revision recorded in Git history.

Verification environment: 22 September 2026; macOS arm64; Node.js 24; npm 11; Xcode 26.4 with an iOS 26.4 iPhone 17 Pro simulator; PostgreSQL 17; public single-VPS HTTPS at `https://safa.dedyn.io/pact`; operator-supplied Telegram test bot. The host does not have the Android SDK.

## Result

The native Phase 0 application now has a working Expo entry point and screen wired to the single-VPS API. It provides system-browser S256 PKCE login, a preregistered human-only client, exact verified-link callback handling, SecureStore refresh rotation, memory-only access tokens, bearer-authenticated private draft/command/approval routes, duplicate-tap coalescing, foreground restore, and revoke behavior. Android SecureStore backup is disabled in Expo configuration, and UI failures expose stable codes rather than server or platform details.

The Telegram package validates bot-bound `initData`, freshness, numeric identity, private-chat context, one-use account-confirmed bootstrap exchanges, webhook secrets, and update deduplication. The deployed Mini App derives API calls from the shared `/pact/` root, opens a signed-in web confirmation screen for its opaque bootstrap, and returns the player to a one-use session exchange. The shell can then read the private draft, activate the sandbox, review/approve an exact request, and unlink. Unlink immediately revokes channel-created human sessions. No arbitrary bot text performs privileged work.

Version 1.3 deliberately moves signed physical iOS/Android certification to the Season One release milestone, so PACT-084 is no longer an MVP gate. The supplied Telegram bot is configured with the public Mini App, an authenticated webhook, and an internal root-readable secret set. Releases `mvp-20260922-2` through `mvp-20260922-4` established the signed synthetic flow, sandbox activation, official bridge, webhook behavior, and narrowly scoped Telegram framing policy. Release `mvp-20260922-5` corrected bot-token HMAC validation for Telegram's current `signature` field. Release `mvp-20260922-6` uses a secure partitioned cookie for Telegram Web's third-party iframe. The real Telegram Web client then completed account link, private draft read, sandbox activation, exact approval, a duplicate approval returning the identical receipt, unlink, and a database check showing zero active channel sessions. PACT-085 is complete.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-084 | Malicious callback, wrong audience, stale approval, duplicate tap, and revoked session fail or return the original receipt | `apps/native/src/session-controller.test.ts`; `apps/native/src/native-api.test.ts`; shared approval integration suite | Local pass. Callback origin/path/state and human audience fail closed; PKCE state is single use; duplicate taps share one promise; server approvals retain receipt idempotency. The iOS simulator opens the correct HTTPS authorization origin. Signed-device stale-approval execution not run. |
| PACT-084 | Credentials stay out of preferences/logs/backups; reopen shows server state without a new run | controller/API tests; `apps/native/app.json`; Xcode simulator build and launch | Local and simulator pass. Only the rotating refresh token reaches SecureStore, access stays in memory, Android backup is disabled, restore calls state load only, and unrecognized failures are sanitized. Xcode 26.4 built the iOS 26.4 simulator app successfully and the screen launched. Physical-device storage inspection and Android execution were not run. |
| PACT-085 | Forged/stale/replayed data, changed usernames, forwarded callbacks, and swapped sessions cannot cross-link accounts | `packages/telegram/src/crypto.test.ts`; `tests/integration/telegram.test.ts`; `25a4d2a`; live test bot | Pass. Adversarial fixtures reject forged, stale, replayed, swapped, and group launches. The real client accepted Telegram's current signed payload, and a launch older than five minutes was rejected before a fresh launch completed the link. |
| PACT-085 | Unlink revokes sessions; Telegram handle/message text grants no game privilege | `tests/integration/telegram.test.ts`; `packages/telegram/src/service.ts`; `28ead74`; releases `mvp-20260922-5` and `mvp-20260922-6` | Pass. Telegram Web read the private draft, activated the sandbox, approved the exact action twice with one identical committed receipt, and unlinked. The post-unlink database check found two historical channel sessions and zero active sessions. Webhook message text remained non-privileged. |

The account-link UI adds focused URL and transport coverage in `apps/telegram/src/urls.test.ts` and `apps/web/src/telegram-link.test.ts`. `services/api/src/telegram-routes.test.ts` verifies that Telegram-issued and cleared cookies retain the secure partitioned attributes required by Telegram Web. These checks prove that the nested Mini App resolves API calls to `/pact/v1`, only API-sized bootstraps reach the confirmation form, sign-in precedes confirmation, and the returned CSRF token is carried on the link write.

Supporting checks: `npm run lint`; `npm run typecheck`; `npm test`; `npm run test:integration`; `npm run smoke`; `npm run build`; planning render/check and `git diff --check`.

## Documentation

- [Channel authentication API and setup](../../api/channel-authentication.md)
- [Native application](../../../apps/native/README.md)
- [Telegram Mini App](../../../apps/telegram/README.md)
- [Database operations](../../operations/database.md)

## Decisions and limitations

Both clients target the same single VPS origin; no AWS or additional managed infrastructure was introduced. Native bearer access is restricted to the preregistered `pact-native` human audience, while Telegram converts a confirmed numeric-ID link into the existing cookie/CSRF human-session model. Telegram usernames remain non-authoritative display metadata.

PACT-084 is deferred, not falsely certified: its implementation and simulator evidence remain, while Apple/Android spending and physical-device work resume in L06. PACT-085 has no remaining blocker. The walkthrough used only the designated synthetic MVP account and test bot. A revoked synthetic link fixture was removed before the real-client run; no real player data was introduced.

## Handoff

Keep PACT-084 in the Season One release backlog. PACT-085 is ready for Linear completion. Recompute the dependency-ready queue after synchronization; do not treat deferred native signing as an MVP blocker.
