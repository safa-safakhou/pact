# Native and Telegram channel authentication

Tickets: [PACT-084 / MNI-85](https://linear.app/mnim/issue/MNI-85/pact-084-prove-native-ios-and-android-login-linking-and-approval), [PACT-085 / MNI-86](https://linear.app/mnim/issue/MNI-86/pact-085-prove-telegram-identity-linking-and-mini-app-authentication)

Implementation revision/PR: local `master` batch; final revision recorded in Git history.

Verification environment: 22 September 2026; macOS arm64; Node.js 24; npm 11; Xcode 26.4 with an iOS 26.4 iPhone 17 Pro simulator; PostgreSQL 17 via local Compose; public single-VPS HTTPS at `https://safa.dedyn.io/pact`. No signed physical-device build or real Telegram bot was available; the host does not have the Android SDK.

## Result

The native Phase 0 application now has a working Expo entry point and screen wired to the single-VPS API. It provides system-browser S256 PKCE login, a preregistered human-only client, exact verified-link callback handling, SecureStore refresh rotation, memory-only access tokens, bearer-authenticated private draft/command/approval routes, duplicate-tap coalescing, foreground restore, and revoke behavior. Android SecureStore backup is disabled in Expo configuration, and UI failures expose stable codes rather than server or platform details.

The Telegram package validates bot-bound `initData`, freshness, numeric identity, private-chat context, one-use account-confirmed bootstrap exchanges, webhook secrets, and update deduplication. The Mini App shell can authenticate, read the private draft, activate the sandbox, review/approve an exact request, and unlink. Unlink immediately revokes channel-created human sessions. No arbitrary bot text performs privileged work.

Both tickets remain blocked at their external certification boundary. The iOS simulator build now compiles and launches the PACT screen, opens the system authorization prompt for `safa.dedyn.io`, and handles cancellation cleanly. The ticket wording still requires signed physical iOS/Android development-build proof and a real operator-owned Telegram bot over public HTTPS.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-084 | Malicious callback, wrong audience, stale approval, duplicate tap, and revoked session fail or return the original receipt | `apps/native/src/session-controller.test.ts`; `apps/native/src/native-api.test.ts`; shared approval integration suite | Local pass. Callback origin/path/state and human audience fail closed; PKCE state is single use; duplicate taps share one promise; server approvals retain receipt idempotency. The iOS simulator opens the correct HTTPS authorization origin. Signed-device stale-approval execution not run. |
| PACT-084 | Credentials stay out of preferences/logs/backups; reopen shows server state without a new run | controller/API tests; `apps/native/app.json`; Xcode simulator build and launch | Local and simulator pass. Only the rotating refresh token reaches SecureStore, access stays in memory, Android backup is disabled, restore calls state load only, and unrecognized failures are sanitized. Xcode 26.4 built the iOS 26.4 simulator app successfully and the screen launched. Physical-device storage inspection and Android execution were not run. |
| PACT-085 | Forged/stale/replayed data, changed usernames, forwarded callbacks, and swapped sessions cannot cross-link accounts | `packages/telegram/src/crypto.test.ts`; `tests/integration/telegram.test.ts` | Pass for local adversarial fixtures. HMAC/age/duplicate-key/group checks fail closed; numeric-ID uniqueness defeats handle changes; bootstrap ownership and replay are enforced. Real Telegram launch not run. |
| PACT-085 | Unlink revokes sessions; Telegram handle/message text grants no game privilege | `tests/integration/telegram.test.ts`; `packages/telegram/src/service.ts` | Pass locally. The issued channel session becomes forbidden immediately; webhook results always report `privilegedAction: false`; group chat is denied. Live bot/webhook proof not run. |

Supporting checks: `npm run lint`; `npm run typecheck`; `npm test`; `npm run test:integration`; `npm run smoke`; `npm run build`; planning render/check and `git diff --check`.

## Documentation

- [Channel authentication API and setup](../../api/channel-authentication.md)
- [Native application](../../../apps/native/README.md)
- [Telegram Mini App](../../../apps/telegram/README.md)
- [Database operations](../../operations/database.md)

## Decisions and limitations

Both clients target the same single VPS origin; no AWS or additional managed infrastructure was introduced. Native bearer access is restricted to the preregistered `pact-native` human audience, while Telegram converts a confirmed numeric-ID link into the existing cookie/CSRF human-session model. Telegram usernames remain non-authoritative display metadata.

PACT-084 blocker: the Apple team ID, signed physical iOS build/device evidence, Android SDK/signing-certificate fingerprint, signed Android build/device evidence, and hostname-root association files are unavailable. PACT-085 blocker: the Mini App and webhook are publicly routed on the VPS, but no operator-owned bot token is configured. The repository therefore must not advertise either ticket as certified or Done.

## Handoff

Provide Apple signing/team access plus an iOS device, and Android SDK/signing access plus an Android device, to close PACT-084. Provide a test Telegram bot token to close PACT-085; the VPS HTTPS route already exists. Then run the documented account → draft → sandbox command → exact approval → duplicate → revoke matrix on each surface and attach sanitized evidence before moving either Linear issue to Done.
