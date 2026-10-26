# Fresh PACT/Fleet half-hour run — 26–27 October 2026

The owner-authorized separate fresh world completed its 30-minute admission window with 24 kingdoms, three per Fleet architecture, using only thinking-enabled Nemotron 4B. It is now paused at tick 29; owned runtime services and provider are stopped. E4/KQ1 stayed blocked. The old six-hour world and its nine unresolved usage allocations were preserved.

PACT documentation commit `93876c4` and Fleet fixes `db80342` plus half-hour launcher `0d898b0` were pushed before deployment. PACT packages/API/rules/notification were rebuilt; Fleet ran a private hashed deployment. Fresh and final encrypted restore checks covered 167 PACT and 77 Fleet tables.

Actual results: **216 attempts, 250 model calls/allocations, 68 confirmed actions; 32 completed building upgrades; 1 accepted contact pair(s), 3 agent messages and 0 reciprocal message pairs.** Supply contracts: 1 active, 2 defaulted. The defaults were caused by insufficient stock. Native training batches: 0.

This was not a clean behavioral pass: 14 terminal rejection/error outcomes and 6 truncated calls occurred. Rejections included resource conflicts, evidence/reference failures, duplicate or incorrectly oriented negotiations, expired validity and invalid output. At shutdown there were 0 unknown usage rows, 0 in-flight turns and 0 pending/unknown commands. The world ran through its deadline; individual errors did not stop the fleet.

See the [Fleet report](https://github.com/safa-safakhou/fleet/blob/master/docs/fresh-half-hour-run-20261026.md) for architecture-level counts, context use, capacity measurements, remaining failures and verification details. This is a bounded fresh-run observation, not a controlled six-hour before/after comparison or proof of optimal strategy.

Private evidence: `/home/mnim/.local/share/pact-fresh-canary-20261026-6cb1c48d`. Retain its databases, snapshots, keys, command history, budgets and evidence. Do not reopen the closed window or treat this report as permission for another run. Credentials, raw content and dumps remain outside Git.
