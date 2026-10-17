# PACT P3 — scenario qualification and outcome evidence

17 October 2026. Founder assignment: implement F7 and PACT P3, test locally, keep server Fleet untouched. Codex owned this work without delegation in the existing feature/phase2-agent-events worktree, based on d4f0ea7. The source revision is the commit containing this report; there is no new runtime release.

P3 adds six frozen isolated scenarios, normal command/receipt/outbox/minute-tick execution, owner-scoped versioned outcome JSON, pure recorded playback and a separate fresh-fixture branch. Read [compatibility and metric definitions](../../operations/agent-engine-compatibility.md). Existing owner agreement tracks link their already-accessible records and explain admission versus fulfilment/default and battle outcomes. P1/P2 protocols, flags, economy, authority, exclusive write lease and inference boundaries are unchanged.

Acceptance evidence:

- Red registration tests: missing six scenarios/672 replica plan; red scenario outcomes and red recording/branch assertions were observed before implementation.
- New integration checks: immediate authorized reinforcement before lock, fulfilled garrison with lost defense, early recall default without motive, actual food-pressure shortage/default, costly bond with no invented supply payment, valid waits/silence, read-only playback, strict imported-record privacy shape, separate schema branch, owner isolation and event-feed projection. Zero envoy runs/inference; buildings retained.
- npm test:389 passed /124 files.
- npm run test:integration -- --maxWorkers=2:465 passed /66 files,1 pre-existing optional real-model skip. Default unrestricted parallelism first failed migration advisory-lock acquisition (40 suites failed setup;8 failed assertions/hooks); the isolated two-worker rerun passed all suites. No production migrator change or hidden retry was used.
- npm run build, npm run typecheck, npm run lint (including contracts/build-order/boundaries), separately check:contracts (26 published v1 schemas unchanged), check:boundaries, eval:offline and backlog.py check passed. Existing style/chunk-size warnings remain nonblocking.
- Source review by the author, per the no-delegation instruction; no independent reviewer or hosted CI claim.

The six reference cases use scripted synthetic human actions and development seed11. They prove normal mechanics and projection plumbing, not engine/provider skill, real-time deadlines, all held-out replicas or a strategic winner. Wall-clock test speed is unrelated to LLM latency. Actual timed-job rounding is recorded: raid20-minute duration after next-boundary eligibility/21 minutes after declaration at0; lock five minutes before resolution; help accepted1 expires62. Fixture capacity and legal40/type limits were corrected before any model observation; no model performance was inspected.

Server Fleet was not contacted. Installed local runtimes/accounts/history/configuration/anchors/pending IDs/unknown allocations/recovery gates remain unchanged. No new population, real-provider run, installation, push or live PACT write occurred. Local fixture container shutdown and final Fleet preservation evidence are recorded with the sibling Fleet F7 report. F8 remains unstarted and requires a concrete separately reviewed release/run proposal before activation.
