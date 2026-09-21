#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then echo "usage: rollback.sh ENV_FILE" >&2; exit 2; fi
env_file="$1"
set -a
. "$env_file"
. "${PACT_STATE_DIR:-/srv/pact/state}/previous.env"
set +a

docker compose --env-file "$env_file" -f infra/production/compose.yaml up -d --no-build api rules inference notification channel gateway
docker compose --env-file "$env_file" -f infra/production/compose.yaml ps
