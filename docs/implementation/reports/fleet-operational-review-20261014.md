# Fleet operational and kingdom progress review

**Inspection date:** 14 October 2026. **Final checkpoint:** 16:13:54 Europe/Berlin (CEST, UTC+02:00). Read-only probes ran from 16:08:29 to approximately 16:14.

**The server is experiencing a disk-exhaustion outage. The fleet cannot be described as running correctly.** Root filesystem space is exhausted, both PostgreSQL services have reported no-space failures, and the PACT database is repeatedly entering recovery. The Fleet worker and PACT API are restarting. Fresh authoritative account and kingdom queries could not complete reliably, so the latest gameplay stage remains unverified.

## Current operational findings

| Check | Current observation | Consequence |
| --- | --- | --- |
| Root filesystem | `/dev/sda1`, 80,279,486,464 bytes capacity, about 76.98 GB used, **zero available bytes**, 100% use. Inodes only 7% used. | Capacity exhaustion, not an inode shortage. Database writes are failing. |
| Fleet worker | Deployed revision `b4ad9db3c1010490f19b4aec2f644ce1b8c82c92`; seven restarts at 16:08, **18 restarts and restarting** at the final checkpoint. | The service is not executing a reliably continuous schedule. |
| Fleet PostgreSQL | `PANIC` and `FATAL` errors include failure to write `pg_logical/replorigin_checkpoint.tmp` and init files: `No space left on device`, SQLSTATE `53100`. | Queries are intermittently unavailable or terminated during recovery. A full read-only snapshot was aborted. |
| PACT PostgreSQL | Repeated recovery-mode rejection (`57P03`) and no-space checkpoint panics. | Current world, accounts, balances, receipts and game-clock state could not be verified. |
| PACT rules worker | Restarted during inspection; repeatedly logs `rules clock poll failed the database system is in recovery mode`. | Clock polling is failing. A running container is not evidence of advancing game time. |
| PACT API | `admin-password-20261014-1`, initially healthy with zero restarts; **13 restarts and restarting** at the final checkpoint. | The outage progressed during inspection. The API is newer than the 13 October P1 release. |
| Public health endpoints | Both returned success at the first checkpoint: Fleet `ok: true, liveEnabled: true`; PACT `status: ok`. | These responses did not establish database availability, scheduling or game progress. |
| Host pressure | Load initially 0.20 / 0.46 / 0.50; about 5,993 MiB available RAM. | The evidence points to disk capacity, not CPU or RAM exhaustion. |

The earliest sampled Fleet no-space panic was at **15:56:17 Berlin**. This establishes a failure by that time, not the exact incident onset. At 16:09:33 a small query still returned one running, one finished and one draft cohort record; subsequent queries were rejected or terminated. The running label therefore must not be interpreted as a functioning fleet.

Fleet's deployed worker checks available disk before admitting a turn, while the cohort record can remain running. Its source defaults to a 10 GiB admission floor. The effective deployed threshold and last admitted turn could not be read in this outage. The service also writes its heartbeat before that disk check, so exhaustion can prevent even the worker loop from staying up. Public liveness and a persisted running label are insufficient operational checks.

## Disk consumption and backup behavior

The largest measured directories were:

| Directory | Reported size | Interpretation |
| --- | ---: | --- |
| `/srv/pact/backups/restic` | **49 GiB** | Encrypted PACT backup repository; the dominant consumer. |
| `/var/lib/docker/volumes` | 12 GiB | Persistent volumes; not classified as disposable. |
| `/var/lib/containerd` | 7.6 GiB | Container image content and snapshots. |
| `/srv/pact/state` | 989 MiB | Includes 910 MiB of release state. |
| `/var/log` | 318 MiB | Logs are not the main space consumer. |
| `/var/lib/fleet` | 40 MiB | Fleet protected state/backups are small relative to the host. |

The backup timer remained active. Its last scheduled run started at **14:23:28 Berlin** and exited successfully at **14:24:25**. The next scheduled trigger was **20:18:45 Berlin**. Successful backup completion did not ensure adequate remaining capacity for live databases.

