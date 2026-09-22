# Telegram Mini App authentication proof

This compact Vite shell reads only Telegram's signed `initData` string and sends it to the PACT VPS for validation. The server creates a normal human cookie session only after the player opens **Confirm in PACT**, signs in on the shared web origin, and confirms the expiring bootstrap. After returning to Telegram, **Exchange confirmed link** creates the channel session. The shell can then read the private setup draft, activate the sandbox fixture, and review/approve an exact pending approval through the same server routes as web.

The shell never trusts `initDataUnsafe`, usernames, message text, or callback data as authority. Bot webhooks are separately authenticated and deduplicated by the API adapter; version 1 rejects group-chat control paths.

```sh
npm run build --workspace @pact/telegram-app
npm run dev --workspace @pact/telegram-app
```

The deployed `/pact/telegram/` build derives its API and confirmation URLs from the parent `/pact/` origin. Set `VITE_PACT_ORIGIN` only when the API uses a different development origin. The MVP bot opens the deployed Mini App at `https://safa.dedyn.io/pact/telegram/`; its token and webhook secret stay in root-readable VPS secret files and are never bundled into this client.
