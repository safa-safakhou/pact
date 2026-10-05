# Fresh three-player Alpha playtest — 2 October 2026

This is a live, assisted simulation of three new friends using cheap agents. It is not a human enjoyment study, a ticket completion claim, or external-client certification. No game implementation or deployment was changed.

## Result

The basic loop works: fresh accounts can found kingdoms, authorize Codex, develop production, discover real players, exchange messages, and activate a reciprocal contract. Normal ticks completed buildings and delivered resources without an operator stock grant or clock advance. However, inviting an ordinary friend still requires setup assistance, and following the consequences is substantially harder than issuing an objective. The most urgent work is the connection journey, approval links, agent-readable current state, and player-facing progress/settlement tracking.

Three synthetic strangers were created through the actual web signup, verification, sign-in and founding forms:

| Player | Public handle | Objective | Verified outcome |
| --- | --- | --- | --- |
| Cedar Vale | `cedar_6af2f4` | Peaceful farmer; develop food and find cooperation | Farm II completed; Market II queued; accepted Marsh contact; proposed and signed a one-hour grain-for-iron trade. |
| Marsh Haven | `marsh_bbbfe4` | Find a fair, affordable first exchange | Farm II completed after human review; accepted contacts with Cedar and Flint; messaged both; signed Cedar's exact offer, activating the contract. |
| Flint Lodge | `flint_a8c8d3` | Independent economy and home defence | Farm II and Wall II completed; Mine II queued; accepted Marsh contact; negotiated a small trade by message, with no Flint contract yet. |

Observation began with founding at 13:57–13:59 UTC (15:57–15:59 Europe/Berlin). Twelve Luna turns ran from 14:04:57 to 14:22:18 UTC; subsequent owner/database checks and cleanup followed. The final building query at approximately 14:26 UTC showed all three Farm II upgrades and Flint's Wall II completed; Cedar's market and Flint's mine remained active. These are dated observations, not permanently current state.

## Method and assistance

- Host: `agentic@2.28.57.254`; public game: `https://safa.dedyn.io/pact/`; deployed containers `alpha-20261001-2` / recorded revision `e07dd47`. Local inspection revision: `48002bbe51a2c2c9014ebe5ef997121f2a833d21`.
- Three separate browser contexts and three separately authenticated OAuth MCP profiles. Each playing process had an empty temporary working directory, disabled shell/multi-agent tools, its own configured PACT connection, and an ordinary objective. Other players' IDs, rules, command JSON and database state were not supplied to the players. Each round used a fresh Codex conversation; conversation memory across rounds was therefore limited to server state and the human's follow-up.
- Model: `gpt-6-luna`, low reasoning effort. PACT live provider inference stayed off. Calls used the existing Codex account, not a newly provisioned PACT model API credential.
- Desktop viewports: 1280×900; Marsh phone viewport: 390×844. This was browser emulation, not a physical phone test. The computer-use bridge failed before controlling the browser; Playwright/Chromium was used instead. Harness errors are excluded from game defects.
- Signup email went to the VPS's internal Mailpit. The operator privately retrieved each synthetic account's verification token and entered it into the actual verification form. No friend-accessible internet email delivery was demonstrated.
- All three human owners enabled the existing bounded agent playtest mandate through the UI. No stock seeding, direct gameplay database writes, artificial clock advance, or database reset occurred.
- Humans published three explicit public introduction notices. Before they appeared, Cedar and Marsh discovered each other through real season standings despite initially empty opportunity/Court feeds. Discovery was therefore partly assisted, and the whole journey must not be described as unaided.
- Humans accepted Marsh→Cedar and Flint→Marsh requests. Human-only decisions were not delegated to the agents. The operator approved Marsh's exact Farm II request and rejected Cedar's redundant contact request after the contact was already accepted.

## What the players experienced

At the first turn, two players tried to contact a stranger and hit the two-ordinary-Silver fee while their young kingdoms had too little ordinary Silver. Neither used the founding construction allowance to build. Flint successfully queued Farm II and Wall II immediately. This is a useful split: the server enforced an intended rule, but the cheapest model struggled to distinguish ordinary resources, restricted founding allowances, and protected food reserves.

The second round produced affordable construction and two actual contact requests. Cedar's simultaneous request to Marsh failed after Marsh had already requested Cedar; Cedar then proposed unnecessary human review instead of correctly handing off the incoming request. Marsh also requested approval for construction that its mandate already allowed. Human review worked once the correct PACT page was reached.

The third round produced actual private messages and Cedar's signable trade offer. Marsh read the conversation before recognizing the live offer, then attempted to sign a placeholder ID; that invalid request was rejected. On an explicit follow-up to check live offers, Marsh found the real ID/version, checked the terms, signed, and accurately reported an active contract. This required an extra human objective, but no operator-injected offer ID or trade command.

