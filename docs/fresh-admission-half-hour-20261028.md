# Published admission repairs and fresh run — 28 October 2026

The owner-authorized fixes were committed, pushed and deployed, followed by a fresh 24-kingdom, 30-minute Nemotron 4B run. Work was inline without a GUI. **The reliability trial failed**, although construction progressed. The world is now paused and all owned execution services/provider are stopped. E4/KQ1 remain blocked; older worlds and unknown usage were preserved.

Deployed source: Fleet `bb4420e8e4e7bcf2a830f8cd013f6e2726191edb`, PACT `a11105c14228e97da9455f067939ad9b71ec6e38`, both published to `origin/master` before deployment. Production repairs are in Fleet; PACT's authoritative rules, economics and handlers did not change. [Fleet's complete report](../../fleet/docs/fresh-admission-half-hour-20261028.md) contains the architecture breakdown, queue distributions, correction outcomes, source attribution and private evidence inventory.

## Actual run

The window was **00:09:13.826–00:39:13.826 Europe/Berlin on 28 October** (23:09:13.826–23:39:13.826 UTC on 27 October). It used separate fresh databases and three kingdoms in each of eight profiles. Thinking-enabled Nemotron 4B ran through isolated vLLM with unchanged 64K context, 128KB input-byte limit, 8K output allowance and existing turn/call bounds. No configuration was tuned during the run.

| Measure | Previous fresh half-hour | This run |
| --- | ---: | ---: |
| Attempts / committed actions | 148 / 67 | 98 / 47 |
| Completed upgrades at cutoff | 39 | 29 |
| Reported model calls | 165 | 102 |
| Unknown model allocations | 0 | 6 |
| Proven not dispatched | 6 | 8 |
| Rejection/error turns excluding planned drain | 10 | 20 |
| Accepted contacts / messages | 0 / 0 | 0 / 0 |

All 24 kingdoms attempted work; sixteen acted across seven architectures. The 47 actions reconcile to 71 native committed receipts minus 24 preparation receipts. Completed upgrades were 15 farms, five barracks, six markets, one mine and two walls. Seven upgrades remained active and four waiting. One contact request remained pending. Two supply offers were open and one expired; no contracts or training batches existed.

Reported-call queues averaged **34.803 seconds**, with **210.669-second p95** and **336.846-second maximum**. Previously these were 28.673 / 84.546 / 193.581 seconds. The six unknown calls waited an average 329.590 seconds, maximum 354.349 seconds. Eight legacy calls expired while queued after approximately 180 seconds; their queue field is missing, not zero.

Twenty terminal error/rejection outcomes comprise eight model deadlines, six worker-expiry holds, two turn deadlines, two resource conflicts, one forbidden operation and one duplicate negotiation. Two additional refusals were planned model-admission drain at cutoff. Two v2 responses reached the 8,192 output cap. The largest measured input plus full output allowance occupied 68.36% of context, while the largest request used 99.26% of the separate byte limit.

## What the result establishes

Serial inference waiters released worker execution slots, with a sampled maximum of sixteen running turns including thirteen waiting. However, the four-bypass fairness barrier can again withhold spare inference capacity. Native calls can also be admitted with only seconds left on their original turn deadline: the queued full-generation guard protects the operator window, not each turn. Four affected reservations had only 4.946–9.800 seconds left. Legacy calls instead consume their 180-second model allowance while queued. These are engineering composition/deadline issues, not evidence that every failure is caused by model intelligence.

E3, G1, G2, G3, H2 and H3 retain unknown usage, totaling **393,216 reserved tokens**. All coordinator kingdoms were held before a successful coordinator workflow; this prevents a fair social/architecture ranking. The new goal-feedback path was exercised, but bounded corrections did not resolve every resource conflict or duplicate negotiation. No fresh coordinator reconsideration or exact tick retry occurred. Social exchange remains unachieved in this run.

## Verification and preserved state

The deployed source had passed 1,161 units and 221 distinct isolated integrations, including all eight native workflows and event-to-contact acceptance, plus types/style/build/boundaries. Deployment builds, artifact/model hashes, a fresh 300-second clock control and baseline encrypted restore passed. Those checks did not predict the full-load live deadline problem.

Automatic closure occurred 357 ms after the scheduled cutoff. The world is paused at tick 29; all 24 cohorts are paused, eighteen agents ready and six held. There are no running turns, reserved allocations, capacity leases or pending/unknown game commands. The six unknown model allocations remain preserved. Drain did not time out; all eight owned execution processes/provider stopped. Final authenticated encrypted restoration matched 167 PACT and 77 Fleet tables, completing 45.026 seconds after cutoff. Database storage and private evidence remain retained.

This report is documentation following the deployed release. No repair/replay of unknown usage, second trial or long run was performed. The next engineering work is consistent per-turn admission/cancellation/settlement under the observed burst, followed by offline workload verification. E4/KQ1 remain blocked.
