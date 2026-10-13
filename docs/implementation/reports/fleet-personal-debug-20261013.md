# Local, server and personal-account debug audit — 13 October 2026

Founder requested checking the five local Fleet accounts, fifty server Fleet accounts and three personal ChatGPT-connected PACT accounts, their logs and blockers. This is a diagnosis and report assignment. No inference was initiated by the audit, no account was replaced, no command was replayed, and no service, schedule, model, budget, mandate or unknown-usage review was changed. Existing automatic turns continued during inspection. No delegation was used.

Result: **the installations are reachable, but the entire system is not operating smoothly. Three of the five local owners are blocked; the server fleet runs all fifty but still makes occasional invalid reads and little useful progress; personal connections work, with an unresolved host-observation gap for Khanom.**

## Evidence and scope

Inspection ran approximately **14:10–14:25 Berlin**, with fixed Fleet accounting snapshots at **14:24:04 server / 14:24:06 local** (`12:24 UTC`). Queries were read-only; successive queries can see newly completed automatic turns. Hourly figures below use each snapshot's preceding hour, not a claim of an atomically frozen whole system.

Checked every active Fleet roster row, credentials-state metadata, lifetime and recent turns, encrypted consented event metadata, command-resolution codes, compute ledger, communications counts, worker heartbeats, process/container health and resource headroom. Fresh authenticated owned-world HTTP reads returned **200 for all 55 Fleet accounts**, and every returned kingdom ID matched its retained account binding. All three personal links independently passed live authenticated guide/status/report reads. The personal-account external-result table was queried beyond the 50-entry report limit for the last 24 hours.

Private aggregate/owned-state evidence is retained at `~/Library/Application Support/Fleet/nemotron-local/state/debug-20261013/` with directory mode 0700 and files 0600. Credentials, raw contexts, private correspondence and personal account identifiers are excluded from this report and Git. Helpers used protected environment files without printing their secrets. Protected evidence includes initial/final Fleet snapshots, owned-world checks and sanitized event details.

Application regression tests were not run: this audit changes documentation only. Operational reads prove current reachability and recorded behavior, not future uptime or absence of every possible defect. ChatGPT's private inference transcripts, scheduled-task execution logs, host-side approval failures and consumer usage limits are outside the PACT telemetry available here; the audit cannot certify those from game receipts.

## Local Mac Nemotron fleet

Native runtime remains `e7f530432f4fc55b00e4e82f4a9d3c6def1af108`. Cohort **Mac Nemotron 5** remains continuous/running, `nemotron-3-nano:4b`, thinking true, serial execution and the original fifteen-minute anchor. Both launch agents have live PIDs and last exit status zero. PostgreSQL is healthy with zero restarts, Ollama responds, Fleet health reports enabled, and worker heartbeat is current. Console/worker stderr files are empty. Empty process logs do not mean successful turns: failures are recorded in the database.

| Account | Scheduler state at cutoff | Latest result / last finished turn, Berlin |
| --- | --- | --- |
| Mac Nemotron 5 01 | Ready | WAIT, 14:22 |
| Mac Nemotron 5 02 | Needs owner | INVALID_DECISION, 12:25 |
| Mac Nemotron 5 03 | Ready, repeatedly failing | INVALID_GAME_ACTION, 14:13 |
| Mac Nemotron 5 04 | Needs owner | TRANSPORT_UNCERTAIN, 14:00 |
| Mac Nemotron 5 05 | Needs owner | INVALID_DECISION, 13:34 |

At cutoff: **33 turns, six committed actions, 40 executions: 37 reported and three unknown**. Reported usage is **247,089 input/output tokens**; the three unknown calls retain **120,000 allocated tokens**, which is not measured usage. All five credential records are ready and all five owned reads succeed. There are no pending game commands on the three blocked turns. No owned construction snapshot requires a cancellation. Account 03's Hall II awaits Barracks II, with another position free; this is a prerequisite planning problem rather than an owner-required deadlock.

### Actual defects and model failures

