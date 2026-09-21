# Single-VPS connection-test deployment

Ticket: [PACT-004 / MNI-64](https://linear.app/mnim/issue/MNI-64/pact-004-provision-the-single-vps-connection-test-environment)

Implementation revision/PR: the commit containing this report, based on revision `6b4d993`; no PR was created.

Verification environment: 21 September 2026; Ubuntu 26.04 x86_64 VPS at the operator-supplied host; Docker Compose 2.40.3; Node 24.21.0 image; PostgreSQL 17.11; Caddy 2.10.2. Only synthetic data is present.

## Result

PACT is deployed as the isolated `pact-connection-test` Compose project and is publicly healthy at `https://safa.dedyn.io/pact`. The pre-existing `agentic-world-production` application remains available through the same Caddy edge. The deployment contains web/API, rules, inference, notification, channel, gateway, and PostgreSQL containers, repeatable migrations, release-tagged deploy/rollback scripts, private secret mounts, WAL/base-backup staging, and Restic backup/restore tooling.

The second acceptance criterion passes on the live VPS. The first remains partially blocked: deployment and synthetic database/base/WAL generation pass, but an encrypted off-host upload and restore cannot be executed until an object-storage target is supplied. SMTP configuration is likewise awaiting sender credentials.

## Acceptance evidence

| Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Deploy to the project VPS and restore a synthetic database from encrypted off-host backup; replay hooks available for PACT-024 | `deploy.sh`; migrations 0001–0015; `backup.sh`; `restore-drill.sh`; live `GET /pact/health` | Partial. Live deployment and schema pass; PostgreSQL successfully archives WAL after the permission initialization fix. Off-host encrypted upload/restore not run because no repository credentials were supplied. PACT-024 replay hooks remain that ticket's scope. |
| PostgreSQL is not public; private unwrap key only reaches inference; authenticated responses are not cached | `verify.sh`; host `ss`; Docker mount inspection; public response headers | Pass. No host listener on 5432; only inference mounts the private key; `/pact/v1/*` returns `Cache-Control: no-store`; existing root service still responds after shared-edge integration. |

Supporting checks: `npm run lint`, `npm run typecheck`, 48/48 unit tests, 31/31 integration tests, 1/1 smoke test, clean production build, backlog render/check, and `git diff --check` pass locally. Compose interpolation and shell syntax validation pass on the VPS. Both an image clean build from no pre-existing `dist` and a live rollback from `vps4` to `vps3` followed by restoration to `vps4` passed `verify.sh`. The public OAuth issuer equals `https://safa.dedyn.io/pact`; web and Telegram shells return 200.

## Documentation

- [Single-VPS operations](../../operations/vps-deployment.md)
- [Database operations](../../operations/database.md)
- [`infra/production/compose.yaml`](../../../infra/production/compose.yaml)
- [`infra/production/deploy.env.example`](../../../infra/production/deploy.env.example)

## Decisions and limitations

PACT shares the existing TLS hostname under `/pact` rather than claiming ports 80/443 or introducing another server. The internal gateway strips the prefix; OAuth metadata retains the public prefixed issuer. The shared Caddy configuration was backed up and validated before its brief restart. No existing database, volume, or application container was altered.

The VPS itself is not an off-host backup target. A same-machine Restic repository would not satisfy the ticket and was intentionally not represented as one. SMTP is staged as a narrowly mounted notification-worker secret but remains empty until the operator supplies credentials.

## Handoff

Provide a Restic-compatible off-host repository plus credentials and an SMTP sender URL. Then run `backup.sh`, `restore-drill.sh`, install the timer, exercise one synthetic security-email delivery, and attach the sanitized results before moving PACT-004 to Done.
