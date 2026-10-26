# Six-hour run: investigation handoff

Follow-up: [Agent society systems investigation](agent-society-system-investigation-20261026.md) adds the causal analysis and links to Fleet's detailed architecture/context report. No runtime changes were made.

Use this note to continue the investigation from a separate PACT checkout. The authoritative cross-system handoff is in the Fleet repository:

- [Fleet investigation handoff](https://github.com/safa-safakhou/fleet/blob/master/docs/six-hour-investigation-handoff-20261026.md): findings, source entry points, unresolved questions, evidence locations and reproduction limits.
- [Full inspected results at the published source checkpoint](https://github.com/safa-safakhou/fleet/blob/4295adadb5a6666fe5abf03b385f52c4b0be0a69/docs/six-hour-run-inspection-20261026.md).

## Results and last verified state

The fresh world ran **26 October 2026, 02:31:04–08:31:04 Berlin**, with all 24 kingdoms across eight architectures. Read-only inspection at 08:51 UTC verified **paused tick 359**, runtime services/provider stopped, zero running turns/capacity leases and no pending/unknown game commands. The databases and private evidence remain retained.

- **2,430 turn attempts; 207 committed actions; 52 completed building upgrades.** All Halls remain level 1, with 24 construction instructions waiting.
- **55 messages, three accepted contact pairs, eight pending introductions**, four active supply contracts and one defaulted contract.
- **3,062 reported model calls, 34,305,904 known tokens**, plus nine unknown allocations retaining 360,000 reserved tokens. Unknown reservations are not measured usage.
- Nine held kingdoms: **C2, D1, E1, E2, E3, F2, F3, H1, H2**, all with `WORKER_EXPIRED`. The first unknown allocation was created about 44 minutes into the run; the exact expiry causes remain unestablished.

## Unresolved findings

1. Autonomous specialists repeatedly fail context/read handling: **435 context-incomplete and 317 read-required errors**.
2. Coordinators produce **172 stale proposals** and only one committed action in 184 attempts.
3. **83 waits are rejected**: 46 factual-state mismatches and 37 model-wait rejections. Compare requests/responses with PACT's actual authorized state.
4. Higher-tier progression stalls despite completed upgrades; inspect real prerequisite queues/resources before assigning a cause.
5. **107 call responses record truncation; seven terminal turns end truncated**. These are different denominators.
6. Primary supervisor fails with `SUPERVISOR_FAILED_CLOSED`, leaving a stale `draining` record and no run-final report. The independent guardian did complete deadline shutdown and encrypted restore across **167 PACT / 77 Fleet tables**. The primary exception's underlying cause remains unestablished.

These are symptoms and investigation targets, not proof of exact root causes or completed fixes. This run did not establish behavioral/reliability acceptance.

## Preservation and continuation

Nemotron 4B was the only live model, with thinking enabled and 8,192 output tokens. **E4/KQ1 remain blocked.** Keep the world paused and preserve identities, mandates, budgets, exact commands, queues, unknowns and evidence. The old archived world has five separate unknowns; the fresh world's nine must not be conflated with them. No restart, deployment, replay or usage reset is authorized by this publication.

Private evidence remains on WSL at `/home/mnim/.local/share/pact-fresh-canary-20261026-523b92de`, pointer `/tmp/pact-six-hour-root`. Git does not contain that database, detailed traces, correspondence, keys or dumps; a separate machine needs authorized private evidence access for exact reconstruction. Use synthetic fixtures for offline reproduction. The Fleet handoff lists the files and source paths to begin with.

Published source checkpoints before this documentation handoff: PACT `4df9ff6cda272333fd4802961acfe11aca85eaa5`, Fleet `4295adadb5a6666fe5abf03b385f52c4b0be0a69`. The live release is pinned separately in its private manifest. Fleet includes a post-run source-only evidence-diagnostic correction that was not deployed into this run.

PACT's MCP annotation fix passed three unit and four isolated native integration checks, types, MCP build, boundaries and published-contract checks. Fleet's unit/selected integration checks passed; the full historical integration suite was interrupted, not certified passing. These offline results do not resolve the live findings.
