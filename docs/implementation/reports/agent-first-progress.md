# PACT-099 — shared learning and discovery progress

Ticket: [MNI-158 / PACT-099](https://linear.app/mnim/issue/MNI-158/pact-099-complete-agent-first-access-learning-and-observable-play), **In Progress**, Mohammad Safakhou / Codex.
Implementation: `8789315`. Verification: 1 October 2026, local Node 24 / PostgreSQL 17; synthetic fixtures and deterministic fake providers only.

## Delivered increment

`@pact/application` now owns the single `AgentGuideReader`; the API compatibility export and inference worker use it. Its owner identity comes from the authenticated connection/run, not tool arguments. `lessonVersion` identifies the lesson revision independently from `rulesId`. Both surfaces share catalog-backed mechanics, including garrison prerequisites and raid provisions/lock timing. In-app instructions describe the existing run lease and `pact_command_v1`; external instructions describe `run.open`. Neither path expands authority or starts inference.

The inference worker exposes the existing strict `pact_agent_guide_v1` and `pact_player_find_v1` schemas. Lookup uses the same public reader as MCP/HTTP, accepts an exact handle case-insensitively, and returns no private stock or troop data. Unknown players remain absent. Start lessons now direct a contactless player to real Chronicle notices and Court rosters rather than incorrectly saying public discovery is unavailable. Authority lessons explain receipt reconciliation, busy/stale/invalid recovery and exact human decision handoff. The system context directs agents to these lessons instead of relying on mechanical operator prompts.

In-app guide results fit the existing 3,600-byte tool-result budget by keeping complete fact groups and explicitly naming omitted groups. They never slice JSON or instructions mid-sentence. Omitted facts are unknown, not zero or permission; authorized read tools provide record details. Existing private run retention/export applies, with no new migration. Factual reports do not misrepresent read-only lesson/lookup calls as game commitments or failures.

## Acceptance status

- **Fresh connected agent learns/discovers/acts unaided: incomplete.** Unit and fake-provider tests prove wiring, owner resolution, actual/missing handle lookup and no fabricated identity. They are not a new autonomous-model observation or enjoyment evidence.
- **Shared handlers/views and human handoff: partial.** Shared guides and public discovery are tested; existing game handlers/approvals are unchanged. Complete all-feature short-lesson coverage, bounded detail access and a fresh web/agent committed-record observation remain to be validated.
- **Owner activity/report and disconnect recovery: incomplete.** Existing in-app reports/receipts remain working. Durable external MCP activity, owner web presentation and malformed/busy feedback with receipt recovery still need implementation and fresh observation. Guide recovery text alone does not satisfy this acceptance.

## Actual checks

- `npm run build`, `npm run typecheck`, `npm run lint`: pass. Lint retains two existing politics optional-chain warnings and one existing run-context-test template-style informational finding. Architecture/build-order checks pass; 26 published v1 schema fingerprints remain unchanged.
- `npm test`: 212 unit tests pass.
- `npm run test:integration`: 283 PostgreSQL tests pass; one existing optional live-model test skipped.
- After adding start-topic assertions: `npm run typecheck` and `npm run test:integration -- tests/integration/game-command-social.test.ts -t 'shares owner lessons'`: pass (one selected test, 35 excluded). It executes five fake-provider runs: owner start, military, authority, real uppercase handle and missing handle. It verifies no game-command receipt was created, no private lookup fields leaked, and no factual command entry was invented for reads.
- Planning render/check and `git diff --check`: pass at handoff.

## Durable instructions and next work

[MCP API](../../api/mcp.md), [runs API](../../api/runs.md), [playtest runbook](../../operations/codex-playtest.md), implementation index and handoff now distinguish local discovery features from the old hosted revision. No passwords/tokens/hidden reasoning are recorded here.

Continue the same claimed PACT-099, not postponed tickets or dependency-blocked PACT-080. Next implement bounded external activity with owner-only web/report reads and retention/export, recording only server-issued metadata and actual pending decisions. Keep committed receipt truth independent of activity persistence: an observer failure after a successful command must not turn it into a reported failed move or encourage a new-ID retry. Reconcile from the dispatcher/receipt boundary; do not introduce another command or permission system. Finish compact lessons/error feedback, then observe fresh independently connected agents from ordinary objectives without UUID/action coaching. Only close 099 when all acceptance passes; 080 is the final independent play/rehearsal checkpoint.

No blocker is asserted. No new server, paid model call, browser playtest, push or deployment occurred. Hosted stays `alpha-20260929-4` / `2143d92`; pending local social/season migrations 0036–0043 and UI/agent changes still need the matching rollout. Existing same-VPS Seal signing secret/root-route requirements remain in the deployment handoff. Historical September agent observations do not establish October all-feature acceptance.
