# Single-VPS deployment

PACT connection testing runs as an isolated Docker Compose project on the existing EU-hosted VPS. It does not require AWS, Kubernetes, Redis, or a second database host. The checked-in connection-test environment uses `https://safa.dedyn.io/pact`; only synthetic accounts are allowed until PACT-025 passes.

## Layout and isolation

- Source and deployment state: `/srv/pact/source` and `/srv/pact/state`.
- Runtime secrets: `/srv/pact/secrets/connection-test`, mode `0600`; never copy this directory into a release or backup report.
- Public edge: the existing Caddy container handles `/pact/*` and strips `/pact` before proxying to `pact-connection-test-gateway-1:8080` over `pact-edge`.
- The PACT gateway also binds `127.0.0.1:8088` for host-local recovery checks. PostgreSQL has no host port and joins only the internal `data` network.
- API, rules, inference, notification, and channel processes are separate containers built from one pinned Node 24 image. Only inference mounts `model_credential_private_key`; API receives the public wrapping key.

The original shared-edge Caddyfile backup is `/srv/agentic-world/infra/production/Caddyfile.before-pact-20260921`. Restoring it and restarting only the edge container removes the public PACT route without changing PACT data.

## Deploy and rollback

Synchronize the repository without `.git`, `node_modules`, build output, or local environment files. On the VPS:

```sh
cd /srv/pact/source
./infra/production/bin/deploy.sh infra/production/vps-connection-test.env <release-id>
./infra/production/bin/verify.sh infra/production/vps-connection-test.env https://safa.dedyn.io/pact
```

Deployment builds immutable release-tagged runtime and gateway images, starts PostgreSQL, applies migrations once, then replaces application containers after API readiness succeeds. To return to the previously recorded images without rolling the database backward:

```sh
cd /srv/pact/source
./infra/production/bin/rollback.sh infra/production/vps-connection-test.env
```

Database migrations must remain forward compatible with the previous application image. A database rollback requires a separately rehearsed restore and is never part of the automatic application rollback.

## Backups

PostgreSQL archives WAL into its private `postgres-wal` volume. `backup.sh` creates a consistent `pg_basebackup`, sends the base and WAL directories to an encrypted Restic repository, and applies the 35-day lifecycle. Put repository credentials only in a root-readable copy of `backup.env.example`, then install the six-hour timer:

```sh
sudo ./infra/production/bin/install-backup-timer.sh \
  /srv/pact/source \
  /srv/pact/source/infra/production/vps-connection-test.env \
  /srv/pact/secrets/connection-test/backup.env
```

Run `restore-drill.sh` with an explicit Restic snapshot ID before accepting the environment. The current deployment has verified local base/WAL generation, but no off-host repository was supplied, so the encrypted upload/restore acceptance check remains blocked.

## Remaining operator inputs

- An off-host Restic-compatible object-storage repository and credentials.
- SMTP sender URL/credentials for transactional delivery.

Do not add real Telegram or player credentials to the shared deployment environment until their own ticket prerequisites and PACT-025 are satisfied.
