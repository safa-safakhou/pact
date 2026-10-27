# Published fixes and fresh 24-kingdom run — 27 October 2026

The owner-authorized fixes were committed and pushed in both repositories, deployed to a separate fresh world, and exercised for 30 minutes with Nemotron 4B only. The run completed inline without a GUI. The world is now paused; all owned execution services and the provider are stopped. Older worlds and unknown allocations remain preserved, and E4/KQ1 remain blocked.

Deployed source: Fleet `b01c8028a64472f4e2fcfb41f4834d19c84e0317`, PACT `c33c665c0c6794bcb46596ce3dc6b238bec12d75`, both pushed to `origin/master` before deployment. This report is a later documentation commit. PACT production rules/schema were unchanged; native authorization, exact resource accounting, leases, command receipts and atomic effects remained authoritative. The [paired Fleet report](../../fleet/docs/fresh-reliability-half-hour-20261027.md) contains architecture, context, correction and capacity details.

Fresh preflight passed 1,152 Fleet unit tests and 193 isolated integration cases, Fleet type/style/build/boundary checks and PACT API/rules/notification-worker builds. The native offline cases use synthetic providers and fresh test databases. All 11 pinned model files and staged release artifacts were verified; a fresh five-minute host-clock check passed. Baseline and final encrypted restores matched 167 PACT / 77 Fleet tables.

## Actual half-hour

The scheduled window was **20:08:01.770–20:38:01.770 UTC / 21:08:01.770–21:38:01.770 Berlin**. It contained 24 new kingdoms, three per architecture. No settings or source were changed during the run. Nemotron 4B used thinking, 65,536 context tokens, 128,000 input bytes and 8,192 output tokens, with physical cache admission and bounded calls/correction.

| Measure | Result |
| --- | ---: |
| Kingdoms attempting / architectures acting | 24 / 8 |
| Turn attempts | 148 |
| Committed agent actions | 67 |
| Completed upgrades at original cutoff | 39 |
| Pending contact requests / accepted contacts | 7 / 0 |
| Messages / reciprocal pairs | 0 / 0 |
| Reported model calls | 165 |
| Known input + output tokens | 3,025,671 |
| Unknown allocations / proven not dispatched | 0 / 6 |
| Output-truncated calls | 2 |

The 91 native committed receipts include 24 owner-preparation receipts; only the remaining 67 count as agent actions. Completed upgrades were 17 farms, ten barracks, six markets, four walls and two mines. Eight upgrades were active and five Hall upgrades waiting when paused. All Halls remained level 1. There were two open and two expired supply offers, no supply contracts and no training batches.

Ten terminal rejection/error outcomes remain: five autonomous resource conflicts, one autonomous goal cycle, one duplicate negotiation, one autonomous deadline, one legacy tick-pending result and one coordinator structured-capacity conflict. The separate 28 `RUN_WINDOW_MODEL_DRAINING` outcomes reflect planned admission closure near the deadline; the raw supervisor counter combines them into 38 nonstandard outcomes. They must not all be classified as model failures.

The bounded correction path made 21 calls across 13 turns. Six turns ended with `WAIT` (one also committed an action); seven ended in another rejection. Exact resource feedback reached the model, but five turns still repeated unaffordable supply/training choices. Fresh coordinator reconsideration did not occur in this trial; its acceptance remains offline only.

The largest input plus output allowance used 74.02% of the 64K context. The separate request-byte cap reached 99.04%, and two responses exhausted their 8K output cap. Average provider / end-to-end time was 15.709 / 44.381 seconds, with a 218.450-second maximum recorded queue. Peak sampled GPU memory was 13,792 / 16,303 MiB, sampled concurrency three, and recorded cache preemptions zero. No claim of four concurrent large requests is made.

Compared with the preceding Nemotron half-hour, unknown usage fell from two allocations to zero, but actions fell from 88 to 67 and messages from seven to zero. This single run demonstrates cleaner settlement and continued construction, **not reliable social coordination or an overall behavioral improvement**. Context packing headroom, output truncation, queue latency and unsuccessful corrections remain open research/engineering findings.

## Closure and preservation

Automatic deadline closure was recorded 197 ms after the scheduled end; the world is paused at tick 29 and all 24 cohorts are paused. All agents/credentials are ready. No running turns, capacity leases, pending/unknown platform commands, unknown/reserved model allocations or held agents remain in this new world. Drain did not time out. Owned provider, Fleet worker/console, PACT API/rules/event publisher, supervisor and guardian processes were confirmed stopped.

Final authenticated encrypted restore completed at 20:38:39.177 UTC and matched every row in 167 PACT and 77 Fleet tables with restore-network access disabled. The private root is `~/.local/share/pact-fresh-canary-20261027-37bf4947/`; evidence, credentials and backups remain outside Git. Older paused worlds, including their unresolved allocations, were untouched. E4/KQ1 remain blocked. This completed assignment does not start another run.
