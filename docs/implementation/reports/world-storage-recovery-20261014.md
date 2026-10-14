# PACT world storage recovery — 14 October 2026

During the founder-authorized local twenty-agent paired Fleet setup, normal guest enrollment returned `WORLD_PAUSED`. Founder explicitly required the game to be working. Codex diagnosed/recovered the host without delegation, changing no player/account identity, game resource, model/provider selection, Fleet schedule or historical allocation.

## Incident and recovery

The world was paused at sequence **24770**, with reason **TICK_DELAYED**. The rules worker repeatedly reported inability to write a database initialization file because the disk had no space. The 75 GiB host filesystem had about **24 KiB free**, then 4 KiB during diagnosis. The encrypted Restic repository occupied **49 GiB** and the disposable base-backup staging copy occupied **5.4 GiB**. Live PostgreSQL data was separate; no game/Fleet database or encrypted snapshot was deleted.

The latest encrypted backup **cd3c3823**, from **13:19:54 UTC**, contains the same base-backup manifest as staging: SHA-256 `a1057c6e52a52f9087eef46ab5d0192ccb1ec847b68532251a7d352afcac1fe5`. A read-only Restic dump matched it exactly. The backup service was inactive; staging's resolved absolute path, PostgreSQL 17 marker and manifest were rechecked before removal. Only `/var/lib/docker/volumes/pact-production_postgres-basebackup/_data/data`, the temporary copy recreated by `pg_basebackup`, was removed. All encrypted snapshots, live data, WAL archive, source releases and independent Fleet volumes remain. Space recovered to **5.4 GiB free /93% used**.

World recovery used the existing **WorldClockService.resume()**, with no SQL clock reset or outage catch-up. It retained committed game time and sequence and scheduled the next tick at **14:26:39.928 UTC**. Subsequent readback showed active state, sequence **24771**, and the next tick at **14:27:39.928 UTC**. PACT account enrollment then proceeded normally using the original saved entry key, without replacement identities. No gameplay replay or game-service restart was needed.

An initial read-only Restic inventory attempt omitted `--no-lock` on the read-only repository mount and could not create its lock. Its exact diagnostic container was stopped after identifying its command/mounts; corrected read-only inventory/dump succeeded. Two initial world inspection commands used the wrong database argument and then a BigInt-incompatible JSON encoder; corrected inspection loaded the existing secret privately and serialized exact integers as strings. These were diagnostic errors, not game writes or successful checks.

## Backup safeguards

`infra/production/bin/backup.sh` now checks available local space before creating a base copy. It reserves two current data-directory sizes plus 1 GiB for staging, repository growth and live database headroom. Insufficient capacity fails visibly as **BACKUP_CAPACITY_REQUIRED** before copying or removing WAL; all prior encrypted snapshots remain. After successful encrypted backup **and** retention, it removes only the verified temporary base-copy directory. Failed backup/retention preserves staging and WAL for diagnosis/recovery. The configured 35-day encrypted retention is unchanged.

`sh -n`, `git diff --check` and four isolated command-fixture checks pass: insufficient capacity prevents `pg_basebackup`; failed encrypted backup and failed retention prevent final staging/WAL cleanup; successful backup performs cleanup. Fixture uses synthetic env files and fake Docker/df/filesystem commands, not a live database or Restic repository. Protected proof: local Fleet installation `verify-backup-guard.py`.

The host archive remains near its disk capacity. **Additional storage is required before another local backup can meet this conservative guard.** The guard preserves gameplay headroom and reports failure instead of filling the disk; it does not certify new backup success or provision paid infrastructure. Keep the full encrypted history, arrange sufficient capacity or explicitly review a retention/storage change, then retry the existing backup service. Do not erase snapshots or reduce retention silently.

Source verification precedes installation of the guarded script. Actual script deployment/readback and subsequent world/paired Fleet acceptance are appended after completion. Existing stopped populations and unrelated server/Mac Fleet assignments remain unchanged.
