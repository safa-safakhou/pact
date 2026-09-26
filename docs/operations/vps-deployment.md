# Single-VPS deployment

PACT connection testing runs as an isolated Docker Compose project on the existing EU-hosted VPS. It does not require AWS, Kubernetes, Redis, or a second database host. The checked-in connection-test environment uses `https://safa.dedyn.io/pact`; only synthetic accounts are allowed until PACT-025 passes.

## Layout and isolation

- Source and deployment state: `/srv/pact/source` and `/srv/pact/state`.
- Runtime secrets: `/srv/pact/secrets/connection-test`, mode `0600`; never copy this directory into a release or backup report.
- Public edge: the existing Caddy container handles `/pact/*` and strips `/pact` before proxying to `pact-connection-test-gateway-1:8080` over `pact-edge`.
- The shared edge removes its default `X-Frame-Options: DENY` only for `/pact/telegram/*` and applies `Content-Security-Policy: frame-ancestors https://web.telegram.org https://*.web.telegram.org`; all other routes retain the default framing denial.
- The PACT gateway also binds `127.0.0.1:8088` for host-local recovery checks. PostgreSQL has no host port and joins only the internal `data` network.
- API, rules, inference, notification, and channel processes are separate containers built from one pinned Node 24 image. Only inference mounts `model_credential_private_key`; API receives the public wrapping key. Rules, API, and inference mount the same `raid_seed_encryption_key` for deterministic raid commitments and shared game-command execution. The worker registers only a fake provider while `PACT_ENABLE_LIVE_MODEL_CALLS=0` (the Compose default and checked-in example). Set it to `1` only after explicitly accepting external provider costs and verifying the chosen API route; the mount alone does not enable network inference. OpenRouter also stays unregistered until `OPENROUTER_ROUTING_DISCLOSURE` is supplied. The worker requires `MODEL_CREDENTIAL_WRAPPING_KEY_ID` to match the key ID used by the API. This opt-in has only synthetic local fixture evidence, not a deployed or billable-provider certification.

The original shared-edge Caddyfile backup is `/srv/agentic-world/infra/production/Caddyfile.before-pact-20260921`. Restoring it and restarting only the edge container removes the public PACT route without changing PACT data.

## Deploy and rollback

Synchronize the repository without `.git`, `node_modules`, build output, or local environment files. On the VPS:

```sh
cd /srv/pact/source
./infra/production/bin/deploy.sh infra/production/vps-connection-test.env <release-id>
./infra/production/bin/verify.sh infra/production/vps-connection-test.env https://safa.dedyn.io/pact
```

Deployment builds immutable release-tagged runtime and gateway images, starts PostgreSQL, applies migrations once, imports the append-only deletion registry, then replaces application containers after API readiness succeeds. API and all workers depend on the successful `privacy-replay` one-shot service. To return to the previously recorded images without rolling the database backward:

```sh
cd /srv/pact/source
./infra/production/bin/rollback.sh infra/production/vps-connection-test.env
```

Database migrations must remain forward compatible with the previous application image. A database rollback requires a separately rehearsed restore and is never part of the automatic application rollback.

## Backups

PostgreSQL archives WAL into its private `postgres-wal` volume. `backup.sh` creates a consistent `pg_basebackup`, sends the base and WAL directories to an encrypted Restic repository, and applies the 35-day lifecycle. For the zero-cost private MVP, that repository is `/srv/pact/backups/restic` on the same VPS. It protects against database corruption and operator mistakes, but not server/disk loss or full-host compromise. PACT-078 must move it off-host before production hardening. Keep the repository password and environment only in root-readable files, then install the six-hour timer:

```sh
sudo ./infra/production/bin/install-backup-timer.sh \
  /srv/pact/source \
  /srv/pact/source/infra/production/vps-connection-test.env \
  /srv/pact/secrets/connection-test/backup.env
```

Run `restore-drill.sh` with an explicit Restic snapshot ID before accepting the environment. It requires at least 2 GiB free on Docker's filesystem, restores into disposable volumes, verifies the base-backup manifest and WAL, boots PostgreSQL 17 without a network or host port, checks migration tables and (when present) game balances against movement sums, then exercises synthetic outbox delivery and replay on the recovered copy. Optional `KINGDOM_ID COMMAND_ID` arguments assert one recovered fixture kingdom, eight home guards, its building instruction, and one committed receipt. The trap removes only drill volumes/container; it never mounts or writes the live data volume. Snapshot `2ba99a33` (26 September 2026, 00:26 UTC), taken after release `mvp-20260926-1`, passed all gameplay fixture, ledger, and outbox replay checks. The `pact-backup.timer` runs every six hours and preserves snapshots within the 35-day window. The local Restic repository does not protect against loss of the VPS itself.

