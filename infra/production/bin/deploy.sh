#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "usage: deploy.sh ENV_FILE RELEASE_ID" >&2
  exit 2
fi

env_file="$1"
release_id="$2"
case "$release_id" in *[!A-Za-z0-9._-]*|'') echo "invalid release id" >&2; exit 2;; esac

set -a
. "$env_file"
set +a

: "${PACT_SECRETS_DIR:?}"
: "${PACT_ORIGIN:?}"
for secret in postgres_password identity_token_pepper identity_encryption_key model_credential_public.pem model_credential_private.pem smtp_url compromised_password_sha256.txt telegram_bot_id telegram_bot_token telegram_webhook_secret; do
  test -f "$PACT_SECRETS_DIR/$secret" || { echo "missing $PACT_SECRETS_DIR/$secret" >&2; exit 1; }
done

umask 077
state_dir="${PACT_STATE_DIR:-/srv/pact/state}"
mkdir -p "$state_dir/releases"

export PACT_IMAGE="pact-runtime:$release_id"
export PACT_GATEWAY_IMAGE="pact-gateway:$release_id"
docker build --target runtime --build-arg "PACT_WEB_BASE_PATH=${PACT_WEB_BASE_PATH:-/}" --build-arg "PACT_TELEGRAM_BASE_PATH=${PACT_TELEGRAM_BASE_PATH:-/telegram/}" -t "$PACT_IMAGE" .
docker build --target gateway --build-arg "PACT_WEB_BASE_PATH=${PACT_WEB_BASE_PATH:-/}" --build-arg "PACT_TELEGRAM_BASE_PATH=${PACT_TELEGRAM_BASE_PATH:-/telegram/}" -t "$PACT_GATEWAY_IMAGE" .

compose="docker compose --env-file $env_file -f infra/production/compose.yaml"
$compose up -d postgres
$compose run --rm migrate
$compose up -d --remove-orphans api rules inference notification channel gateway

cat >"$state_dir/releases/$release_id.env" <<EOF
PACT_IMAGE=$PACT_IMAGE
PACT_GATEWAY_IMAGE=$PACT_GATEWAY_IMAGE
EOF
if [ -f "$state_dir/current.env" ]; then cp "$state_dir/current.env" "$state_dir/previous.env"; fi
cp "$state_dir/releases/$release_id.env" "$state_dir/current.env"

$compose ps