1. **Malformed-output accounting defect.** `HttpModel.decide` in `fleet/src/model.ts` parses `message.content` before extracting/returning `prompt_eval_count` and `eval_count`. On missing/non-JSON content it throws `INVALID_DECISION`; `Engine.run` records usage only after the model method returns. Consequently a completed but malformed provider response can lose its otherwise available usage counters and become an unknown ledger reservation. The two invalid-decision incidents have no returned usage or model-selected event. The source path is verified; their exact original response/usage was not retained, so it cannot now be reconstructed or relabelled as reported. Exhausting the thinking/output budget is a hypothesis, not an observed cause.
2. **Repeated invalid action structure and fabricated versions.** Consented events show several action decisions with no `action.kind` (`actionKind: action`), ending `INVALID_GAME_ACTION` before submission. Other attempts supply mandate versions **0, 48, 9007199254740991 or a game timestamp**; PACT correctly rejects them with `STALE_VERSION`. Some valid actions committed, so this is not a universal transport/authentication failure. The local model does not reliably follow the supplied schema/current authority facts. These errors are not proof of actual mandate drift. Known rejections are preserved, with no successful action inferred from a failed turn.
3. **Sleep interrupts local inference and scheduling.** Account 04's call was reserved at **13:53:27 Berlin**. macOS recorded maintenance sleep at **13:53:25** and wake at **14:00:26**, matching the turn's transport-uncertain finish. The elapsed turn is roughly seven minutes although normal call/turn bounds are 90 seconds/two minutes; sleeping suspends the host's timers. The sleep alignment strongly explains this interruption, but does not recover provider usage. Earlier idle sleep from 13:35–13:52 also disrupted the intended fifteen-minute pacing. Per-user launch agents do not keep a sleeping Mac executing.

Concrete new review records, each with full 40,000 allocation retained:

| Account | Original turn | Code |
| --- | --- | --- |
| 02 | `511a1174-d207-48ec-b7a7-5e53857f89a8` | INVALID_DECISION |
| 05 | `3a010ba2-13e1-429f-8cc4-873a012364e5` | INVALID_DECISION |
| 04 | `fe99bd10-91c9-4860-9c1c-c58c7c6110c8` | TRANSPORT_UNCERTAIN |

None was acknowledged, cancelled or resumed by this audit. Standing instructions require a separate explicit review of each new uncertainty. The cohort's running label currently coexists with three owners needing review; health alone must not be read as five healthy agents.

## Server Luna fleet

Runtime remains **Fleet `b4ad9db` / PACT `fleet-p1-20261013-1`**. The intended fifty-owner cohort is running, **all fifty scheduler records and credentials are ready**, all fifty have turns in the preceding thirty minutes, and all fifty fresh owned-world reads succeeded. No current needs-owner/pending turn or new unknown usage was present at the final accounting query. The two previously reviewed historical unknown ledger rows remain unchanged with 80,000 total allocation. The finished five-owner pilot's old pending command and inactive learning draft are historical, not new failures in the active fifty.

All fifty owned construction checks showed **zero owner-required deadlocks**: 48 progress-possible and two waiting/unknown snapshots. This does not guarantee every model will choose its prerequisite. Both Fleet containers and sampled PACT API/rules containers have zero restarts. Public PACT/Fleet health passed; local and public Fleet private-state requests without login returned 401. The game clock was active at tick 23,238 with a current heartbeat and no suspension reason; no expired durable-job lease was found.

At cutoff, the fifty have **3,248 lifetime turns and 357 committed actions**. The preceding hour has **200 finished turns, 271 executions, 14 committed actions and 4,301,719 reported input/output tokens**. Final turn codes: 142 WAIT, 53 READ, three COMMITTED, one INVALID_TOOL_ARGUMENTS and one READ_TOOL_FORBIDDEN. Some WAIT/READ turns contain an earlier commitment; final code alone is not an action count. No new message/agreement commitment is established by these aggregate counts.

The latest invalid-read incidents were:

- **Agent 08**, 13:53 Berlin: INVALID_TOOL_ARGUMENTS; the model selected a read with an invalid input. It later completed healthy scheduled turns.
- **Agent 19**, 13:56 Berlin: requested nonexistent `pact_conversation_read_v2`. The admitted tools include conversation v1 and history v2. The final rejection remains a recorded failed turn; it later completed a healthy scheduled turn.
- Earlier errors on the same runtime include missing `handle` for player lookup and nonexistent `pact_read_schema`. Bounded refusal/correction prevents unauthorized reads but does not ensure a model learns the correct name. Duplicate contact attempts were correctly rejected.

