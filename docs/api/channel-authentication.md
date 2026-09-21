# Native and Telegram channel authentication

## Native

The first-party Expo client uses `pact-native`, a preregistered human-audience OAuth client. The production redirect is the exact verified HTTPS app link `${PACT_ORIGIN}/native/callback`. `/oauth/authorize` presents a system-browser sign-in/consent page and issues a single-use authorization code protected by S256 PKCE. The client stores the rotating refresh token in Expo SecureStore and holds the access token only in process memory.

Human bearer tokens are accepted only by `/v1/native/*`, only when their client, audience, and required scope match:

- `GET /v1/native/draft` requires `world:read`.
- `POST /v1/native/commands` requires `game:act` and uses the shared command dispatcher.
- `GET /v1/native/approvals/:approvalId` requires `world:read`.
- `POST /v1/native/approvals/:approvalId/approve` requires `game:act` and commits through the shared approval service. Duplicate commits return its stored receipt.

Before device use, replace the placeholder app-link host in `apps/native/app.json`, publish Apple/Android association files from the VPS origin, and create signed development builds. Do not add access tokens to logs, preferences, AsyncStorage, or backups.

## Telegram

Configure `TELEGRAM_BOT_ID`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_WEBHOOK_SECRET` together. The API does not mount Telegram routes unless the complete set is present.

The link sequence is deliberately two-party:

1. The Mini App sends its raw `initData` to `POST /v1/telegram/bootstrap`.
2. The API verifies the bot-bound HMAC, numeric Telegram user ID, private-chat context, five-minute age, and launch uniqueness, then returns an expiring opaque bootstrap token.
3. An existing PACT cookie session confirms that token with `POST /v1/telegram/link/confirm` and normal Origin/CSRF checks.
4. The same validated launch exchanges the confirmed token once at `POST /v1/telegram/session`. The response sets an HttpOnly human cookie and returns its CSRF token.
5. `POST /v1/telegram/unlink` revokes all human sessions created by that Telegram link immediately.

`POST /telegram/webhook` separately verifies `X-Telegram-Bot-Api-Secret-Token`, rejects group-chat commands, and deduplicates `update_id`. Accepted message text has no direct game privilege; later bot commands must create explicit previews and confirmations.

Usernames are display metadata only. Ownership remains bound to the numeric Telegram user ID. Raw update bodies are not stored; migration `0015_telegram_channel.sql` stores link/session metadata and deduplication IDs.
