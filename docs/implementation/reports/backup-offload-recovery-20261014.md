# PACT backup offload and server recovery

**Completed:** 14 October 2026, **17:11:36 Berlin**. Snapshot offload, independent archive shutdown and backup-file removal are complete; the snapshot units are masked and PostgreSQL archiving is persistently disabled. The founder requested moving the latest backup to this Windows machine and removing the server backup copies. Local integrity checks and isolated PostgreSQL restores passed before deletion. Server disk usage is now 26%, both databases answer queries, the game clock advances, and the original fifty-agent Fleet cohort continues running.

## Local recovery copy

The complete recovery directory is `C:\Users\ENDORFY\PACT-Backups\2026-10-14`. Its Windows ACL grants access only to the local owner and SYSTEM. Credentials, keys, database dumps and raw runtime evidence remain outside Git. The directory includes an operator `README.md`, the Restic executable, decryption files, encrypted repository and verification records.

| Preserved material | Recovery point and verification |
| --- | --- |
| Latest successful PACT snapshot | Source `cd3c3823a37716dfe98318c39575c4f186852fef453bc43e229d76925c40cb14`, 14 October at **15:19:54 Berlin /13:19:54 UTC**. Includes `/backup/base` and `/backup/wal`, 6,110,580,196 restored bytes and 2,282 file/directory entries. |
| Independent local PACT snapshot | `f71ae42e7aacc7d396cbf3d8de955092ff69d5161ced9847aeff5dee1a6c4073`. Same tree, paths and timestamp as the source. All referenced data was copied, re-encrypted and checked locally; the PACT repository occupied 1,083,996,479 bytes before adding supporting material. |
| Server recovery configuration and historical Fleet backups | `server-recovery-material.tar.gz`: all ten Fleet dumps and their associated files, Fleet environment, PACT production configuration/secrets, and original backup units. All 45 source files matched local SHA256 hashes and sizes, totaling 20,977,841 uncompressed bytes. |
| Fresh Fleet database | `fleet-current-20261014.dump`, captured around **16:38 Berlin** today; 16,068,494 bytes. SHA256 `817de7aed66384821c28cf1a4dc98028e5d7923c711ef0d18def83192940b466`. Successfully restored into a second isolated local database. |
| Encrypted supporting snapshot | `8fd355aa653951b2bd039a31c6dd2830e2d579c53d78f33018138cc7d133694e` contains both the support archive and fresh Fleet dump. A second full repository data check passed; restored support files matched their originals by SHA256. |
| Final archive and host configuration | Encrypted snapshot `103716a4ed9db6848bdbc75e75790865321d05d24760d3b8e683e9be26db2092`; all remaining archive files and the deployed disabled-archiving override were transferred, hash-checked and verified through encrypted restore before archive cleanup. |

