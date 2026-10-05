# Optional notifications, moderation and Telegram

Implemented by PACT-060/063/088/089. These features reuse the existing game commands, receipts, account sessions and run lease; they do not alter the economy or initiate inference on message arrival.

## Optional delivery

Players explicitly select email and Web Push categories in Envoy (also available during setup). Defaults are off. Security mail remains transactional. Browser permission is requested only by the player's enable-push button on HTTPS; saving preferences alone does not request permission. Only the authenticated owner can register or revoke endpoints. Revocation removes encrypted endpoint material and cancels pending deliveries. Historical events before opt-in are suppressed.

Critical raid, hungry-upkeep, default/underfunding and expiring-contract events are projected from authoritative game events. The first critical notification is prompt; additional matching subject/category events group for ten minutes. Routine building/training completion and unmuted messages group for ten minutes. Likes and rankings do not send optional alerts. Offline recipients cannot extend deadlines or trigger a model. Notification previews contain generic text and an authenticated inbox URL, without amounts or private prose. The service worker performs navigation only; approval still requires the current exact command and human session.

The notification worker sends SMTP and encrypted standard Web Push outside database transactions. Endpoint domains are allowlisted and validated. HTTP 404/410 clears an invalid push subscription; retry is bounded. Stable SMTP Message-ID and push tags support deduplication. Transport acceptance followed by a process crash can still duplicate an advisory delivery; no network exactly-once claim is made. Delivery records retain thirty days, stale jobs cancel after seven days, and account deletion removes optional recipient data.

Generate VAPID keys with Node 24:
```sh
node infra/production/bin/generate-web-push-keys.mjs /srv/pact/secrets/connection-test
```
The command preserves an existing valid private key and prints only the public key. The private key stays in the mode-0600 `web_push_private_key` secret, mounted only in the notification worker. Set the printed `WEB_PUSH_PUBLIC_KEY` and `WEB_PUSH_SUBJECT=https://YOUR_HOST/pact/` in the deployment environment. A complete matching pair and subject are required for push delivery. Do not put private keys in source, public environment, screenshots or logs. Distribute the public key through the authenticated notification-settings API. Existing subscriptions must be enrolled again after an intentional key rotation. The testing SMTP route is captured Mailpit, not evidence of external email delivery.

## Reports and appeals

Players report already-visible messages, profiles, Chronicle posts, Articles, Court notices/pins and Seal prose from their cards. The server snapshots bounded evidence encrypted at rest, limits reports, and gives the reporter only their own case metadata. Urgent doxxing/threat reports have a 24-hour review target, others 72 hours. These are queue deadlines, not a promise that an unstaffed test deployment meets them.

Platform staff require the platform staff role and actual recent MFA, within five minutes. Court membership is not platform staff authority. Configure staff roles through the existing controlled identity provisioning process, enable TOTP, and log in or reauthenticate with a valid authenticator/recovery code. Telegram-linked sessions do not carry an MFA stamp. Use the English web console in Envoy; preserve original-language evidence. For other-language reports, staff must use an approved translation process and retain the original evidence. No automatic translator or staffed support operation is claimed.

Queue access is metadata only. Staff must claim a case to read its evidence. Claim, access, decisions and reasons are audited. Actions are hide, temporary messaging/play suspension, closure, dismiss, appeal uphold or overturn; there is no staff resource-transfer command. Hiding Seal prose preserves signed data. Overturn restores only the matching unchanged content version. Account closure uses the normal durable privacy deletion workflow, not manual SQL.

Subjects can appeal within fourteen days. A different reviewer must decide the appeal, with a seven-day queue deadline. Closure notices provide a limited one-use appeal capability in the URL fragment. The page removes the fragment from browser history and permits only an appeal submission, without a game session. Never copy this capability into tickets or logs.

Resolved evidence and audit reasons retain 180 days. A hold requires a documented basis, explicit staff access list and review within 90 days; it covers only case evidence and audit records. Assignment alone does not override a hold access list. Holds expire or are explicitly released and audited. Account deletion detaches identities and removes restrictions; required case evidence follows the bounded retention/hold policy. Check queue staffing and translation readiness before recruiting a social pilot. PACT-064 owns the broader privacy/restore matrix; PACT-066 owns real pilot readiness.

## Telegram Mini App

Serve the Mini App at /pact/telegram/ with the pinned Telegram host script and embedding CSP. Its four tabs use shared React features and server rules. Themes, safe areas, stable viewport changes and Back navigation follow the host. Assets and approval/invitation destinations resolve against the parent /pact/ path.

Validate signed, fresh initData on the server. The first link opens authenticated PACT in the external browser for confirmation; passwords and credential forms never appear in the Telegram view. Linked users may exchange a new signed launch for a fresh scoped session. Launch/bootstrap capabilities are single use. Unlink revokes channel sessions and pending bootstraps. Expired sessions clear private views and require a fresh launch before a write; a valid-session permission refusal does not log the player out. Financial/game commitments still use the same current exact-terms human approval and idempotent receipt as web.

Real Telegram mobile/web host certification is separate from the synthetic host/browser and signed-init integration checks recorded in the implementation report.

## Private bot controls

Configure the existing Telegram bot ID, token and webhook secret files. API verifies the secret and normalizes updates; only API and channel worker receive the bot token. Neither has the private model credential decryption key. The channel worker sends configured HTTPS Bot API replies outside transactions, with protected content and no link preview. Token values and raw transport error responses are not logged.

In a linked private chat, /world, /inbox and /status are deterministic reads. /help explains controls. A /run or plain-text objective creates a preview only. The player first saves an explicit active owned model connection, model and bounded allowance in Envoy. Bot objectives are at most 2,000 characters; previews expire after five minutes, with a fifteen-minute run ceiling. No connection or allowance means no start. Bot previews cannot select hidden conversations or approve financial exceptions.

Start requires the delivered original message's one-use callback, bound to link, numeric human sender, private chat, model, objective and limits. Copied, forwarded, expired, repeated and revoked callbacks cannot enqueue another run. Groups, bot-origin messages, inline callbacks and unlinked accounts are rejected. Incoming text, notifications and factual briefings cannot invoke inference. Run creation, callback consumption, webhook deduplication and enqueue commit atomically. /stop uses the shared account takeover operation and releases the PACT lease. External agent hosts must also stop their own host-side execution.

Unlink cancels pending replies/previews and stops runs recorded as bot-origin; unrelated web/MCP runs are not stopped merely by unlinking this channel. Reply and preview contents are encrypted and cleared/pruned by their retention hooks. Transport retries can duplicate an advisory bot message after an uncertain acknowledgment; callbacks still cannot duplicate a run. Real bot chats and paid model execution were not used for this batch.

Native/background delivery adapters, channel measurement/lifecycle work and release certification remain later tickets, not implied by these features.
