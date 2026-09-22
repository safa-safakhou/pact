# Single-VPS connection-test deployment

Ticket: [PACT-004 / MNI-64](https://linear.app/mnim/issue/MNI-64/pact-004-provision-the-single-vps-connection-test-environment)

Implementation revision/PR: `4aed694` foundation plus live release `mvp-20260922-1`; final MVP-hardening revision recorded in Git history. No PR was created.

Verification environment: 22 September 2026; Ubuntu 26.04 x86_64 VPS at the operator-supplied host; Docker Compose 2.40.3; Node 24.21.0 image; PostgreSQL 17.11; Caddy 2.10.2; Mailpit 1.27.11. Only synthetic data is present.

## Result

PACT is deployed as the isolated `pact-connection-test` Compose project and is publicly healthy at `https://safa.dedyn.io/pact`. The pre-existing `agentic-world-production` application remains available through the same Caddy edge. The deployment contains web/API, rules, inference, notification, channel, gateway, and PostgreSQL containers, repeatable migrations, release-tagged deploy/rollback scripts, private secret mounts, WAL/base-backup staging, and Restic backup/restore tooling.

Both Version 1.3 MVP acceptance criteria pass on the live VPS. The stack now includes internal-only Mailpit capture and a real notification outbox consumer. An encrypted same-VPS Restic base/WAL snapshot was created, pruned under the 35-day policy, and restored into an isolated disposable volume. This intentionally does not claim disaster recovery from total VPS loss.

## Acceptance evidence

| Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Deploy to the project VPS, capture a synthetic transactional email, and restore a synthetic database from an encrypted local backup; replay hooks available for PACT-024 | `deploy.sh`; migrations 0001–0015; notification worker; Mailpit API; `backup.sh`; `restore-drill.sh`; live `GET /pact/health` | Pass. A synthetic signup produced one captured verification message and delivered outbox record. Encrypted snapshot `403424fc` containing base/WAL data restored and passed structural checks. PACT-024 replay hooks remain that ticket's scope. |
| PostgreSQL is not public; private unwrap key only reaches inference; authenticated responses are not cached | `verify.sh`; host `ss`; Docker mount inspection; public response headers | Pass. No host listener on 5432; only inference mounts the private key; `/pact/v1/*` returns `Cache-Control: no-store`; existing root service still responds after shared-edge integration. |

Supporting checks: lint, typecheck, unit/integration/smoke suites, clean production build, backlog render/check, and `git diff --check` pass locally. Compose interpolation and shell syntax validation pass on the VPS. Both an image clean build from no pre-existing `dist` and a live rollback rehearsal passed previously. Release `mvp-20260922-1` passed `verify.sh`; the public OAuth issuer equals `https://safa.dedyn.io/pact`, web and Telegram shells return 200, Mailpit has no host port, and the six-hour backup timer is active.

## Documentation

- [Single-VPS operations](../../operations/vps-deployment.md)
- [Database operations](../../operations/database.md)
- [`infra/production/compose.yaml`](../../../infra/production/compose.yaml)
- [`infra/production/deploy.env.example`](../../../infra/production/deploy.env.example)

## Decisions and limitations

PACT shares the existing TLS hostname under `/pact` rather than claiming ports 80/443 or introducing another server. The internal gateway strips the prefix; OAuth metadata retains the public prefixed issuer. The shared Caddy configuration was backed up and validated before its brief restart. No existing database, volume, or application container was altered.

The zero-cost MVP intentionally accepts one-host risk: `/srv/pact/backups/restic` and the live database share the VPS. Snapshot `403424fc` proves encrypted logical recovery, not recovery from disk/server loss. The six-hour systemd timer is active. Mailpit is reachable only on the Compose application network; a synthetic signup produced one captured verification message and one delivered outbox record without logging its recipient or one-time code.

## Handoff

PACT-004 can close under the approved Version 1.3 MVP contract. PACT-078 owns the later move to off-host disaster recovery and verified real outbound email before production.
