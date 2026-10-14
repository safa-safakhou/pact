#!/bin/sh
# Narrow API/gateway release for already verified, prebuilt administrator images.
set -eu
if [ "$#" -ne 2 ]; then echo "usage: release-prebuilt-admin.sh ENV_FILE RELEASE_ID" >&2; exit 2; fi
env_file="$1"
release_id="$2"
case "$release_id" in *[!A-Za-z0-9._-]*|'') echo "invalid release id" >&2; exit 2;; esac
set -a
. "$env_file"
set +a
state_dir="${PACT_STATE_DIR:-/srv/pact/state}"
test -f "$state_dir/current.env"
export PACT_IMAGE="pact-runtime:$release_id"
export PACT_GATEWAY_IMAGE="pact-gateway:$release_id"
docker image inspect "$PACT_IMAGE" "$PACT_GATEWAY_IMAGE" >/dev/null
compose="docker compose --env-file $env_file -f infra/production/compose.yaml"
if [ -n "${PACT_COMPOSE_OVERRIDE_FILE:-}" ]; then compose="$compose -f $PACT_COMPOSE_OVERRIDE_FILE"; fi
umask 077
mkdir -p "$state_dir/releases"
cp "$state_dir/current.env" "$state_dir/releases/before-$release_id.env"
$compose run --rm --no-deps migrate
$compose run --rm --no-deps privacy-replay
$compose up -d --no-deps api gateway
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if curl -fsS "http://127.0.0.1:${PACT_LOOPBACK_PORT:-8088}/ready" >/dev/null; then break; fi
  if [ "$attempt" = 12 ]; then echo "API readiness failed; retained before-release images are available" >&2; exit 1; fi
  sleep 2
done
cat >"$state_dir/releases/$release_id.env" <<EOF
PACT_IMAGE=$PACT_IMAGE
PACT_GATEWAY_IMAGE=$PACT_GATEWAY_IMAGE
EOF
cp "$state_dir/releases/before-$release_id.env" "$state_dir/previous.env"
cp "$state_dir/releases/$release_id.env" "$state_dir/current.env"
$compose ps
