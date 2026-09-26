# PACT-049 — complete game tools across Envoy routes

Ticket: [PACT-049 / MNI-113](https://linear.app/mnim/issue/MNI-113/pact-049-expose-complete-game-tools-to-every-envoy-route). Final evidence review: 26 September 2026. Node 24, PostgreSQL 17. Implementation and verification span the revisions recorded in [the progress log](game-tools-progress.md), including `30e638b`.

## Result

The PACT application dispatcher owns all 28 currently defined game actions in the shared `GameActionSchema`. Authenticated human HTTP/SDK, in-app Envoy, and MCP adapters use that same product-scoped command contract and dispatcher. World, report, inbox, direct-conversation, receipt, and approval-status reads use owner/visibility-bound services; the two agent routes can propose five exact action types for separate human review. The in-app run selects a bounded owner snapshot, inbox metadata, and only human-selected conversation excerpts. Provider calls remain default-off on the private VPS; this report does not certify a live paid model or external consumer host.

## Acceptance evidence

| Criterion | Reproducible check | Observed result |
| --- | --- | --- |
| Recorded equivalent commands/receipts from web, adapter, and MCP | `tests/integration/game-command-social.test.ts`: “records equivalent message admission from web, model adapter, and MCP” and “records equivalent versioned supply offers from web, model adapter, and MCP” | Both passed. Server-derived owner, charged amounts, record versions, and receipt shape agree; routes share dispatcher admission. |
| Hostile counterpart text cannot change identity, scope, connection, or mandate; no hidden state in convenience summaries | Same suite: “keeps hostile selected-thread prose outside server authority and model routing,” bounded owner-context, selected-conversation, private world/report, inbox, and receipt reads; `workers/inference/src/run-context.test.ts` | Passed. Hostile prose remains untrusted user-role data; fake-provider forged commands do not change model/provider/owner/mandate or commit effects. Non-owner projections fail closed, arbitrary inbox payloads are excluded, and oversized excerpts omit text. This is server-boundary evidence, not a claim that a live model resists persuasion. |
| Generated SDK/model/MCP commands use product-scoped contracts without human privilege | `tests/unit/game-tool-contracts.test.ts` and `tests/integration/game-command-social.test.ts`: “denies every human-only game action through model and MCP despite forged human envelopes,” plus human-only contact acceptance | Passed. All 28 game kinds appear in shared web/MCP/model schemas; model tool excludes sandbox actions. All seven currently human-only game actions are denied on model and MCP routes despite forged human actor fields, with no committed receipt or human permit. The handler derives product/account/audience from credentials or the active run. |

Final local verification: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (119 passing), and `npm run test:integration` (174 passing) on PostgreSQL 17. `python3 docs/implementation/backlog.py render`, `python3 docs/implementation/backlog.py check`, and `git diff --check` passed after tracker edits. No hosted CI or live-provider certification is claimed.

## Documentation and limitations

See [run API](../../api/runs.md), [MCP API](../../api/mcp.md), [approval API](../../api/approvals.md), [module boundaries](../../architecture/modules.md), and [world-view authorization](../../architecture/world-views.md). The published agent command schema lists human-only action kinds for wire compatibility; **listing is not permission**, and the server denies them. The five proposal kinds are exact review workflows; other denied actions do not silently become proposals. PACT-048 must provide the human gameplay surface before a playable Alpha can be claimed. PACT-051's generated all-transition verification remains separate.
