#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then echo "usage: verify.sh DEPLOY_ENV PUBLIC_BASE_URL" >&2; exit 2; fi
deploy_env="$1"
public_base_url="${2%/}"
set -a
. "$deploy_env"
set +a

compose="docker compose --env-file $deploy_env -f infra/production/compose.yaml"
if [ -n "${PACT_COMPOSE_OVERRIDE_FILE:-}" ]; then
  compose="$compose -f $PACT_COMPOSE_OVERRIDE_FILE"
fi
$compose ps --status running --services | grep -qx api
$compose ps --status running --services | grep -qx mailpit
$compose ps --status running --services | grep -qx notification
$compose ps --status running --services | grep -qx postgres
curl -fsS "http://127.0.0.1:${PACT_LOOPBACK_PORT:-8088}/ready" >/dev/null
curl -fsS "$public_base_url/health" >/dev/null
curl -fsS "$public_base_url/v1/legal/registration-status" | grep -Eq '"registrationEnabled":(true|false)'
curl -fsS "$public_base_url/" >/dev/null
telegram_html="$(curl -fsS "$public_base_url/telegram/")"
printf '%s' "$telegram_html" | grep -Fq 'https://telegram.org/js/telegram-web-app.js?63'
printf '%s' "$telegram_html" | grep -Fq "${PACT_TELEGRAM_BASE_PATH:-/pact/telegram/}assets/"
telegram_headers="$(curl -fsS -D - -o /dev/null "$public_base_url/telegram/" | tr -d '\r')"
if printf '%s\n' "$telegram_headers" | grep -qi '^x-frame-options:'; then
  echo "Telegram Mini App unexpectedly denies framing" >&2
  exit 1
fi
printf '%s\n' "$telegram_headers" | grep -Fqi \
  'content-security-policy: frame-ancestors https://web.telegram.org https://*.web.telegram.org'

if ss -lnt | grep -Eq '(^|[[:space:]])[^[:space:]]*:5432[[:space:]]'; then
  echo "PostgreSQL unexpectedly has a host listener" >&2
  exit 1
fi

private_destination=/run/secrets/model_credential_private_key
for service in api rules notification channel; do
  container="$(${compose} ps -q "$service")"
  if docker inspect "$container" --format '{{range .Mounts}}{{println .Destination}}{{end}}' | grep -qx "$private_destination"; then
    echo "$service can read the private model credential key" >&2
    exit 1
  fi
done
inference="$(${compose} ps -q inference)"
docker inspect "$inference" --format '{{range .Mounts}}{{println .Destination}}{{end}}' | grep -qx "$private_destination"

telegram_destination=/run/secrets/telegram_bot_token
api="$(${compose} ps -q api)"
docker inspect "$api" --format '{{range .Mounts}}{{println .Destination}}{{end}}' | grep -qx "$telegram_destination"
for service in rules inference notification; do
  container="$(${compose} ps -q "$service")"
  if docker inspect "$container" --format '{{range .Mounts}}{{println .Destination}}{{end}}' | grep -qx "$telegram_destination"; then
    echo "$service can read the Telegram bot token" >&2
    exit 1
  fi
done

channel="$(${compose} ps -q channel)"
docker inspect "$channel" --format '{{range .Mounts}}{{println .Destination}}{{end}}' | grep -qx "$telegram_destination"

push_destination=/run/secrets/web_push_private_key
notification="$(${compose} ps -q notification)"
docker inspect "$notification" --format '{{range .Mounts}}{{println .Destination}}{{end}}' | grep -qx "$push_destination"
for service in api rules inference channel; do
  container="$(${compose} ps -q "$service")"
  if docker inspect "$container" --format '{{range .Mounts}}{{println .Destination}}{{end}}' | grep -qx "$push_destination"; then
    echo "$service can read the private Web Push key" >&2
    exit 1
  fi
done

smtp_destination=/run/secrets/smtp_url
notification="$(${compose} ps -q notification)"
docker inspect "$notification" --format '{{range .Mounts}}{{println .Destination}}{{end}}' | grep -qx "$smtp_destination"
for service in api rules inference channel; do
  container="$(${compose} ps -q "$service")"
  if docker inspect "$container" --format '{{range .Mounts}}{{println .Destination}}{{end}}' | grep -qx "$smtp_destination"; then
    echo "$service can read the SMTP URL" >&2
    exit 1
  fi
done

mailpit="$(${compose} ps -q mailpit)"
test "$(docker inspect "$mailpit" --format '{{json .HostConfig.PortBindings}}')" = "{}"

cache_header="$(curl -sSI "$public_base_url/v1/setup/draft" | tr -d '\r' | sed -n 's/^cache-control:[[:space:]]*//Ip' | head -1)"
test "$cache_header" = "no-store"
echo "PACT deployment verification passed."
