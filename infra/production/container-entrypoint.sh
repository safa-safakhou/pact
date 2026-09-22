#!/bin/sh
set -eu

read_secret() {
  variable="$1"
  path="$2"
  if [ -f "$path" ]; then
    value="$(cat "$path")"
    export "$variable=$value"
  fi
}

read_secret IDENTITY_TOKEN_PEPPER /run/secrets/identity_token_pepper
read_secret IDENTITY_ENCRYPTION_KEY /run/secrets/identity_encryption_key
read_secret SMTP_URL /run/secrets/smtp_url
read_secret TELEGRAM_BOT_ID /run/secrets/telegram_bot_id
read_secret TELEGRAM_BOT_TOKEN /run/secrets/telegram_bot_token
read_secret TELEGRAM_WEBHOOK_SECRET /run/secrets/telegram_webhook_secret

if [ -f /run/secrets/postgres_password ]; then
  postgres_password="$(cat /run/secrets/postgres_password)"
  export DATABASE_URL="postgresql://pact:${postgres_password}@postgres:5432/pact"
fi

exec "$@"