The local repository is self-contained. Restic `copy` transfers the data referenced by a snapshot; copying only a snapshot metadata file would not preserve a deduplicated backup. The procedure used a distinct destination key and retained both keys privately. [Restic repository copy documentation](https://restic.readthedocs.io/en/stable/045_working_with_repos.html).

Only the latest of the 40 PACT snapshots was retained. The other 39 PACT snapshots were removed with the server repository under the founder's explicit cleanup instruction. All historical Fleet backup files were preserved. PACT's recovery point is 15:19:54, rather than the final live checkpoint; changes made afterward are outside that snapshot.

## Restore acceptance

Restic `check --read-data` found no errors, and `restore --verify` validated the restored files. PostgreSQL `pg_verifybackup` verified the base-backup manifest and required WAL. A separate copy then booted in **PostgreSQL 17.11**, with network disabled, archive mode disabled, archived WAL available to the restore command, and no production mounts or ports.

PACT's restored database left recovery and returned **279 kingdoms, 9,669 command receipts and 88,033 outbox events**. Ordinary, allowance and locked resource balances reconciled with the resource movement ledger: **zero mismatches**. This verifies the preserved database and resource accounting at the snapshot recovery point.

The latest preserved historical Fleet dump, `pre-read-refusal-20261013.dump`, restored with **3 cohorts, 60 agents and 2,698 turns**. Today's fresh Fleet dump restored with **3 cohorts, 60 agents and 7,948 turns**. Both retained all original fifty ordinal/account/kingdom bindings. The two unknown ledger rows were compared across the historical restore, fresh restore and final live read: their IDs, original turn IDs, status and allocations were identical, totaling **80,000 reserved tokens**. No exact usage was invented.

The isolated test containers and temporary expanded restore copies were removed after acceptance. The encrypted snapshots, protected support archive, fresh dump, passwords and verification records remain locally.

## Server cleanup and producer shutdown

The earlier [storage recovery](world-storage-recovery-20261014.md) released only the verified disposable base-copy staging directory and resumed the clock, creating initial headroom. That was a separate checkpoint; this offload subsequently removed the encrypted server history.

At **16:40:48 Berlin /14:40:48 UTC**, cleanup removed exactly:

- `/srv/pact/backups`, containing only the verified Restic repository: 51,560,984,698 apparent bytes.
- `/var/lib/fleet/backups`: 20,969,942 apparent bytes, with every file rechecked against its preserved local hash before deletion.

Before mutation, paths resolved to the expected absolute directories, contained no symlinks and were not filesystem mounts. The PACT snapshot inventory still matched the original 40 snapshots; both backup units were inactive, their files matched the preserved copies, and no Restic or `pg_basebackup` producer was running. Local restore and integrity proofs were required by the cleanup script.

The six-hour `pact-backup.timer` was disabled at **16:23:32 Berlin**. Cleanup then retained its original unit and service as `/etc/systemd/system/pact-backup.timer.disabled-20261014` and `/etc/systemd/system/pact-backup.service.disabled-20261014`, and **masked both the timer and service**. Final readback shows inactive/masked with no next trigger. This prevents their automatic or ordinary systemd activation. The backup script itself remains available for deliberate manual invocation; future backup production needs a selected destination and retention policy.

Filesystem usage immediately changed from **93% to 26%**, with available space increasing from **5,503,787,008 to 57,093,746,688 bytes**. The final readback had **57,057,705,984 bytes available**, approximately 53.1 GiB. Live database volumes, active WAL/archive volumes, application credentials, Fleet state, release images and historical database volumes were not cleanup targets.

## Live recovery checkpoint

Read-only checks at **16:42:28 and 16:43:46 Berlin** show:

- Fleet worker, Fleet database, PACT API, PACT PostgreSQL and rules worker running; PostgreSQL/Fleet database/API health checks report healthy. Container start times and restart counts remained unchanged across the observation window.
- Both databases completed actual SQL reads. PACT is outside PostgreSQL recovery, with its world active; tick sequence advanced **24,786 → 24,788** and the heartbeat stayed current. The live world had **299 kingdoms**, distinct from the earlier snapshot's 279.
- The original cohort is running with **50 ready agents** and unchanged account bindings. One turn was running, no turn held a pending command, and **16 original-cohort turns finished after deletion** by the final checkpoint. The pilot remained finished and the learning cohort remained draft.
- Both historical unknown allocations remain intact. No manual replay, cancellation, usage review, identity replacement, schedule change or model call was introduced by this recovery.

The last stored per-agent reasons included four `FORBIDDEN` and one `INVALID_TOOL_ARGUMENTS`; all fifty agents were nevertheless ready. These are behavioral/permission follow-ups for the [existing investigation plan](../fleet-agent-investigation-plan-20261013.md), rather than evidence that the disk outage remains active. A stable operational checkpoint does not establish profitable negotiation or competent long-term planning.

## Independent WAL archive shutdown

The timer shutdown initially left PostgreSQL's independent archiver enabled, with no active retention because pruning belonged to the masked backup job. At 16:50 Berlin the archive files occupied 738,211,159 bytes and were still growing. The founder's full backup-removal instruction covered the persistent configuration correction and controlled PostgreSQL restart needed to stop this producer. The steps below completed that follow-up.

### Persistent configuration and safe execution boundary

The dedicated-host override `infra/production/compose.pact-host.yaml` now replaces PostgreSQL's startup command with `postgres -c archive_mode=off -c archive_timeout=0`. The same file was installed at `/srv/pact/source/infra/production/compose.pact-host.yaml`; its deployed hash matches the repository. Resolved Compose configuration changed only the PostgreSQL command. The generic backup-enabled template remains available for other explicitly configured hosts; the dedicated host's existing override selection preserves the disabled state on future recreation/deployment.

Both server and local comparison workers use advisory claim lock 19281462. Holding that lock prevented new admissions while current turns finished naturally. With **zero running turns and zero reserved model calls**, the same workers were stopped; cancelling only their blocked claim queries allowed shutdown without interrupting inference or an uncertain gameplay command. Original accounts, cohort settings, anchors, ledgers and turn rows were captured before maintenance. No cohort pause/stop transition, budget change, model selection or manual inference was introduced.

PostgreSQL was recreated at **17:01:15.953 Berlin**, using the same `postgres:17.11-alpine` image ID, secrets and three volume bindings. It returned `archive_mode=off`, `archive_command=(disabled)`, `archive_timeout=0` and `pg_is_in_recovery=false`, with **299 kingdoms and 9,725 receipts** at the maintenance verification read. The clock remained active. API and rules processes automatically restarted once when their old database connections closed; subsequent health and clock checks passed. Only PostgreSQL was recreated, with no migration or game image change.

Before restarting the workers, complete cohort/agent/ledger rows and the captured historical turn fields matched their pre-maintenance values exactly in both Fleet databases. The original server worker and local comparison worker then resumed under their existing schedules. The first verification compared mount arrays in returned order and failed despite equivalent bindings; a corrected comparison by destination passed before worker resumption. No repeat PostgreSQL restart or data rollback was used to resolve that diagnostic error.

### Final archive preservation and deletion

Once the archive producer was off, the remaining immutable contents and deployed host override were streamed to the protected local `final-wal-and-host-config.tar.gz`. **All 93 source files** matched the local archive by SHA256 and size: 52 completed WAL segments, 40 backup-history files and the host configuration. The archive is **419,491,707 bytes**, SHA256 `3ab6fb5f2fc686bf27962b2073702372f12d19c764e69bdfcda40c471607f030`.

An additional encrypted Restic snapshot, **`103716a4ed9db6848bdbc75e75790865321d05d24760d3b8e683e9be26db2092`**, retains that archive. A full repository `check --read-data` passed again; `restore --verify` and a whole-file SHA256 comparison verified the encrypted archive's restored copy. These later archive segments are preserved material beyond the 15:19 base snapshot, rather than a separately certified later point-in-time restore.

At **17:05:36.693 Berlin**, cleanup rechecked `archive_mode=off`, the exact archive mount/source path, allowed immutable filenames and every source hash. It removed **92 files /872,428,887 bytes** only from `/var/lib/docker/volumes/pact-production_postgres-wal/_data`, mounted at `/var/lib/postgresql/wal-archive`. The now-empty volume remains attached. **Live database files and active `pg_wal` were not deletion targets.** PostgreSQL continues managing its live WAL normally; that live directory measured 134,218,072 bytes afterward.

### Final recovery and recurrence checks

Between **17:04:30 and 17:07:49 Berlin**, container start times and restart counts remained unchanged, the game stayed active and ticks advanced **24,808 → 24,812**. The archive directory remained empty after cleanup. Snapshot units are still inactive/masked, while PostgreSQL archiving is off in both the persistent command and actual runtime. The disabled backup job no longer leaves an independently growing archive.

At the final read, disk usage was **26%**, with **57,710,465,024 bytes available** (approximately 53.7 GiB). All fifty original server agents were ready; their cohort was running with no pending command. The two unknown ledger allocations remained unchanged, with 80,000 reserved tokens retained. The original pilot's historical pending turn remained untouched; it is separate from the active fifty-agent cohort.

The server completed **23 new turns** and the local twenty-agent comparison completed **21** after the maintenance boundary. All existing historical ledger/turn rows, identity bindings, cohort configuration and schedule anchors were preserved. The local comparison's twenty agents remained ready, both cohorts running, with zero unknown allocations and zero pending turns. A fresh live-world balance/journal reconciliation found **zero mismatches**.

The final producer read at **17:11:36 Berlin**, six minutes after archive cleanup, still found **zero archive files and zero archiver backends**, with runtime archiving off and the resolved persistent command disabled. Both public `/health` endpoints passed, the original local worker was active, and disk space available was **57,708,195,840 bytes /26% used**. Protected proof: `verification/final-producer-control-proof.json`.

PostgreSQL requires a server restart to change `archive_mode`; command-line settings override configuration files and `ALTER SYSTEM`. Emptying the archive command while archiving remains enabled can instead accumulate unarchived live WAL. The controlled startup correction above avoids that failure mode. [PostgreSQL archiving settings](https://www.postgresql.org/docs/17/runtime-config-wal.html#RUNTIME-CONFIG-WAL-ARCHIVING) and [command-line precedence](https://www.postgresql.org/docs/17/config-setting.html#CONFIG-SETTING-SHELL).

## Evidence and verification

Protected local proofs under the recovery directory's `verification/` include `transfer-verification.json`, `restore-proof.json`, `support-verified.json`, `fleet-restore-proof.json`, `fresh-fleet-proof.json`, `encrypted-support-proof.json`, `unknown-preservation-proof.json`, `server-cleanup-proof.json`, `live-first.json`, `live-final.json` and `local-test-cleanup.json`. Their source snapshots, logs and detailed rows remain private. The local `README.md` supplies decryption and isolated restore instructions without embedding password values.

Additional protected proofs: `archive-restart-proof.json`, `final-wal-offload-proof.json`, `wal-cleanup-proof.json`, `maintenance-final-proof.json`, `live-archive-first.json` and `live-archive-final.json`. The earlier residual-archive proof records the issue before correction.

Verification: resolved deployed Compose changes only the PostgreSQL command; actual startup/readback and preserved mounts/rows pass. `python3 docs/implementation/backlog.py check`, local Markdown link resolution and `git diff --check` pass. The repository change is the dedicated-host operational startup override plus documentation; no game rules or Fleet source changed.