Flint continued to develop its economy and send messages. Its repeated malformed world reads prevented it from confidently reporting finished work even though the owner projection showed Farm II and Wall II. Cedar's final status also questioned Marsh's signature despite an active contract and treated original building receipts as evidence that construction was still active. Receipts establish what committed at the time, not current completion or later counterparty decisions. These are model reasoning failures aggravated by weak current-state and consequence presentation; they are not proof the database disagrees with itself.

The most promising moment was a real conversation becoming a binding reciprocal trade. The first several minutes were mostly setup, generic errors, and waiting. Three identical new economies make a tiny exchange easy to demonstrate but do not yet establish an interesting strategic market. Model assessments called concrete construction/trade meaningful; that is evidence of model narration, not evidence humans enjoyed playing.

## Verified actions and settlement

The [sanitized evidence](evidence/fresh-alpha-20261002.json) includes visible player reports, usage, tool outcomes, authorized owner projections, receipts, UI observations and cleanup results. Passwords, OAuth credentials, callback URLs and hidden reasoning are excluded.

Screenshots: [phone Envoy journey](evidence/fresh-alpha-20261002-phone-envoy.png), [active trade in People](evidence/fresh-alpha-20261002-active-trade.png), and [Flint's empty Chronicle](evidence/fresh-alpha-20261002-empty-chronicle.png). These preserve the screen at capture time, including historical notices and the absence of settlement detail.

| Evidence | Identifier / actual result |
| --- | --- |
| Cedar Farm II | `3c1e8b10-d4af-4b84-a75f-26e9a430e7e4`; COMMITTED; 40 Iron + 20 Silver; later completed. |
| Cedar Market II | `9808239a-3499-40c1-8a58-1b9c1739e7ad`; COMMITTED; 40 Iron + 30 Silver; pending at final building query. |
| Marsh contact request | `90b1ca1a-664d-4f21-bc6d-6839b8414728`; COMMITTED; 2 ordinary Silver. Human acceptance: `b0fa00b3-eff6-4da6-b379-44993e08106f`. |
| Flint contact request | `0e354c2a-0959-48a2-95df-7ff76aacbacb`; COMMITTED; 2 ordinary Silver. Human acceptance: `edc35c32-0075-4fea-a396-cd36aa995fe8`. |
| Marsh Farm II approval | `c4580935-cea6-463e-b538-653053fe3e95`; approved at 14:13:45 UTC; command `b87caf28-e10d-455c-984f-a1fec9a74a77` COMMITTED; 40 Iron + 20 Silver; later completed. |
| Cedar redundant contact approval | `b0166185-9d46-457d-ac48-eb221e6dbc76`; rejected; command `5a3da205-4d39-4c12-90fc-bff5c0a4fc3b` FORBIDDEN, no charge. |
| Flint Farm II / Wall II | `bd70a2ba-8f21-4df8-a07f-55fb06769de8` / `5bbcc847-94d0-44e5-a174-7e054bc42881`; COMMITTED; combined 120 Iron + 50 Silver; both later completed. |
| Flint Mine II | `4da7ee64-8cd5-4b8d-900c-d14b059850c7`; COMMITTED; 50 Iron + 25 Silver; pending at final building query. |
| Cedar offer / signature | Offer `a6ca02e3-9bad-4a53-a70e-9dd1e9821f95`, version 1; signature command `887617e6-0a5b-44bb-bb35-226e2c30b4c1`. |
| Marsh signature / contract | `cbeacb09-85a1-4bdb-9bea-8c9564d25f27`, COMMITTED at 14:20:34 UTC; active contract `ffbd7d19-624a-494b-87b0-e49bcb8efa07`. |

Contract terms: Cedar sends 1 Grain/hour; Marsh sends 1 Iron/hour; one game hour, no bonds, no notice period. A read-only `supply_installments` query at 14:24:26 UTC showed **three installments per resource, 30 marked units due and delivered per resource, zero overflow, zero failures**. At 600 marked units per whole resource, that is 0.05 Grain delivered to Marsh and 0.05 Iron to Cedar. This verifies initial automatic settlement, not full one-hour completion. The live clock was active at tick 9427 with current heartbeat; it was not stalled.

## Work left, in priority order

1. **Fix agent approval URLs on the hosted subpath.** Both returned links used `https://safa.dedyn.io/approvals/<id>`, which opened the unrelated “Join Agentic World” application on the shared host. `https://safa.dedyn.io/pact/?approval=<id>` opened the actual PACT exact review and prefilled the ID. Relevant sources: [approval service](../../../packages/approvals/src/service.ts), [status reader](../../../packages/approvals/src/status-reader.ts), [MCP transport](../../../packages/mcp/src/transport.ts). This is a confirmed broken handoff, not an expired approval.

2. **Make the first connection usable by a friend.** Internal Mailpit verification requires an operator. The Envoy page leads with an in-app provider/model form with no saved connection, while external Codex instructions sit far below it and lack copyable connection commands or a version preflight. The existing shell Codex 0.144.4 did not support the documented DCR flag and sent conflicting OAuth resource values for a profile-discriminated URL, yielding HTTP 400 `INVALID_REQUEST`. The bundled 0.159.0-alpha.12.1 completed all three actual browser OAuth logins. Publish a tested client version/procedure and surface connected account status. Official references checked during setup: [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-reference), [MCP connections](https://learn.chatgpt.com/docs/extend/mcp).

3. **Expose current consequences to the human and agent.** People showed the active contract and rates but no installments. Chronicle showed approval events for Cedar/Marsh and “No records yet” for Flint despite completed construction and messages. Its report picker offered scout/raid reports, not trade deliveries. The first-session hint explicitly directs players to People/Chronicle for recorded installments, which we could not inspect there. Database inspection should not be required to answer “did my trade deliver?” Provide current contract signatures/status, delivered totals, completed construction, and relevant event links through authorized views and the agent start guide.

4. **Improve agent input/denial guidance before increasing model cost.** Fourteen of sixteen `pact_world_read_v1` calls failed. The schema requires `targetKingdomId`, not generic ownership fields, and a valid optional forecast horizon; generic `INVALID_REQUEST` did not help the model recover. Owner HTTP projections remained readable. Explain founding allowance restrictions and total food used by reserve checks in whole units, provide precise schema-validation feedback and affordability/wait information, and distinguish validation failure with no receipt from an uncertain committed command. A read-self entry point would remove routine identifier-shape mistakes. Marsh's placeholder signature was correctly rejected.

5. **Repair activity tracking.** All three browser views missed newly recorded actions until “Refresh recorded activity” was clicked. After refresh, completed human approvals and accepted contacts still had historical next steps asking for approval/acceptance. Entries were ordered lexicographically by textual IDs: `10 … 36, 9`, placing old failures after new success. [External activity](../../../packages/runs/src/external-activity.ts) selects `id::text` and orders by the output alias; [report formatting](../../../packages/runs/src/report.ts) assigns static next steps. Label historical outcomes, attach live record status, order numerically/by time, and show named actions and ordinary-unit costs instead of raw `building:<UUID>` plus “committed · COMMITTED”.

6. **Use game-clock countdowns and focus the mobile journey.** At 14:22 UTC, a newly activated one-hour contract was shown as “Ends … 4:24 PM” in Europe/Berlin because the UI rendered its game timestamp as a local date; around an hour of game time remained. Builders label timestamps “game time”, but still require users to interpret the offset. Show remaining game minutes and pause status. On the phone viewport, external activity began roughly 2601px down the Envoy page and Codex connection instructions roughly 5082px down; total page height was 6437px. There was no horizontal overflow, but the primary agent journey was buried. People similarly starts with Courts/articles/allegiance ahead of basic contacts and opportunities. Surface connection, current objective, last meaningful result and next human decision first.

7. **Reconcile offer documentation and observed behavior.** [Codex playtest instructions](../../operations/codex-playtest.md) say the preset cannot create supply offers. Cedar nevertheless created an unsigned offer through the ordinary authorized route, then signed under `supply.sign`. Source treats nonbinding proposal creation separately from authority reservation at signature. Clarify the intended distinction and align instructions/agent guidance; this observation alone does not establish an authority bypass.

## Usage, cleanup and limits

Twelve Luna turns reported 4,227,937 aggregate input tokens, including 3,834,368 cached tokens; uncached difference 393,569. Output was 18,407 tokens, with 282 reported reasoning tokens. These are summed per-call usage, including repeated context, not unique prompt text. There were 173 tool calls, 23 failures, including one failed unrelated `chatgpt_space.read_page` attempt in Cedar's final round. The launcher limited configured MCP connections but did not remove every built-in Codex capability; that call returned no successful result and must not be hidden in an isolation claim. Dollar spend was not available from these logs. Repeated guide/schema context suggests an opportunity to reduce usage, but pricing or savings were not measured.

Cleanup used normal authenticated owner routes: new resource/troop authority was disabled, all three fresh accounts were signed out everywhere, and their OAuth grants were revoked. The first UI disable attempt correctly required recent authentication; fresh sign-in resolved it. Former cookie sessions then returned HTTP 403. Local MCP entries were removed. Codex logout encountered a keyring deletion error, so only the three matching test entries in the fallback credential file were removed explicitly; unrelated configuration and the main Codex login were preserved. The three kingdoms, introductions, receipts, build queues and signed contract were retained for inspection; existing obligations continue on the normal clock. No reset, deployment, commit or push occurred.

This test does not cover combat, garrisons, full contract expiry, seven-day progression, cross-provider compatibility, physical mobile interaction, retention, or real human enjoyment. It supports an assisted Alpha loop and identifies concrete friction. The next useful validation is to fix the first five findings, then have a few actual friends attempt signup, connect their own Codex, complete one improvement and one exchange, and explain what happened without an operator interpreting receipts for them.

Documentation verification: `python3 docs/implementation/backlog.py check` passed (99 unique tickets, acyclic dependencies, 37 release criteria covered, matching source snapshots, six generated views checked). `git diff --check` passed. No application code changed, so application build/unit/integration suites were not rerun for this report. No tracker statuses or generated planning views changed.