Read-only file metadata found about 8.59 GB of Restic data files with a 14 October modification date, and 8.74 GB dated 13 October. These are modification-date inventories, not measured daily net growth or deduplication efficiency. The repository contained 40 snapshot files, all with modification dates from 8–14 October. Backup contents, integrity and restorability were not verified in this review.

The checked-in backup policy runs `forget --keep-within 35d --prune`. This is an age-based policy, not a capacity budget. The measured retained backup size is incompatible with the present host headroom; the exact retention decisions and the triggering write still need investigation. Do not interpret the observed file dates as decoded snapshot timestamps.

## Which fleet this review concerns

The last verified configuration is the original **50 distinct PACT accounts using `gpt-6-luna`, medium reasoning, Codex CLI, staggered 15-minute turns**, with shared inference concurrency one and two decisions/two actions per turn. They share one Codex subscription login; these are 50 game accounts, not 50 concurrent model processes or 50 subscriptions. The cohort began on 12 October, so it is approximately 49 hours old at this review, with documented interruptions rather than uninterrupted execution.

The live Fleet console/worker image still matches the 13 October reliability release, and `/opt/fleet/current` resolves to `/opt/fleet/releases/reliability-20261013-3`. The console had zero restarts and had been up about 29 hours at the first checkpoint. The current source repository contains later local cognition/comparison features, but those are not evidence that this pinned server runtime has them.

**A fresh model/count/account-binding read could not be completed.** Fifty Luna accounts is the last verified cohort configuration from the deployment and reliability records, corroborated by the pinned Fleet runtime, not a successful new database census. Account authentication, individual scheduler readiness, pending commands and current usage accounting also remain unverified. No new calls were requested to test them.

PACT runtime images differ by service: API/gateway were `admin-password-20261014-1`, while rules/inference/notification/channel/seals still used `fleet-p1-20261013-1` at the first checkpoint. The 13 October deployment record alone would miss that API/gateway change.

## Kingdom progress and behavior

Current Hall levels, queues, stocks, hunger, contacts, offers, contracts, troops and receipts could not be obtained because the authoritative database was failing. The following comparison is deliberately dated; it must not be presented as today's roster.

| Measure | 12 October at 22:16 Berlin | Last verified 13 October evidence |
| --- | --- | --- |
| Hall progression | 48 Hall I, two Hall II; all in I–II band. | Final owned scan around 11:26: 30 Hall I, 20 Hall II; still all in I–II band. This demonstrates overnight development, not current levels. |
| Construction | 148 completed upgrades; 26 waiting and two active orders. | Five exact owner cancellations cleared the known two-slot deadlocks; later owned scan found zero owner-required construction deadlocks. No current total completion count is available. |
| Agent 26 | Farm III / Hall II queue dependency trap. | Completed Barracks II after recovery; retained Hall II was actively building. |
| Agents 15, 21, 36, 43 | Known queue deadlocks. | Had a freed position but still needed to choose prerequisite construction. This was continuing planning weakness after queue recovery. |
| Agent 50 | Earlier stalled/read behavior. | Finished a live read turn without its former context failure; Farm III still awaited Hall II with a free position. |
| Social stage | 23 introduction requests, seven accepted contacts, seven unique messages from two senders; no supply offer/contract. | In the measured 53-turn follow-up window: one accepted contact, no new message or trade commitment. This is a window result, not a current lifetime total. |
| Military and survival | Eight Home Guard per account, no ordinary training, scouting, raid or garrison activity; no hungry troops. | No fresh complete military/hunger census was established by the cited follow-up window. Today's state is unknown. |
| Useful execution | Eight accounts had no committed gameplay action. Over the last four hours, 724/799 completed turns made no commitment. | 53 finished turns across all 50 agents: 75 reported calls, four commitments, 49 turns without a commitment. Valid execution improved, but broad strategic progress remained weak. |