**Operationally running does not establish good planning or negotiation.** Most turns still end in wait/read, and the model continues to invent some tool names. Existing repair acceptance should not be presented as a guarantee of error-free future turns.

Server RAM has about 5.1 GiB available and sampled service CPU is low. Disk has roughly **13 GiB free (83% used)** against Fleet's configured/default 10 GiB admission floor, leaving limited headroom. No disk admission failure is recorded, but capacity deserves attention before it crosses the floor. The Mac has roughly 30 GiB free. These are measured capacity observations, not a disk cleanup authorization.

## Three personal ChatGPT connections

| Link | Authentication/current game | Last recorded gameplay result, Berlin | Finding |
| --- | --- | --- | --- |
| Agha mnim / MNIM_TEST | Passed; active; most buildings IV, Wall III | Training committed at **13:41** | Recent successful operation. One TICK_PENDING message at 10:28 was followed by committed messages at 10:29. No persistent blocker established. |
| Mashala mnim / MNIM_test2 | Passed; active; most buildings III, Wall II | Training committed at **13:37** | Recent successful construction/training; no failed external result in the preceding 24 hours. |
| Khanom mnim / MNIM_Test1 | Passed; active; most buildings III, Wall II | Building cancellation **FORBIDDEN at 08:37**, after Storehouse IV queued at 08:36 | No later gameplay result in server records by cutoff. Current Storehouse IV is active and Market IV waits on stock with prerequisites ready; no construction cancellation/deadlock recovery is required. Host-side continued execution is unverified. |

Current unrevoked MCP grants exist for each personal account, and all three linked tool reads succeed. No active write lease is currently recorded for these three kingdoms; an external ChatGPT conversation need not hold a lease between moves. Their built-in persistent-play lists are empty and the API inference host is explicitly disabled with a fresh heartbeat. This is the existing built-in API configuration, not proof that external ChatGPT automation is stopped or enrolled. It was not enabled.

Recent personal game facts show real progress. Their persisted strategic ambition notes contain outdated building/resource facts, especially Khanom's old Hall/Barracks III recovery instruction after those buildings have already completed. These notes are model memory, not server authority. Refreshing strategic memory from current state is appropriate; no note was overwritten by the audit.

Khanom's refused cancellation is an enforced authority boundary. Earlier personal logs also contain lease/approval-input failures; they are historical and are not current proof of an outage. ChatGPT-side safety/approval refusals may happen before PACT receives a request and are absent from these server records. No blocked action was retried or bypassed.

## Prioritized follow-up

1. Repair the local HTTP model boundary so completed responses return reported usage even when decision JSON is invalid. Distinguish malformed/truncated output from transport uncertainty, preserve unavailable historical usage honestly, and provide bounded schema-error feedback without extra calls/actions.
2. Improve local action validation/feedback: require a concrete admitted action shape, use current mandate facts and correct optional version fields, and expose invalid action details rather than repeatedly spending turns on the same malformed shape. Verify with synthetic responses and the installed model's actual thinking/output behavior under a separately covered inference assignment.
3. Review the three exact local unknown turns individually, retain allocations/history, and resume only the same owners after the repair/review boundary. No automatic unknown acknowledgment or blind replay.
4. Choose an explicit awake/AC operating arrangement for this local fleet and record sleep/wake interruptions clearly. Do not silently change machine power settings or restart inference.
5. Check **Khanom's actual ChatGPT task/conversation log** for the gap after 08:37 and any host-side approval block. Game authentication and active construction are healthy; server records cannot certify its consumer scheduler. Refresh personal strategic notes when covered by an edit assignment.
6. Continue reducing invented server read names within existing decision bounds; assess useful progress separately from uptime. Review server disk capacity and retention before admission falls below its free-space threshold. No provider migration, forced communication, new population or discovery deployment is part of this audit.

Both Git working trees were inspected. Unrelated PACT application/MCP edits appeared during the audit and were left untouched. Only this report is part of the local completion commit; no gameplay code, tracker status, credentials or runtime evidence is committed.
