# Season lifecycle

Ticket: PACT-069 / [MNI-140](https://linear.app/mnim/issue/MNI-140).
Implementation revision: this report's implementation commit.
Environment: 1 October 2026, local Node 24 and isolated PostgreSQL 17 schemas.

## Result and acceptance

Configured/persisted six-week opening, actual Farm harvest, pre-boundary closing Fortune, next-season baseline, highest Hall and immutable equal-age arrival snapshots now run inside the authoritative transaction. HTTP, external MCP, in-app agents, the learning guide and web Kingdom panel expose committed season/transition data and truthful pending/provisional labels. Private baseline/wealth are not public fields.

1. `tests/unit/seasons.test.ts` evaluates all 60,480 minutes with exact 100/100/90/80/80/100 arithmetic. `tests/integration/seasons.test.ts` accelerates a disposable schema to selected real weekly boundary ticks; actual production and owner forecasts use the right harvest. Rollover closes pre-boundary wealth and credits economic changes to season two.
2. The integration fixture preserves active supply terms/version and pinned raid rows, buildings and troop placements through pause, failed rollover and fresh-runtime retry; one installment and one closure survive. Age-seven-day capture retains activation baseline zero across rollover; later wealth cannot rewrite that score. UTC Monday grouping and pending scores are tested. Exports/deletion and real-time 180-day history pruning preserve active baselines.

Verification: `npm run build`, `npm run typecheck`, `npm run lint` pass; `npm run test` passes 202 tests and `npm run test:integration` passes 281 tests with one pre-existing skip. After final safe-time/import cleanup, package rebuild/typecheck and targeted season/MCP regression pass all ten tests. `python3 docs/implementation/backlog.py render`, `python3 docs/implementation/backlog.py check`, `git diff --check` pass. MCP discovery/read validation covers credential-derived identity, unknown-owner input rejection and missing read-scope denial. Web static-render assertions cover the visible labels; these are not a new hosted browser observation.

## Documentation and limits

See [season module/API/retention instructions](../../architecture/seasons.md) and `.env.example`. Default opening persists the existing committed minute at installation; explicit opening must match it. No live clock acceleration, retroactive scoring or reset was performed. Old missed age-seven-day samples are unavailable, never invented. Assets/contracts continue; no competitive rank awards are finalized here.

Local implementation only: no push/deployment, paid provider, hosted CI or real-player enjoyment claim. Hosted release remains `alpha-20260929-4` / `2143d92`. PACT-070 follows after fresh Linear dependency verification; PACT-073/099/080 still own remaining Alpha work.
