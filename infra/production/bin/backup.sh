#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then echo "usage: backup.sh DEPLOY_ENV BACKUP_ENV" >&2; exit 2; fi
deploy_env="$1"
backup_env="$2"
set -a
. "$deploy_env"
. "$backup_env"
set +a

: "${RESTIC_REPOSITORY:?}"
: "${RESTIC_PASSWORD_FILE:?}"
test -f "$RESTIC_PASSWORD_FILE"

local_mount=""
if [ -n "${PACT_LOCAL_BACKUP_DIR:-}" ]; then
  case "$PACT_LOCAL_BACKUP_DIR" in /srv/pact/backups/*) ;; *) echo "invalid local backup directory" >&2; exit 2;; esac
  mkdir -p "$PACT_LOCAL_BACKUP_DIR"
  chmod 700 "$PACT_LOCAL_BACKUP_DIR"
  RESTIC_REPOSITORY=/repository
  export RESTIC_REPOSITORY
  local_mount="-v $PACT_LOCAL_BACKUP_DIR:/repository"
fi

compose="docker compose --env-file $deploy_env -f infra/production/compose.yaml"
$compose exec -T -u postgres postgres sh -eu -c '
  find /var/lib/postgresql/basebackup -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  pg_basebackup -U pact -D /var/lib/postgresql/basebackup/data -Fp -Xs -c fast
'

base_volume="${PACT_COMPOSE_PROJECT:-pact-connection-test}_postgres-basebackup"
wal_volume="${PACT_COMPOSE_PROJECT:-pact-connection-test}_postgres-wal"
docker run --rm \
  -e RESTIC_REPOSITORY -e RESTIC_PASSWORD_FILE=/run/secrets/restic_password \
  ${AWS_ACCESS_KEY_ID:+-e AWS_ACCESS_KEY_ID} ${AWS_SECRET_ACCESS_KEY:+-e AWS_SECRET_ACCESS_KEY} \
  ${B2_ACCOUNT_ID:+-e B2_ACCOUNT_ID} ${B2_ACCOUNT_KEY:+-e B2_ACCOUNT_KEY} \
  -v "$RESTIC_PASSWORD_FILE:/run/secrets/restic_password:ro" $local_mount \
  restic/restic:0.18.0 snapshots >/dev/null 2>&1 || \
docker run --rm \
  -e RESTIC_REPOSITORY -e RESTIC_PASSWORD_FILE=/run/secrets/restic_password \
  ${AWS_ACCESS_KEY_ID:+-e AWS_ACCESS_KEY_ID} ${AWS_SECRET_ACCESS_KEY:+-e AWS_SECRET_ACCESS_KEY} \
  ${B2_ACCOUNT_ID:+-e B2_ACCOUNT_ID} ${B2_ACCOUNT_KEY:+-e B2_ACCOUNT_KEY} \
  -v "$RESTIC_PASSWORD_FILE:/run/secrets/restic_password:ro" $local_mount \
  restic/restic:0.18.0 init
docker run --rm \
  -e RESTIC_REPOSITORY -e RESTIC_PASSWORD_FILE=/run/secrets/restic_password \
  ${AWS_ACCESS_KEY_ID:+-e AWS_ACCESS_KEY_ID} ${AWS_SECRET_ACCESS_KEY:+-e AWS_SECRET_ACCESS_KEY} \
  ${B2_ACCOUNT_ID:+-e B2_ACCOUNT_ID} ${B2_ACCOUNT_KEY:+-e B2_ACCOUNT_KEY} \
  -v "$RESTIC_PASSWORD_FILE:/run/secrets/restic_password:ro" $local_mount \
  -v "$base_volume:/backup/base:ro" -v "$wal_volume:/backup/wal:ro" \
  restic/restic:0.18.0 backup /backup/base /backup/wal --tag pact-postgres-base-wal
docker run --rm \
  -e RESTIC_REPOSITORY -e RESTIC_PASSWORD_FILE=/run/secrets/restic_password \
  ${AWS_ACCESS_KEY_ID:+-e AWS_ACCESS_KEY_ID} ${AWS_SECRET_ACCESS_KEY:+-e AWS_SECRET_ACCESS_KEY} \
  ${B2_ACCOUNT_ID:+-e B2_ACCOUNT_ID} ${B2_ACCOUNT_KEY:+-e B2_ACCOUNT_KEY} \
  -v "$RESTIC_PASSWORD_FILE:/run/secrets/restic_password:ro" $local_mount \
  restic/restic:0.18.0 forget --tag pact-postgres-base-wal --keep-within 35d --prune
