#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then echo "usage: rollback.sh ENV_FILE" >&2; exit 2; fi
env_file="$1"
set -a
. "$env_file"
. "${PACT_STATE_DIR:-/srv/pact/state}/previous.env"
set +a

compose="docker compose --env-file $env_file -f infra/production/compose.yaml"
if [ -n "${PACT_COMPOSE_OVERRIDE_FILE:-}" ]; then
  compose="$compose -f $PACT_COMPOSE_OVERRIDE_FILE"
fi

# Older images predate the signing entry point. Stop only this worker; queued Seals remain durable.
$compose stop seals
$compose up -d --no-build api rules inference notification channel gateway
if docker run --rm --entrypoint test "$PACT_IMAGE" -f /app/workers/rules/dist/seal-main.js; then
  $compose up -d --no-build seals
fi
$compose ps
