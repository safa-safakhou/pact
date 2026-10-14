# PACT backup offload and server recovery

**Completed:** 14 October 2026, 16:43:46 Berlin. The founder requested moving the latest backup to this Windows machine and removing the server backup copies. Local integrity checks and isolated PostgreSQL restores passed before deletion. Server disk usage is now 26%, both databases answer queries, the game clock advances, and the original fifty-agent Fleet cohort continues running.

## Local recovery copy

The complete recovery directory is `C:\Users\ENDORFY\PACT-Backups\2026-10-14`. Its Windows ACL grants access only to the local owner and SYSTEM. Credentials, keys, database dumps and raw runtime evidence remain outside Git. The directory includes an operator `README.md`, the Restic executable, decryption files, encrypted repository and verification records.

| Preserved material | Recovery point and verification |
| --- | --- |
| Latest successful PACT snapshot | Source `cd3c3823a37716dfe98318c39575c4f186852fef453bc43e229d76925c40cb14`, 14 October at **15:19:54 Berlin /13:19:54 UTC**. Includes `/backup/base` and `/backup/wal`, 6,110,580,196 restored bytes and 2,282 file/directory entries. |
| Independent local PACT snapshot | `f71ae42e7aacc7d396cbf3d8de955092ff69d5161ced9847aeff5dee1a6c4073`. Same tree, paths and timestamp as the source. All referenced data was copied, re-encrypted and checked locally; the PACT repository occupied 1,083,996,479 bytes before adding supporting material. |
| Server recovery configuration and historical Fleet backups | `server-recovery-material.tar.gz`: all ten Fleet dumps and their associated files, Fleet environment, PACT production configuration/secrets, and original backup units. All 45 source files matched local SHA256 hashes and sizes, totaling 20,977,841 uncompressed bytes. |
| Fresh Fleet database | `fleet-current-20261014.dump`, captured around **16:38 Berlin** today; 16,068,494 bytes. SHA256 `817de7aed66384821c28cf1a4dc98028e5d7923c711ef0d18def83192940b466`. Successfully restored into a second isolated local database. |
| Encrypted supporting snapshot | `8fd355aa653951b2bd039a31c6dd2830e2d579c53d78f33018138cc7d133694e` contains both the support archive and fresh Fleet dump. A second full repository data check passed; restored support files matched their originals by SHA256. |

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

## Evidence and verification

Protected local proofs under the recovery directory's `verification/` include `transfer-verification.json`, `restore-proof.json`, `support-verified.json`, `fleet-restore-proof.json`, `fresh-fleet-proof.json`, `encrypted-support-proof.json`, `unknown-preservation-proof.json`, `server-cleanup-proof.json`, `live-first.json`, `live-final.json` and `local-test-cleanup.json`. Their source snapshots, logs and detailed rows remain private. The local `README.md` supplies decryption and isolated restore instructions without embedding password values.

Repository verification: `python3 docs/implementation/backlog.py check`, local Markdown link resolution and `git diff --check`. This report and the host operations update are documentation changes; no game or Fleet source change is part of this offload.