The 13 October window was approximately **11:10:47–11:26:57 Berlin**, preceding the final read-name refinement's 11:29:47 resumption. Its four commitments were building orders by Agents 26, 37 and 40 and contact acceptance by Agent 2. The follow-up recorded 1,191,361 reported tokens, no new unknown/pending outcomes and no context/argument failures in that window. Agent 19's two invalid conversation-tool requests led to the final correction; they were not evidence of successful communication.

Both previously reviewed unknown allocations—Agents 31 and 36, each retaining its 40,000-token reservation and historical unknown marker—were preserved by the 13 October recovery. Their preservation does not prove that no new unknown execution arose later. This review could not reconcile any uncertainty or pending receipt created near today's outage.

**Assessment:** the last verified development stage was early growth within the first Hall band, with useful construction by some accounts and weak negotiation. Today's confirmed finding is infrastructure failure. It would be misleading to claim either continued progress or unchanged kingdom state for the unobserved period.

## Recovery priorities

1. **Restore safe disk headroom.** Prefer increasing filesystem capacity or moving the encrypted backup repository to suitable storage with an integrity-preserving procedure. Any deletion or retention-policy change needs a separate reviewed recovery action. Do not delete active PostgreSQL WAL, live volumes or backup chunks individually. Review the scheduled backup before its next trigger; this inspection did not stop it.
2. **Establish stable database recovery.** Require both databases to accept connections consistently, successful checkpoints, stable service restart counts and a fresh authoritative world-clock read. Confirm committed tick progress and overdue settlement behavior before claiming game recovery. Do not infer recovery from `/health` alone.
3. **Reconcile the existing cohort before resuming or relabeling anything.** Verify the same 50 account/kingdom bindings, model, budgets, phase/anchor, last admitted turns, reservations and original pending-command receipts. Any new unknown usage needs its own review with its allocation retained. No blind replay, reset or account replacement.
4. **Repeat the gameplay census after stable read access returns.** Compare 1-hour, 4-hour and 24-hour windows; enumerate stalled builders, stock/overflow/hunger, incoming unanswered requests, conversations, offers/deliveries and military state. Revisit the named agents above as historical cases rather than assuming their old state persists.
5. **Prevent recurrence.** Add capacity and growth monitoring that covers backup storage and database writes, plus health signals for scheduler admission, heartbeat age, game-tick lag, restart loops and unresolved outcomes. Give backup retention an explicit storage budget compatible with the host and recovery requirements.

No restart, cancellation, unknown-usage review, deployment, permission change, cleanup, restore or paid inference was performed during this inspection. Only local documentation is committed.

## Evidence and verification

Current evidence consists of timestamped SSH read-only `df`, `du`, container metadata/stats, limited sanitized error-log samples, systemd timer/service status, backup file metadata and bounded PostgreSQL read attempts. One small Fleet state query succeeded; the larger repeatable-read transaction was terminated by database recovery, and final minimal probes failed. Failing database attempts were ended rather than treated as an empty roster or zero activity. No credentials or correspondence are included here.

Historical sources and implementation references:

- [13 October P1 deployment and reliability acceptance](fleet-p1-deployment-20261013.md).
- [Full Fleet reliability follow-up](https://github.com/safa-safakhou/fleet/blob/master/docs/reliability-follow-up-20261013.md).
- [12 October baseline recorded in the investigation plan](../fleet-agent-investigation-plan-20261013.md).
- [Backup policy](../../../infra/production/bin/backup.sh) and [host layout and backup timer](../../operations/dedicated-pact-host.md).
- Deployed Fleet worker/engine inspected at commit `b4ad9db`: `src/worker.ts` and `src/engine.ts`. Later source HEAD is not substituted for deployed behavior.

Documentation verification: relative source links checked, snapshot dates and quoted counts checked against captured evidence and cited records, repository planning consistency checked, and staged whitespace checked. Application tests do not establish incident recovery; no recovery or new gameplay result is claimed.
