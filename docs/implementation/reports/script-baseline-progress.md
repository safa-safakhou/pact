# PACT-052 — public-tool baseline progress

Ticket: [PACT-052 / MNI-116](https://linear.app/mnim/issue/MNI-116)
Implementation: accompanying commit titled `PACT-052 add bounded public-tool baseline and matched synthetic comparison`.
Verification: 28 September 2026, local Node 24.19.0 / PostgreSQL 17.11. No deployment or live model calls in this increment.

## Result

A deterministic player can discover its kingdom/contact, queue Farm II, negotiate a specified exchange and sign using published MCP tools. The CLI uses a normal OAuth grant, fourteen-call ceiling, same-command receipt reconciliation and authenticated session closure. It has no admin/database interface, resource grant, partner-private read or privilege bypass.

Separate schemas run the same policy through the script and the real inference/application composition with a **fake provider**. Both complete Farm II and the one-hour 12 Grain/hour ↔ 4 Silver/hour contract, with 120 settled installments and natural expiry. Initial/final stocks match for both players. All four fake-provider command receipts must explicitly be COMMITTED. Closed sessions/finished runs leave no unreleased live write lease.

**PACT-052 remains In Progress.** This is execution/route evidence, not a matched real-model strategy trial or evidence of fun. No API calls were purchased. The earlier live Luna playtests started from different conditions and are not treated as this comparison.

## Reproducible conditions and actual outcome

Each schema starts with two normally founded kingdoms: all level-I buildings, two free builders, eight Home Guard, no ordinary stock injection. Sixty real production/upkeep ticks precede play. Player A pays the normal 2 Silver cold-contact fee; human B accepts. Both receive fixture human mandates for `building.queue` / `supply.sign`: Iron 40,000, Silver 20,000, Grain 7,200 internal units, default reserve floors. Account/password/mandate setup is fixture provisioning, not a player-accessible capability. Clock acceleration is isolated test-worker setup, not a privileged player action rate.

Both policies send one message, queue Farm II, offer the identical bond-free/zero-notice terms and sign. Partner B reads those exact public terms, sends one acceptance message and signs their current version. Sixty-one further normal ticks complete construction and expire the contract. No starvation/default occurs.

Exact ordinary balances below are **internal units (600 = one whole resource)**. They are identical in both trials:

| Player | Resource | Initial | Final |
| --- | --- | ---: | ---: |
| A | Grain | 13,200 | 27,070 |
| A | Iron | 12,000 | 24,200 |
| A | Silver | 4,800 | 13,300 |
| B | Grain | 13,200 | 33,820 |
| B | Iron | 12,000 | 24,200 |
| B | Silver | 6,000 | 9,700 |

Initial founding allowances for both: Grain 48,000 / Iron 120,000 / Silver 60,000. A's Farm II consumes 24,000 Iron and 12,000 Silver allowances; B's remain unchanged. Final locked balances are zero for every resource. A receives 2,400 Silver from the exchange; B receives 7,200 Grain. Test observers compare both owner projections, but neither player reads the partner's private balances.

Script: **10 public calls**, four writes, local call ceiling 14. Fake model route: **4 provider calls**, four writes, maxCalls 4; default server bounds 15 minutes, six conversations, twelve messages and 40,000 tokens. Fixture usage reports 20 input/10 output tokens per call; these synthetic 120 total tokens are not measured model usage. External API cost **0 for this fixture**; real-model cost/performance **not measured**. Tool calls and model calls are different quantities, not a speed/quality comparison.

## Acceptance evidence

| Requirement | Artifact / actual result |
| --- | --- |
| Same published reads, negotiation, commands and limits; no hidden/private/admin state | `scripts/lib/baseline-player.ts` accepts only a public tool-call port. MCP harness uses actual transport/guide/authorized views/shared dispatcher; partner view has no balances. CLI adapter uses HTTPS/localhost, scoped bearer token, normal session and no redirects. Pass for this client/fixture. |
| Isolated operator identities, no free resources or privileged rates | Separate generated schemas, normal founding and production, paid contact request, real mandate/lease/admission/settlement. Test clock forcing is not exposed to either policy. Pass. |
| Publish actual comparison including losing outcomes | Exact fixture results above are a tie. Live model comparison remains unrun; do not claim full criterion or ticket completion. |
| Execution is separate from fun | No participant rating or fun claim. Remaining real-model trial must preserve matched conditions and report observed failures/wins and costs when measurable. |

Verification performed:

- `npm run build`, `npm run typecheck`, `npm run lint`: pass.
- `npm test`: **139 tests / 48 files**, including nine baseline unit cases (activation/contact/agreement guards, exact offer version, uncertain writes, bounds, URL/redirect/auth/session handling, rejected-content sanitization).
- `npm run test:integration`: **225 tests / 39 files**, including the matched comparison. The integration client calls MCP in-process; new HTTP adapter behavior has mocked-fetch unit coverage, not a live HTTP certification.
- Planning render/check and diff checks: recorded with the tracker synchronization commit.

## Handoff

[Run instructions](../../operations/script-baseline.md) describe token handling, statuses and reconciliation. Finish PACT-052 with a separately authorized matched real-model trial; do not silently reuse a personal credential, bill a provider or reset live kingdoms to match the fixture. PACT-096's non-game reuse proof is independently ready. PACT-048 UI-only observations remain open, and PACT-053 still waits on those three tickets. This change does not alter the VPS release.
