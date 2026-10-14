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
if [ -n "${PACT_COMPOSE_OVERRIDE_FILE:-}" ]; then
  compose="$compose -f $PACT_COMPOSE_OVERRIDE_FILE"
fi

# A local repository and the temporary base copy share the host disk. Refuse a
# new copy before it can exhaust the space needed by the live database. Keep
# every encrypted snapshot; capacity changes need an operator decision.
if [ -n "${PACT_LOCAL_BACKUP_DIR:-}" ]; then
  available_kb="$(df -Pk "$PACT_LOCAL_BACKUP_DIR" | awk 'NR==2 {print $4}')"
  data_kb="$($compose exec -T -u postgres postgres du -sk /var/lib/postgresql/data | awk '{print $1}')"
  required_kb="$((data_kb * 2 + 1048576))"
  if [ "$available_kb" -lt "$required_kb" ]; then
    echo "BACKUP_CAPACITY_REQUIRED: ${available_kb} KiB free; ${required_kb} KiB required for base copy, repository growth and live database headroom. Add storage before retrying; encrypted snapshots are preserved." >&2
    exit 1
  fi
fi
$compose exec -T -u postgres postgres sh -eu -c '
  find /var/lib/postgresql/basebackup -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  pg_basebackup -U pact -D /var/lib/postgresql/basebackup/data -Fp -Xs -c fast
'

base_volume="${PACT_COMPOSE_PROJECT:-pact-connection-test}_postgres-basebackup"
wal_volume="${PACT_COMPOSE_PROJECT:-pact-connection-test}_postgres-wal"
# Archived WAL is immutable once PostgreSQL finishes copying a segment. Mark the
# files present before the Restic snapshot so later archives cannot be pruned.
wal_cutoff="$($compose exec -T -u postgres postgres sh -c 'mktemp /var/lib/postgresql/wal-archive/.pact-backup-cutoff.XXXXXX')"
cleanup_cutoff() {
  $compose exec -T -u postgres postgres rm -f -- "$wal_cutoff" || true
}
trap cleanup_cutoff EXIT
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

# The completed base backup streams its required WAL (-Xs), and the Restic
# snapshot now contains every older archived segment. Keep newer files for the
# next point-in-time backup; never remove the live data volume or active pg_wal.
$compose exec -T -u postgres postgres sh -c '
  find /var/lib/postgresql/wal-archive -maxdepth 1 -type f \
    -name "????????????????????????" ! -newer "$1" -delete
' sh "$wal_cutoff"

# Restic backup and retention have both succeeded under set -e. This temporary
# copy is recreated by the next pg_basebackup; keep the encrypted repository,
# live data and newer WAL intact instead of retaining a duplicate on the disk.
$compose exec -T -u postgres postgres sh -eu -c '
  test -f /var/lib/postgresql/basebackup/data/backup_manifest
  test -f /var/lib/postgresql/basebackup/data/PG_VERSION
  rm -rf -- /var/lib/postgresql/basebackup/data
'
