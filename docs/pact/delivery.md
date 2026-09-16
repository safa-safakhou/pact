# Build and acceptance checklist

**Version 1.1 · Ordered delivery contract. Empty checkboxes mean work has not been performed.**

The executable work breakdown is the [implementation backlog](../implementation/README.md). Its [coverage table](../implementation/coverage.md) maps the criteria below to concrete tickets; this document remains authoritative for milestone acceptance.

The implementation follows these stages in order. Internal scaffolding can share code, but a later stage does not excuse a failed earlier exit condition. All five PACT model adapters, the certified assistant routes, web, native iOS/Android, and Telegram belong to the release; the connection stage discovers actual host constraints before the game depends on them.

## 0. Connection experiment

**Deliverable:** account creation and a private kingdom draft; all required connection routes; one read, one harmless sandbox write, and one human approval. No live economy or recruited public community.

- [ ] **A01 — Identity:** signup, verification, login, recovery, invitation preservation, draft expiry, and exactly-once activation fixture pass. Model credentials never serve as human login.
- [ ] **A02 — Provider matrix:** OpenAI, Anthropic, Gemini, xAI, and OpenRouter each complete a tool-driven read/write run; OpenRouter authorization and manual-key routes both pass. Invalid key, depleted quota, timeout, and revoke produce truthful states.
- [ ] **A03 — MCP matrix:** ChatGPT, Claude, and Gemini CLI each complete OAuth, state read, authorized sandbox write, approval deep link, result retrieval, and revocation. Record tested account/workspace/OS versions and distribution status. Both pinned MCP protocol versions pass transport and scope fixtures. No provider-parity claim replaces a recorded result.
- [ ] **A04 — Closed browser:** start a bounded PACT run, close the browser, and observe completion within its original allowance. With no active run, inject a notification and observe zero provider calls. External host disconnect leaves committed receipts available.
- [ ] **A05 — Approval integrity:** test expired/changed terms, replayed approval, malicious message requesting authority, and an agent claiming the human approved. None bypasses the human-authenticated exact command.
- [ ] **A06 — Data:** publish real operator notices before accounts exist; demonstrate key encryption/redaction, account export, revocation, deletion, backup suppression, and no third-party transcript analytics.
- [ ] **A07 — Setup usability:** five unfamiliar testers per named route, using only its published guide. At least four of five reach a correct sandbox result within five minutes after required provider credentials/host eligibility are available. Record account creation separately so verification delays remain visible. Failed routes are fixed before this stage passes.

- [ ] **A08 — Channel authentication:** native iOS/Android development clients and Telegram complete account linking, sandbox read/write, exact human approval, unlink/revoke, and cross-device duplicate-action checks. Telegram initData/webhook validation and native PKCE are verified; no production game loop is required yet.
- [ ] **A09 — Module contracts:** package ownership, imports, transaction ports, product scoping, generated SDK/tool contracts, and provider/client capability matrix are defined and enforced in CI. A Grok-powered external tool client passes the sandbox fixture without claiming universal consumer-app support.

**Exit:** A01–A09 pass with evidence. The output is a working multi-route connection layer and documented host requirements, not a screenshot of one connected assistant.

## 1. Transactional rules prototype

**Deliverable:** one isolated test world, plain UI, deterministic economic/military operations, and recorded replays. Implement [rules](rules.md) before adding decorative assets or a shop.

- [ ] **R01 — Conservation:** founding restrictions, overflow, construction/training cancellation, bonds, transfers, default, and Fortune never duplicate assets or convert grants into transferable value.
- [ ] **R02 — Time:** exact minute boundaries, first/last contract installments, harvest transitions, charge regeneration, event ordering, and pause/resume match the specified clock. Six-hour full delivery is exactly 360 installments.
- [ ] **R03 — Units:** Home Guard disbanding, identity/ownership, capacity, proportionate casualties, starvation, pending returns, same-owner troops on both sides, and overlapping defenses pass fixed fixtures. Splitting detachments cannot reduce losses.
- [ ] **R04 — Authority:** simultaneous signatures across clients cannot overspend a mandate; all future flows reserve once; approved exceptions remain executable; incoming transfers never net against outgoing allowance; floor changes have the stated default effect.
- [ ] **R05 — Combat:** reproduce the worked battle, all 36 die pairs, zero-power/tie branches, capacity-limited loot, raid cancellation, overlapping locks, and closing accounts. Commitments and deterministic dice verify against published fixtures.
- [ ] **R06 — Reliability:** injected process death before/after commit, duplicate job delivery, timed-out writes, and a restored database all produce one result and one resource debit. Cross-account object access fails.
- [ ] **R07 — Baseline automation:** a plain script plays under the same public tools and limits as an Envoy. Record its economy, negotiations completed, game outcomes, and operation counts. Keep script access within published rules; do not secretly handicap it to manufacture LLM superiority.

- [ ] **R08 — Reuse:** a non-game fixture imports identity/runtime/approval/notification packages with in-memory adapters and no PACT domain/database dependency. Cross-product credentials/events remain isolated; PACT still commits game stock and authority reservations atomically.

**Exit:** R01–R08 pass. Any economic inconsistency blocks progression. Test outcomes can justify a versioned balance change; unresolved corruption cannot be renamed a product experiment.

