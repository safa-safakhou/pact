# Local world session/context repair and four-profile check — 19 October 2026

Founder assignment: repair the observed session collisions and context packing, fix other necessary operational blockers, then exercise each of the four architectures once. This is an explicit local maintenance/run assignment, not a new roadmap ticket, indefinite schedule or server deployment. Fleet's full report is `fleet/docs/local-world-operability-20261019.md` in the sibling worktree.

## PACT implementation

Default MCP initialization still reconnects a grant's logical session for stateless hosts. Migration0072 adds `mcp_sessions.connection_scoped`, preserving old rows as false and restricting the existing open-grant unique index to those default sessions. Explicit initialize metadata `pact/session-scope:connection` creates distinct sessions, advertises support and echoes the selected scope. Fleet negotiates this mode for owned connections. Event-reader DELETE consequently cannot close a turn writer's session. Matching-session cleanup and exclusive account/kingdom write leases remain; a competing isolated writer is denied. Identity, OAuth scopes, mandates, exact-command authority, command handlers and receipts are unchanged.

The existing grant-reconnect integration test now also proves concurrent isolated sessions are distinct, reader cleanup preserves writer/lease, another writer cannot open a run, and default-grant/wrong-principal behavior remains. The local observer now counts the actual `Debug: Laya recall request` event label.

## Fleet implementation and actual check

Fleet queues brief credential contention for game connections while retaining immediate OAuth contention behavior. Environment-owned packing replaces arbitrary observation-key deletion; whole core game facts, owner intent, authority and peer discovery are preserved with omission coverage for optional pages. Modern cognition receives current facts plus its outlook, removes only the duplicate model-delivered continuity copy, and binds citations to retained evidence. Numeric game time is preserved as a decimal string.

Real combined cognition packets needed more than24KB. Only the four paused local cohorts received an audited input-only increase to48KB; existing token/call quotas, deadlines, anchors, identities and historical rows were retained. The selected Nemotron model still uses its existing32768-token context. A separately discovered legacy packer mismatch was fixed by fitting to the tighter existing per-call reservation envelope before final admission, preserving the final safety check. The original legacy source inventory/hash remains unchanged; the test permits only the explicit reviewed three-line delta.

Six real reactive observations passed fake-provider whole-core/peer checks before paid/local inference. An actual concurrent MCP reader closed while the writer's session and lease remained usable. First pass17:01:22.739–17:03:21.652UTC selected the original first actor of each group. Legacy attempts stopped before inference with `CONTEXT_LIMIT`; these zero-call failures remain. Only those two failed profiles were retried after their fix,17:05:03.916–17:05:51.550UTC. The original one-hour window was never reopened, and no scheduler was started.

| Profile | Successful turns | Model calls | Outcome |
| --- | ---: | ---: | --- |
| legacy-loop | 1 | 2 | Action-schema read, then valid WAIT |
| legacy-cognition | 1 | 1 | Cognitive review, then valid WAIT |
| reactive-basic | 1 | 3 | Busy-building and invalid-action proposals rejected before preparation; corrected to WAIT |
| reactive-cognition | 1 | 1 | Empty optional continuity update and valid WAIT |

Seven calls reported65673 input+2017 output tokens, no unknown usage. Two Laya assists abstained and deterministic recall remained available. Every actual prompt retained current core facts and8 discovered peers; reactive model inputs now retained world/discovery or their whole-fact compact equivalent. No new command, building, communication, contract, transfer or military action committed. All four can operate; a single-turn check with waiting and weak owner-intent interpretation does not establish strategic competence, useful memory or interaction quality.

## Preservation and verification

The local world remains12 kingdoms/bindings,55 retained turns (49 historical+2 failed repairs+4 successful checks),48 reported model executions (41 historical+7 new), zero running turns, zero reserved/unknown allocations and no pending command. All cohorts and the game clock are paused, original and new dispatch gates closed, background Fleet scheduler stopped. The original hour's exact deadline and registration remain unchanged. Existing server/Mac fleets, terminal comparisons, helpers and provider settings were not migrated or restarted.

Encrypted before/after backups were taken; authenticated restoration into a network-disabled disposable clone matched10 core PACT and39 Fleet tables. The clone was removed. Runtime secrets, account data and encrypted inference journals remain outside Git.

PACT checks: Node24 full build and typecheck passed;405 unit tests passed;13 MCP integration tests passed; targeted formatting and architecture/boundary-fixture checks passed. Backlog check reports181 unique tickets, acyclic dependencies, source snapshots matching and37 release criteria covered. No tracker/spec hash refresh was needed. Fleet's complete final suite evidence and source installation records are in its companion report.

No hosted/client certification, server rollout, future run or observed strategic success is claimed. Local commits cover the repair and durable evidence; no push is implied.
