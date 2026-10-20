# Local-world master publication — 20 October 2026

The founder requested committing the local-world changes, reports and result documents and pushing both repositories to master. PACT integrates `codex/local-world-preparation` at `9c2d00f66cf51a5226a040353c74fa7fd9829c09` with master at `1d93da690cd1a2ae4821b799ca79e5961252e3c8`, retaining the two earlier setup/comparison planning commits and all experiment/repair history. The merge required no source conflict resolution. Fleet's paired master publication is `a6ef7299b1907561d2c47a87acc5a11f547fb6a7`, preserving its separate specialist architecture plans.

## Included results

The [latest four-profile reasoning review](fleet-reasoning-outcomes-20261020.md), [fresh thirty-minute world](local-fresh-half-hour-20261020.md), [earlier thirty-minute observation](local-half-hour-20261020.md), [repaired hour](repaired-hour-observation-20261019.md), [initial hour](local-world-observation-20261019.md) and all intermediate repair/approved-recovery reports are included. Their original failures, receipts, model counts and partial acceptance remain recorded. Full request/response packets and private runtime state remain outside Git.

The latest native pass produced four committed commands in four turns/nine reported allocations. It did not activate or deliver a trade, and the legacy profiles still made inaccurate peer/effect claims. Later factual peer-consent and normal-READ classification fixes have offline acceptance only. Source publication is not another experiment or a claim that strategic reasoning is fully reliable.

## Integration correction

Full verification exposed a stale smoke-test inventory: the MCP connection-isolation repair adds `0072_mcp_connection_sessions.sql`, but the readiness smoke test still expected migrations only through `0071`. A fresh isolated smoke run failed with exactly that additional migration; the expectation was extended, and the same test passed. No production behavior was changed during integration.

## Verification

Node 24.21.0, a clean `npm ci`, rebuilt workspace packages and dedicated synthetic PostgreSQL 17 fixtures were used.

| Check | Result |
|---|---|
| `npm run lint` | Pass; existing warnings, zero errors |
| `npm run typecheck` | Pass |
| `npm run build` | Pass for all workspaces |
| `npm run check:non-game` | Pass |
| `npm run db:migrate` | Pass against the disposable fixture |
| `npm test` | 409/409 |
| `npm run test:integration -- --maxWorkers=1` | 66 files passed; 466 tests passed, 1 skipped |
| Focused migration/readiness smoke regression | Failed before the expectation correction; 1/1 after |
| `node --test scripts/local-world/gateway.test.mjs` | 1/1 |
| Paired Fleet acceptance against integrated PACT packages | 14/14 |
| `python3 docs/implementation/backlog.py check` | Pass: 181 tickets, dependencies/source snapshots/6 views valid |

The final full serial integration run exited successfully in 265.13 seconds on the corrected tree. The skipped test is the opt-in actual loopback-model comparison; publication authorizes no additional model calls. `git diff --check` and the new publication reports' local links also pass. No hosted CI result is claimed by these local checks.

The initial check used stale ignored dependencies/compiled packages in the master checkout; a clean install and CI's build-before-test sequence resolved those failures. Default parallel integration hit the fixture migration lock timeout. Serial verification uses `--maxWorkers=1`; a wrong-name fixture attempt was stopped after its isolation guards rejected it. Those diagnostics are retained separately from the final result. The [Fleet publication record](https://github.com/safa-safakhou/fleet/blob/master/docs/project/local-world-publication-20261020.md) records its 328 Linux unit, 414 Linux integration and 14 paired checks, build/boundary/type/style checks and zero-vulnerability production audit.

## Preserved runtime

No new real model call, gameplay turn, deployment, account/recovery change, reset or replay was performed for publication. The latest accepted world checkpoint remains parked at 40 turns/64 allocations, with its original reviewed unknown 40,000-token allocation and history retained. Existing live worktrees and installed Fleet `2d4d85b` / PACT `bb17142` artifacts are retained. Other populations and historical experiments retain their prior scope. Local verification is distinct from hosted CI.