The fixture can be reproduced only with the host-only synthetic account password (never copy it into a command argument or log):

```sh
cd /srv/pact/source
PACT_FIXTURE_PASSWORD_FILE=/srv/pact/secrets/connection-test/operator_test_password node scripts/seed-vps-gameplay-restore.mjs
./infra/production/bin/backup.sh infra/production/vps-connection-test.env /srv/pact/secrets/connection-test/backup.env
./infra/production/bin/restore-drill.sh infra/production/vps-connection-test.env /srv/pact/secrets/connection-test/backup.env SNAPSHOT_ID 448cc513-b464-4881-8892-259a963f124a 2dcc93b2-84be-4084-95d2-ddfcb802e331
```

The opaque deletion registry is `/srv/pact/state/privacy/deletion-registry.ndjson`, mode `0600` after its first write. It is deliberately outside PostgreSQL's base/WAL volumes and is not replaced during a database restore. It contains no email, credentials, or content. Every restore must apply current migrations and run `privacy-replay` before any API or worker starts; the normal deployment path enforces this. Do not roll back to an image that predates `@pact/privacy` while an unexpired deletion tombstone exists.

## MVP email capture

The notification worker leases `security.email.requested.v1` outbox events, decrypts one-time material only in worker memory, submits the message through the injected SMTP URL, and marks the event delivered only after SMTP accepts it. The zero-cost MVP SMTP endpoint is an internal-only Mailpit container. Its SMTP and web ports are not published to the host or internet. This proves the transactional pipeline and makes messages inspectable by an operator through Docker; it does not deliver internet email. PACT-078 replaces Mailpit with a verified outbound sender before production.

## Telegram test bot

The test bot is `@test_pact1211_bot`, with Mini App short name `PactGameTest` and public launch link `https://t.me/test_pact1211_bot/PactGameTest`. It uses the Mini App at `https://safa.dedyn.io/pact/telegram/` and webhook at `https://safa.dedyn.io/pact/telegram/webhook`. Bot ID, token, and webhook secret are mounted only into the API container from root-readable files. Never copy them into a deployment report or checked-in environment. The test token was previously shared in conversation; rotate it before broader testing and update only the host secret file and Telegram webhook configuration.

The synthetic walkthrough account is `pact-mvp-owner@example.test`. Its verified password is generated on the VPS and remains in `/srv/pact/secrets/connection-test/operator_test_password` with mode `0600`. An authorized operator retrieves it directly without copying it into Git, Linear, or logs:

```sh
ssh agentic@2.28.57.254 'cat /srv/pact/secrets/connection-test/operator_test_password'
```

In the Mini App, use **Begin account link** → **Confirm in PACT** → sign in with that account → return to Telegram → **Exchange confirmed link**. Then run the private-draft, sandbox, approval, duplicate, and unlink checks. Rotate both this password and the bot token after the shared walkthrough because chat-delivered credentials are not a durable secret-distribution channel.

Do not add real player data to the shared deployment environment until PACT-025 is satisfied.

## Registration gate

The deployment mounts `/srv/pact/state/operator` read-only into the API. If `operator-register.json` is absent, unreadable, contains placeholders or empty required facts, disagrees with `CURRENT_TERMS_VERSION`, or does not explicitly enable registration, signup returns `503 REGISTRATION_UNAVAILABLE`. This is intentional and does not make `/ready` fail: existing synthetic testers retain login and account-management access while new registration is closed.

Prepare and validate the register using the procedure in [Identity and onboarding operations](identity.md#real-registration-operator-preflight). The private MVP copies the checked-in synthetic register into host state; a future production register stays on the VPS and is never committed. After changing it, restart the API and verify both `/v1/legal/registration-status` and `/v1/legal/notices` before inviting a tester.

Release `mvp-20260923-1` demonstrated the absent-register state on 23 September 2026: deployment verification passed, registration status was false, a synthetic signup probe returned `503 REGISTRATION_UNAVAILABLE`, and no account row was created.

The same release was then configured with `operator-register.mvp-test.json`: preflight reported ready/enabled, the public notice identified `PACT MVP Test Operator`, registration status became true, and an empty signup probe reached normal `400 INVALID_INPUT` validation rather than the closed-gate 503. These values authorize synthetic-data MVP testing only; PACT-098 replaces them before production or paid signup.
