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

available_kib=$(df -Pk /var/lib/docker | awk 'NR == 2 {print $4}')
if [ "$available_kib" -lt 2097152 ]; then
  echo "restore drill requires at least 2 GiB free on the Docker filesystem" >&2
  exit 1
fi

drill=$(docker volume create)
recovered_data=$(docker volume create)
recovered_container="pact-restore-drill-${drill}"
cleanup() {
  docker rm -f "$recovered_container" >/dev/null 2>&1 || true
  docker volume rm "$recovered_data" >/dev/null 2>&1 || true
  docker volume rm "$drill" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
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
docker run --rm --network none --entrypoint pg_verifybackup \
  -v "$drill:/restore:ro" postgres:17.11-alpine /restore/backup/base/data >/dev/null
docker run --rm --network none --entrypoint sh \
  -v "$drill:/restore:ro" -v "$recovered_data:/var/lib/postgresql/data" \
  postgres:17.11-alpine -eu -c '
    cp -a /restore/backup/base/data/. /var/lib/postgresql/data/
    chown -R postgres:postgres /var/lib/postgresql/data
    chmod 700 /var/lib/postgresql/data
  '
docker run -d --network none --name "$recovered_container" \
  -v "$recovered_data:/var/lib/postgresql/data" -v "$drill:/restore:ro" \
  postgres:17.11-alpine postgres -c archive_mode=off \
  -c 'restore_command=cp /restore/backup/wal/%f %p' >/dev/null

attempt=0
until docker exec -u postgres "$recovered_container" pg_isready -q -U pact -d pact >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 45 ] || [ "$(docker inspect -f '{{.State.Running}}' "$recovered_container")" != true ]; then
    echo "isolated PostgreSQL recovery did not become ready" >&2
    exit 1
  fi
  sleep 1
done

database_state=$(docker exec -u postgres "$recovered_container" \
  psql -X -v ON_ERROR_STOP=1 -U pact -d pact -Atqc \
  "SELECT current_setting('server_version_num')::int / 10000, pg_is_in_recovery(),
    to_regclass('public.command_receipts') IS NOT NULL,
    to_regclass('public.outbox_events') IS NOT NULL")
if [ "$database_state" != '17|f|t|t' ]; then
  echo "isolated PostgreSQL recovery failed schema/version checks" >&2
  exit 1
fi

game_tables=$(docker exec -u postgres "$recovered_container" \
  psql -X -v ON_ERROR_STOP=1 -U pact -d pact -Atqc \
  "SELECT to_regclass('public.resource_balances') IS NOT NULL AND
    to_regclass('public.resource_movements') IS NOT NULL AND
    to_regclass('public.kingdom_troops') IS NOT NULL")
if [ "$game_tables" = t ]; then
  mismatches=$(docker exec -u postgres "$recovered_container" \
    psql -X -v ON_ERROR_STOP=1 -U pact -d pact -Atqc \
    "WITH journal AS (
       SELECT product_scope, kingdom_id, resource,
         sum(ordinary_delta) AS ordinary, sum(allowance_delta) AS allowance,
         sum(locked_delta) AS locked
       FROM resource_movements GROUP BY product_scope, kingdom_id, resource
     )
     SELECT count(*) FROM resource_balances b LEFT JOIN journal j
       USING (product_scope, kingdom_id, resource)
     WHERE b.ordinary_units <> coalesce(j.ordinary, 0)
       OR b.allowance_units <> coalesce(j.allowance, 0)
       OR b.locked_units <> coalesce(j.locked, 0)")
  if [ "$mismatches" != 0 ]; then
    echo "recovered game balances disagree with their movement journal" >&2
    exit 1
  fi
  echo "Recovered game balances reconcile with their movement journal."
else
  echo "Gameplay tables are absent from this older snapshot; game-state recovery is not certified."
fi

# Replay only synthetic data in the isolated copy. The production database is
# never mounted into this container and is never written by the drill.
docker exec -i -u postgres "$recovered_container" psql -X -v ON_ERROR_STOP=1 -U pact -d pact -q <<'SQL'
DO $$
DECLARE synthetic_event bigint;
DECLARE claimed integer;
BEGIN
  INSERT INTO outbox_events(product_scope, event_id, type, payload)
  VALUES ('restore-drill', gen_random_uuid(), 'restore.drill.synthetic.v1', '{}'::jsonb)
  RETURNING id INTO synthetic_event;
  INSERT INTO outbox_deliveries(consumer, outbox_event_id, status, leased_by, lease_expires_at, attempts)
  VALUES ('restore-drill', synthetic_event, 'leased', 'recovery-worker', now() + interval '1 minute', 1);
  UPDATE outbox_deliveries SET status = 'delivered', delivered_at = now(), lease_expires_at = NULL
  WHERE consumer = 'restore-drill' AND outbox_event_id = synthetic_event AND leased_by = 'recovery-worker';
  INSERT INTO outbox_deliveries(consumer, outbox_event_id, status, leased_by, lease_expires_at, attempts)
  VALUES ('restore-drill', synthetic_event, 'leased', 'replay-worker', now() + interval '1 minute', 1)
  ON CONFLICT(consumer, outbox_event_id) DO UPDATE SET
    status = 'leased', leased_by = EXCLUDED.leased_by, lease_expires_at = EXCLUDED.lease_expires_at,
    attempts = outbox_deliveries.attempts + 1
  WHERE outbox_deliveries.status <> 'delivered' AND outbox_deliveries.lease_expires_at <= now();
  GET DIAGNOSTICS claimed = ROW_COUNT;
  IF claimed <> 0 THEN RAISE EXCEPTION 'outbox replay duplicated delivery'; END IF;
END $$;
SQL
replayed=$(docker exec -u postgres "$recovered_container" \
  psql -X -v ON_ERROR_STOP=1 -U pact -d pact -Atqc \
  "SELECT count(*) FROM outbox_deliveries d JOIN outbox_events e
     ON e.id = d.outbox_event_id
     WHERE e.product_scope = 'restore-drill' AND e.type = 'restore.drill.synthetic.v1'
       AND d.consumer = 'restore-drill' AND d.status = 'delivered'")
if [ "$replayed" != 1 ]; then
  echo "isolated outbox replay was not durable" >&2
  exit 1
fi
echo "Encrypted base/WAL snapshot $snapshot booted in an isolated PostgreSQL 17 volume; synthetic outbox replay deduplicated."