## 2. Social slice

**Deliverable:** 50 invited adults in one world for three weeks, using the real account/connection layer. Include contacts, Courts, Articles, allegiance, Seals, Chronicle links, and the first-session kingdom view. Use cosmetic stakes and provisional standings.

- [ ] **S01 — Social state:** join/leave/ownership transfer, invite expiry/revoke/reuse, exact destination after recovery, handle changes, contact limits, blocks/mutes, and account retirement pass.
- [ ] **S02 — Evidence:** altered text, reordered ranges, invalid byte boundaries, wrong keys, hidden information requests, expired source access, and removed content cannot be presented as valid available evidence. Signature verification never claims truth or complete context.
- [ ] **S03 — Alerts:** opted-in critical email/push and durable pull notifications reach the correct account; no message body leaks to previews; notification arrival starts no inference. Delivery failure does not change game outcomes.
- [ ] **S04 — Concurrent load:** 50 kingdoms, 12 negotiations each, maximum active contracts, simultaneous raids, and disconnected clients meet the runtime latency targets without duplicate/missed ticks.
- [ ] **S05 — Safety and deletion:** process actual report/appeal drills, a seeded personal-information leak, key compromise, and deletion during a locked battle. Required response and retention deadlines pass.
- [ ] **S06 — Player agency:** at least seven of ten interviewed players correctly describe one consequential decision they made and what their Envoy did. Reading summaries alone does not count as agency.
- [ ] **S07 — Return and sharing:** at least 20 of 50 activated players perform a meaningful action in days 8–14; at least five voluntarily share; at least three referred players activate and return for meaningful play in their own days 8–14. Record missing observation windows separately. No referral prizes are used in this test.

- [ ] **S08 — Cross-channel play:** web, iOS, Android, Telegram Mini App/bot, and certified assistant clients operate one kingdom with consistent receipts and run state. Handoff, stale/offline UI, replay, unlink/deletion, safe push, and explicit bot-run confirmation pass. Full gameplay is available on the visual clients; the bot links complex decisions to a visual client.

**Exit:** S01–S05 and S08 pass and the S06–S07 behavioral thresholds are met. These thresholds are product decisions for this pilot, not industry benchmarks. If behavioral thresholds fail, revise the core interaction under a new version and rerun the slice before funding the full season.

## 3. Season One release

**Deliverable:** six-week Lean Crown season, complete kingdom presentation, progression/achievement display, cosmetic shop, and published supported-client guides.

- [ ] **L01 — Season:** published schedule, start/end snapshots, newcomer cohorts, tie honors, persistent assets, and rules-version pinning pass an accelerated complete season rehearsal.
- [ ] **L02 — Presentation:** all four screens, phone/desktop reflow, keyboard/screen-reader paths, contrast, reduced motion, muted play, live-state labels, and report explanations pass review against the product brief.
- [ ] **L03 — Purchases:** duplicate payment webhook, failed payment, refund, cosmetic entitlement and Gem grant tests pass. Purchased objects are absent from production, Fortune, troop, authority, scheduling, and action-limit calculations.
- [ ] **L04 — Operations:** restore rehearsal, incident pause, signing-key rotation, privacy/terms publication, staffed moderation, provider certification, status page, and customer support are operational. Required external client distribution reviews are complete.
- [ ] **L05 — Competitive abuse:** review alt farming, gift concentration, storage sheltering, default/bond cycling, prolonged sieges, smear campaigns, and model-tier outcome differences. Confirm the permitted/prohibited behavior in published rules and staff the award review. No automatic fraud accusation is generated from winning or receiving gifts alone.

- [ ] **L06 — Channel release:** signed iOS/Android builds, app-store requirements, Telegram distribution/Stars, native receipt verification/refunds, and production-like cross-surface certification pass. Shipping capability labels match tested hosts. Required store reviews are complete; every purchase source is isolated from gameplay advantage.

**Exit:** all release checks pass. Provider setup failures, broken ledger invariants, unreviewed access routes, and absent privacy operations are release blockers; they are not solved by prose.

## Measurements collected during play

| Measurement | Collection rule | Decision it informs |
| --- | --- | --- |
| Player model expense | API token/cost receipts by provider; external-host usage marked unmeasured, with optional player-reported quota impact | Default context and run allowances |
| Value of negotiation | Compare completed objectives for static script versus Envoy; player explanation; accepted offers and subsequent deliveries | Whether language-based coordination earns its cost |
| Intelligence trade | Voluntary player-labeled sale plus actual transfer/report sharing; do not infer a sale from every message | Emphasize or simplify intelligence tools |
| Ownership and return | Meaningful actions, chosen upgrades/cosmetics, voluntary shares, return windows | Kingdom presentation and next-session clarity |
| Politics | Contract duration/default rate, allegiance turnover, tribute flows, reports, model-provider outcomes | Versioned economy and safety adjustments |

Instrumentation records structured game events, not private model reasoning or raw transcripts. Collect the minimum data needed for the decision. Every experiment has an owner, observation window, and recorded result before changing the baseline. No claim of addictiveness, fairness, growth, or model superiority is a substitute for these results.
