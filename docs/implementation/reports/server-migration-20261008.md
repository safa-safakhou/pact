# Dedicated PACT server migration — 8 October 2026

The later [direct subdomain cutover](subdomain-migration-20261008.md) supersedes this report's routing, public URL and image references. Database migration and backup evidence below remain the historical record.

Founder authorized moving PACT to `root@2.31.62.91`, keeping `/pact`, preserving the old host for testing and keeping the new host clean. This operations assignment did not select deferred roadmap work or restart the completed population experiment.

## Result

PACT database, API, rules, seals, inference, notifications, channel worker, Mailpit and gateway run as project `pact-production` on the new Ubuntu host: 8 GB RAM, 75 GB root disk, approximately 66 GB available after migration/backup. Public URL and OAuth issuer remain `https://tinyagenttools.com/pact`. Old PACT containers, including PostgreSQL, are stopped and its backup timer is disabled; frozen data and historical backups remain preserved.

The shared HTTPS edge and Tiny Agent Tools remain on the old host. PACT traffic reaches the new gateway over WireGuard. This migrates PACT services but retains an old-host ingress dependency. [Operational runbook](../../operations/dedicated-pact-host.md).

## Evidence

1. Installed Docker/Compose, WireGuard and migration utilities from Ubuntu packages. Enabled new-host firewall, bounded container logs/journald and Docker's WireGuard startup dependency. HTTP listens only on `127.0.0.1:8088` and `10.77.0.2:8088`; PostgreSQL/Mailpit have no public host ports.
2. Transferred exact current/rollback runtime and gateway images, required secrets, actual operator register, deletion registry and captured Mailpit data. Source excludes Git, dependencies, build output and local environments. Historical release archives, synthetic tester passwords, build cache and the 11 GB backup repository were not copied.
3. Stopped old application writers and its backup timer. Streamed a custom-format PostgreSQL dump over SSH into a root-only destination file; re-copied final deletion registry after stopping writes. Restore completed with `pg_restore --exit-on-error`. Dump SHA-256: `72740addc01234bae491dae0d83f612f01c21b405dc80815923431353b4d6521`.
4. Before starting destination application services, compared deterministic per-table row fingerprints/counts: **141 tables, 2,780,819 rows, identical**. Both complete fingerprint outputs had SHA-256 `77e8a919f04a88b85576e9801c85b8a83204d628fd777f2b8c54a9e38c55b325`. Includes accounts, sessions/grants, receipts, keys, authority, approvals and gameplay; no raw private records are included here.
5. Migration reported “Database is current.” Preserved deletion registry replay ran before API/workers: 1 closed, 0 purged. API and PostgreSQL became healthy. Current runtime image: `sha256:1d5309552a2e98568aa13a630dc8e354b44eef4d5dcd2a055c310294bed7db28`; gateway: `sha256:a6951516129291d9932d5e2ff0db37dff2519990790f67303e59758b84679431`.
6. Validated/reloaded Caddy routing and made its ingress mount independent of the root application's release directory. Edge recreation briefly returned 521 during startup; subsequent deployment verification, OAuth discovery and public root application all passed. Root application code/data were not migrated.
7. Fresh encrypted base/WAL snapshot **d3011811**, 11:42 UTC / 13:42 Berlin, contains approximately 1.791 GiB uncompressed data in a 349 MB repository. Isolated PostgreSQL 17 restore passed backup verification, game-balance reconciliation and synthetic outbox replay deduplication. Drill volumes/container were removed. Six-hour backup timer enabled. Removed temporary plaintext dump only after the encrypted backup was verified.
8. Resumed through shared `WorldClockService.resume()` from game time 1791341820000, sequence 15998, without wall-time catch-up. Subsequent sequences 15999 and 16000 committed with production credits, current heartbeat and no suspension reason. No model calls, new game commands, approvals or mandate changes were initiated by the operator.
9. Read the founder's existing PACT browser session through the unchanged URL: the existing kingdom loaded preserved state without a new login. Read-only Refresh showed “Clock active”. Public OAuth discovery retains issuer/endpoints/scopes. No new ChatGPT prompt was sent; this is connection-preservation evidence, not a newly played consumer-chat round.

## Verification and boundaries

- Deployment verification passed before and after stable ingress change: web/Telegram assets, framing, registration response, cache controls, secret mount boundaries and no PostgreSQL listener.
- All-resource ledger reconciliation on migrated live data returned zero mismatches; isolated restore independently checked it.
- Shell syntax checks passed for deployment/backup/verification/rollback. Optional `PACT_COMPOSE_OVERRIDE_FILE` preserves private bindings in future deployments/rollback, leaving other-host behavior unchanged.
- New-host systemd dependencies validated; two unrelated Ubuntu units emitted deprecated CPUAccounting notices.
- No application rebuild or application test-suite result is claimed; unchanged tested release images were transferred. Source, actual deployment, restore and routing checks provide this migration's evidence.
- Shared ingress still depends on old host. New backups remain local under the MVP baseline. No separate synthetic test world or complete off-host disaster recovery was introduced.
- Spending allowance and approval UX findings from the preceding audit remain unchanged; migration restores operation without enlarging agent authority.
