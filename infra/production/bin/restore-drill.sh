#!/bin/sh
set -eu

if [ "$#" -ne 3 ]; then echo "usage: restore-drill.sh DEPLOY_ENV BACKUP_ENV SNAPSHOT" >&2; exit 2; fi
deploy_env="$1"
backup_env="$2"
snapshot="$3"
set -a
. "$deploy_env"
. "$backup_env"
set +a

case "$snapshot" in *[!A-Fa-f0-9]*|'') echo "snapshot must be a restic snapshot id" >&2; exit 2;; esac
: "${RESTIC_REPOSITORY:?}"
: "${RESTIC_PASSWORD_FILE:?}"

local_mount=""
if [ -n "${PACT_LOCAL_BACKUP_DIR:-}" ]; then
  case "$PACT_LOCAL_BACKUP_DIR" in /srv/pact/backups/*) ;; *) echo "invalid local backup directory" >&2; exit 2;; esac
  RESTIC_REPOSITORY=/repository
  export RESTIC_REPOSITORY
  local_mount="-v $PACT_LOCAL_BACKUP_DIR:/repository"
fi

drill="pact-restore-drill-${snapshot}"
docker volume create "$drill" >/dev/null
trap 'docker volume rm "$drill" >/dev/null 2>&1 || true' EXIT
docker run --rm \
  -e RESTIC_REPOSITORY -e RESTIC_PASSWORD_FILE=/run/secrets/restic_password \
  ${AWS_ACCESS_KEY_ID:+-e AWS_ACCESS_KEY_ID} ${AWS_SECRET_ACCESS_KEY:+-e AWS_SECRET_ACCESS_KEY} \
  ${B2_ACCOUNT_ID:+-e B2_ACCOUNT_ID} ${B2_ACCOUNT_KEY:+-e B2_ACCOUNT_KEY} \
  -v "$RESTIC_PASSWORD_FILE:/run/secrets/restic_password:ro" $local_mount -v "$drill:/restore" \
  restic/restic:0.18.0 restore "$snapshot" --target /restore
docker run --rm -v "$drill:/restore" alpine:3.22 sh -eu -c '
  test -s /restore/backup/base/data/PG_VERSION
  test -d /restore/backup/wal
'
echo "Encrypted base/WAL snapshot $snapshot restored and structurally verified in an isolated disposable volume."
