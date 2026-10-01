# Phase 3 — Season One release

**21 tickets · 2 completed.** [Backlog overview](README.md) · [Machine-readable tickets](tasks.json)

Dependencies are completion requirements. The approved Alpha track depends on the completed rules gate, not postponed production/pilot gates. Other phases retain their original gates. Only Alpha tickets are currently authorized. Owner roles are disciplines, not assigned people; size is not a time commitment.

<a id="pact-084"></a>
## PACT-084 — Prove native iOS and Android login, linking, and approval

**Status:** todo · **Role:** Mobile · **Size:** L · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-007](phase-0-connections.md#pact-007), [PACT-023](phase-0-connections.md#pact-023), [PACT-068](phase-2-social.md#pact-068), [PACT-083](phase-0-connections.md#pact-083)

**Components:** React Native Expo shell, native identity, secure storage.

**Specification:** [architecture](../pact/architecture.md), [access](../pact/access.md), [privacy](../pact/privacy.md), [alpha](../pact/alpha.md) · **Release checks:** L06

**Implement / deliver**

- Create one native application with iOS/Android development builds, system-browser PACT PKCE login, verified app links, secure refresh storage, and in-memory access tokens.
- Complete private-draft read, sandbox command, exact human approval, reconnect, and revoke on both platforms; full gameplay comes in PACT-087.

**Acceptance**

- [ ] A malicious callback, wrong audience, stale approval, duplicate tap, and revoked session fail or return the original receipt correctly.
- [ ] Credentials do not appear in app preferences/logs/backups; backgrounding/reopening shows server state without a new run.

**External prerequisites:** Apple team ID, signed physical iOS development build, and iOS test device; Android SDK, signing-certificate fingerprint, signed development build, and Android test device; Hostname-root Apple and Android association files generated from the real signing identities.

**Block reason:** Deferred by the Version 1.3 MVP decision until web and Telegram gameplay have been played and validated. The existing native shell and simulator evidence are retained; paid signing and physical-device certification resume during Season One release work.

**Evidence**

- docs/implementation/reports/native-telegram-auth.md
- npm run lint; npm run typecheck; npm test; npm run test:integration; npm run smoke; npm run build
- apps/native/src/session-controller.test.ts; apps/native/src/native-api.test.ts; apps/native/app.json
- Xcode 26.4 iOS 26.4 simulator build and launch passed on 2026-09-22; system PKCE prompt opened https://safa.dedyn.io and cancellation returned cleanly

<a id="pact-087"></a>
## PACT-087 — Build complete native kingdom and Envoy screens

**Status:** todo · **Role:** Mobile · **Size:** L · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-048](phase-1-rules.md#pact-048), [PACT-053](phase-1-rules.md#pact-053), [PACT-061](phase-2-social.md#pact-061), [PACT-068](phase-2-social.md#pact-068), [PACT-083](phase-0-connections.md#pact-083), [PACT-084](phase-3-season-one.md#pact-084)

**Components:** native gameplay screens, shared view models.

**Specification:** [architecture](../pact/architecture.md), [product](../pact/product.md), [runtime](../pact/runtime.md), [alpha](../pact/alpha.md) · **Release checks:** L02, L06

**Implement / deliver**

- Implement the four screens using native accessible controls, shared client/view-model logic, assets, resource formatting, and existing application commands.
- Include build/train/contracts/scout/garrison/raid/report/social controls, account/security settings, run start/stop, approval handoff, APNs/FCM delivery, and native session/push privacy cleanup.

**Acceptance**

- [ ] A player completes the full core loop on each native platform and sees the same version/receipt on web.
- [ ] Offline state is visibly stale; reconnect cannot replay a signature/raid or start another Envoy; native approval cannot bypass expiry or reauthentication.

<a id="pact-069"></a>
## PACT-069 — Implement the complete six-week season lifecycle

**Status:** done · **Role:** Rules · **Size:** M · **Type:** implementation

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053)

**Components:** season lifecycle and newcomer cohorts.

**Specification:** [rules](../pact/rules.md), [product](../pact/product.md), [alpha](../pact/alpha.md) · **Release checks:** G05

**Implement / deliver**

- Implement configured six-week opening/harvest progression, pre-boundary closing Fortune snapshot and next-season baseline on the authoritative paused game clock.
- Preserve buildings, troops, stocks, contacts and contracts; pin in-flight terms/rules, expose season/week/transition and implement equal-age newcomer snapshots.

**Deferred original scope:** Preserved in this ticket's `original_plan` in tasks.json; Alpha completion does not certify its former production/pilot acceptance.

**Acceptance**

- [x] An accelerated isolated six-week fixture applies 100/100/90/80/80/100 percent Farm multipliers and assigns the boundary tick to the correct season.
- [x] Contracts/raids crossing season or pause keep their terms; assets persist and age-seven-day cohorts compare the correct snapshots with no scoring reset exploit.

**Assignee:** Codex / Mohammad Safakhou

**Evidence**

- 1 October 2026: f0763b7 completes both Alpha checks; MNI-140 read back Done. Paused six-week production, pre-boundary closure/new baseline, exact-age newcomer snapshots, shared API/MCP/agent/web views, no asset/term reset. Node 24 build/typecheck/lint; 202 unit and 281 PostgreSQL integration pass, one existing skip; final targeted regressions 10 pass. See docs/implementation/reports/season-lifecycle.md. Local only; hosted remains 2143d92.

<a id="pact-070"></a>
## PACT-070 — Implement seasonal honors and award review

**Status:** done · **Role:** Rules · **Size:** M · **Type:** implementation

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-069](phase-3-season-one.md#pact-069)

**Components:** award calculation and review.

**Specification:** [rules](../pact/rules.md), [product](../pact/product.md), [privacy](../pact/privacy.md), [alpha](../pact/alpha.md) · **Release checks:** G05

**Implement / deliver**

- Implement season results, meaningful-day eligibility, ties, overall/Hall-band standings, arrival medals and participation rewards with retry-safe entitlements.
- Label competitive honors provisional during Alpha; preserve minimum population rules. Formal competitive disqualification, appeals and seven-real-day final-award operations remain later work.

**Deferred original scope:** Preserved in this ticket's `original_plan` in tasks.json; Alpha completion does not certify its former production/pilot acceptance.

**Acceptance**

- [x] Small friend groups see truthful ranks but no unsupported percentile honors; ties, highest band and three meaningful-day eligibility match the rulebook.
- [x] Season/arrival/participation processing is retry-safe and never changes resources, troops or Fortune; formal competitive rewards remain explicitly provisional, not falsely finalized.

**Assignee:** Codex / Mohammad Safakhou

**Evidence**

- 1 October 2026: 94f9573 completes both Alpha checks; MNI-141 read back Done. Exact BigInt thresholds/ties, highest Hall bands, three meaningful UTC days proved from actual completed actions, real arrival/season cosmetics with no economic effect, and shared provisional-only closing results. Node 24 build/typecheck/lint; 205 unit and 282 PostgreSQL integration pass, one existing skip; final targeted 6 unit/web and 4 integration pass. Planning/diff pass. See docs/implementation/reports/season-honors.md and docs/architecture/seasons.md. No final competitive rewards, hosted deployment, paid provider or player-enjoyment claim; 28 Later unchanged.

<a id="pact-071"></a>
## PACT-071 — Produce and integrate the illustrated kingdom and cosmetics

**Status:** todo · **Role:** Frontend / Art · **Size:** L · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-068](phase-2-social.md#pact-068)

**Components:** art assets and kingdom scene.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md) · **Release checks:** L02

**Implement / deliver**

- Create or commission the authored building silhouettes, Hall II/IV/VI evolution, portrait scenes, banners, achievement ornaments, scaffolds, and palette variants.
- Add optimized asset manifests, provenance/licenses, text alternatives, cosmetic placement, and responsive scene rendering; actual hidden defenses never determine public portraits.

**Acceptance**

- [ ] Every building state is readable at phone size and has an equivalent text entry; scene updates follow committed state rather than speculative success.
- [ ] Cosmetic changes affect only presentation; private building levels do not leak through public images or asset URLs.

**External prerequisites:** Approved/licensed visual assets or art production capacity.

<a id="pact-072"></a>
## PACT-072 — Integrate optional audio, motion, and notification feedback

**Status:** todo · **Role:** Frontend / Audio · **Size:** M · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-071](phase-3-season-one.md#pact-071)

**Components:** audio and motion.

**Specification:** [product](../pact/product.md), [runtime](../pact/runtime.md), [alpha](../pact/alpha.md) · **Release checks:** L02

**Implement / deliver**

- Produce/integrate the specified short sound cues and restrained ambience with per-channel controls, user-gesture activation, and message batching.
- Add short build/signature/result transitions and full reduced-motion equivalents; avoid continual tick sounds or autoplayed player speech.

**Acceptance**

- [ ] Muted and reduced-motion play retains every consequence and control.
- [ ] Reconnecting does not replay every historical sound; one grouped event generates one appropriate cue and preferences persist.

**External prerequisites:** Approved/licensed audio assets or audio production capacity.

<a id="pact-073"></a>
## PACT-073 — Finish responsive accessibility and PWA behavior

**Status:** todo · **Role:** Frontend · **Size:** L · **Type:** implementation

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-061](phase-2-social.md#pact-061)

**Components:** responsive UI, accessibility, PWA.

**Specification:** [product](../pact/product.md), [access](../pact/access.md), [alpha](../pact/alpha.md) · **Release checks:** G04

**Implement / deliver**

- Finish readable responsive desktop/phone web layouts, keyboard/focus paths, labels, clear touch controls and accessible text for gameplay decisions.
- Show stale/disconnected state and require a live server for commitments; installation/PWA/offline caching certification, audio, animation and commissioned assets are postponed.

**Deferred original scope:** Preserved in this ticket's `original_plan` in tasks.json; Alpha completion does not certify its former production/pilot acceptance.

**Acceptance**

- [ ] Desktop/phone and keyboard checks cover founding, objective/run controls, contracts, troops, raids, social views and reports without clipped or unreachable essential controls.
- [ ] Disconnect/reconnect displays truthful state and does not blindly replay signatures, raids or approvals; no gameplay consequence depends on color, sound or animation alone.

<a id="pact-074"></a>
## PACT-074 — Implement the cosmetic catalog, wallet, and unlock flow

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-047](phase-1-rules.md#pact-047), [PACT-068](phase-2-social.md#pact-068), [PACT-071](phase-3-season-one.md#pact-071)

**Components:** cosmetic catalog and wallet.

**Specification:** [product](../pact/product.md), [rules](../pact/rules.md), [architecture](../pact/architecture.md), [alpha](../pact/alpha.md) · **Release checks:** L03

**Implement / deliver**

- Extend the earned-Gem ledger with catalog definitions, price validation, account-bound inventory, cosmetic spending, and human-only purchase permissions.
- Separate achievement/rank items from sale items; model paid Gem lots and reversible entitlement provenance for later refunds.
- Support platform-origin paid Gem lots, globally shared earned Gems, and account-owned cosmetics; display available-here versus other-channel paid balances.

**Acceptance**

- [ ] Catalog purchases debit once and unlock once; an already-owned item cannot be charged again by a retry.
- [ ] Gems/skins are excluded from every economic, combat, score, queue, authority, and run-priority calculation; Envoys cannot initiate checkout.

<a id="pact-075"></a>
## PACT-075 — Integrate hosted payments and verified purchase receipts

**Status:** todo · **Role:** Backend · **Size:** L · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-007](phase-0-connections.md#pact-007), [PACT-064](phase-2-social.md#pact-064), [PACT-068](phase-2-social.md#pact-068), [PACT-074](phase-3-season-one.md#pact-074)

**Components:** checkout and payment receipts.

**Specification:** [product](../pact/product.md), [privacy](../pact/privacy.md), [architecture](../pact/architecture.md), [alpha](../pact/alpha.md) · **Release checks:** L03, L04

**Implement / deliver**

- Integrate one processor-hosted checkout behind a payment adapter; map the two Gem packs to server-controlled product IDs and localized prices.
- Add signed webhook verification, durable event deduplication, settlement-before-credit, processor receipt references, and required merchant/legal-retention configuration.
- This ticket remains web checkout only; PACT-093/094 own store and Stars adapters feeding the same verified receipt/entitlement ledger.

**Acceptance**

- [ ] Forged, duplicate, reordered, or client-modified payment events cannot mint Gems; unsuccessful payments grant nothing.
- [ ] Missing merchant/price/retention configuration disables checkout; no full card data reaches PACT and all purchase controls require human authentication.

**External prerequisites:** Merchant/processor account, product prices, legal payment-record schedule.

<a id="pact-076"></a>
## PACT-076 — Implement refunds, reversals, and cosmetic reconciliation

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-075](phase-3-season-one.md#pact-075)

**Components:** refund reconciliation.

**Specification:** [product](../pact/product.md), [privacy](../pact/privacy.md), [architecture](../pact/architecture.md), [alpha](../pact/alpha.md) · **Release checks:** L03

**Implement / deliver**

- Implement processor refund/chargeback handling using paid-lot and cosmetic provenance, including already-spent paid Gems and mixed earned/paid purchases.
- Record the deterministic reversal policy in the payment module contract before enabling checkout; reverse only attributable paid value/entitlements, preserving earned and unrelated purchases.

**Acceptance**

- [ ] Duplicate and out-of-order refund events cannot over-reverse, credit Gems, or affect ordinary game balances, Fortune, troops, buildings, or achievements.
- [ ] Full/partial refunds and mixed-funding fixtures reconcile to payment receipts with a human-readable explanation and support audit trail.
- [ ] Refund reconciliation retains original purchase-channel provenance and cannot debit another channel’s paid lot to hide an attribution error.

<a id="pact-077"></a>
## PACT-077 — Run the competitive abuse and moderation release review

**Status:** todo · **Role:** QA / Operations · **Size:** L · **Type:** verification

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-063](phase-2-social.md#pact-063), [PACT-065](phase-2-social.md#pact-065), [PACT-068](phase-2-social.md#pact-068), [PACT-069](phase-3-season-one.md#pact-069), [PACT-070](phase-3-season-one.md#pact-070)

**Components:** competitive abuse validation.

**Specification:** [delivery](../pact/delivery.md), [rules](../pact/rules.md), [privacy](../pact/privacy.md), [alpha](../pact/alpha.md) · **Release checks:** L05

**Implement / deliver**

- Execute scenarios for account farms, gift concentration, bond/default cycling, training/bond storage sheltering, indefinite owned-defender pinning, smear campaigns, and model-tier differences.
- Validate investigation evidence, review permissions, conduct notices, appeals, and alerting; preserve legitimate alliances and gifts instead of treating size or success as guilt.

**Acceptance**

- [ ] Every scenario has observed effects, a documented permitted/prohibited classification, and reproducible evidence.
- [ ] Release-blocking exploit or policy-enforcement failures receive fixes and reruns; model fairness and abuse resistance are not claimed from action caps alone.

<a id="pact-093"></a>
## PACT-093 — Implement StoreKit and Google Play cosmetic purchases

**Status:** todo · **Role:** Backend / Mobile · **Size:** L · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-074](phase-3-season-one.md#pact-074), [PACT-075](phase-3-season-one.md#pact-075), [PACT-076](phase-3-season-one.md#pact-076), [PACT-087](phase-3-season-one.md#pact-087)

**Components:** native billing adapters, receipt verification.

**Specification:** [architecture](../pact/architecture.md), [product](../pact/product.md), [privacy](../pact/privacy.md), [alpha](../pact/alpha.md) · **Release checks:** L03, L06

**Implement / deliver**

- Implement store products/price display, signed server receipt validation, entitlement reconciliation, refund/revoke notifications, and restore paths for iOS/Android.
- Maintain platform-origin paid Gem lots, shared earned Gems, and account-wide cosmetic ownership using the existing commerce interface.

**Acceptance**

- [ ] Replayed or cross-account receipts, pending/canceled purchases, out-of-order refunds, and reinstall cannot grant twice.
- [ ] Spent consumable packs are not re-credited by restore; origin-restricted balances display correctly and never affect game resources, score, or run limits.

**External prerequisites:** Apple/Google developer and merchant accounts; sandbox products and test users.

<a id="pact-094"></a>
## PACT-094 — Implement Telegram Stars cosmetic purchases

**Status:** todo · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-074](phase-3-season-one.md#pact-074), [PACT-075](phase-3-season-one.md#pact-075), [PACT-076](phase-3-season-one.md#pact-076), [PACT-088](phase-2-social.md#pact-088), [PACT-089](phase-2-social.md#pact-089)

**Components:** Stars billing adapter, cosmetic provenance.

**Specification:** [architecture](../pact/architecture.md), [product](../pact/product.md), [privacy](../pact/privacy.md), [alpha](../pact/alpha.md) · **Release checks:** L03, L06

**Implement / deliver**

- Implement server-priced Stars invoices, bounded pre-checkout validation, verified successful-payment processing, deduplicated grants, support/refund handling, and source-tagged Gem lots.
- Keep web checkout out of Telegram purchase paths; cosmetic catalog and account entitlements use the same commerce service.

**Acceptance**

- [ ] Invoice creation or pre-checkout alone never grants Gems; duplicate updates/refunds and forwarded invoices cannot alter the wrong account.
- [ ] Purchases preserve origin restrictions and account-wide cosmetic ownership without changing gameplay; failed payment retains a clear recoverable state.

**External prerequisites:** Telegram bot with Stars test and production payment capability.

<a id="pact-078"></a>
## PACT-078 — Provision and rehearse production operations

**Status:** todo · **Role:** Platform · **Size:** L · **Type:** operations

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-069](phase-3-season-one.md#pact-069), [PACT-070](phase-3-season-one.md#pact-070), [PACT-073](phase-3-season-one.md#pact-073), [PACT-076](phase-3-season-one.md#pact-076), [PACT-093](phase-3-season-one.md#pact-093), [PACT-094](phase-3-season-one.md#pact-094)

**Components:** production infrastructure and operations.

**Specification:** [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [delivery](../pact/delivery.md), [alpha](../pact/alpha.md) · **Release checks:** L04

**Implement / deliver**

- Promote and rehearse the phase-0 single-VPS stack for production with separate production database/secrets, encrypted off-host backup/restore, secrets/signing rotation, monitoring, status page, capacity alarms, migrations, and deployment rollback.
- Replace MVP-local backup and email capture with encrypted off-host backup/restore and real outbound SMTP, then configure support/moderation/privacy ownership, incident world suspension, delayed/failed notifications, provider outage handling, and retention/legal-hold operations.

**Acceptance**

- [ ] Rehearse a production-like restore, deletion suppression, outbox replay, signing-key rotation, credential incident, and world pause/resume before admitting players.
- [ ] Operators can diagnose and recover without manual unlogged balance edits; registration/checkout stay disabled when required operational configuration is missing.

**External prerequisites:** Production access to the project VPS, domain/DNS, encrypted off-host backup target, SMTP credentials, and operator coverage.

<a id="pact-079"></a>
## PACT-079 — Re-certify external clients and complete distribution

**Status:** todo · **Role:** Integrations · **Size:** L · **Type:** verification

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-049](phase-1-rules.md#pact-049), [PACT-062](phase-2-social.md#pact-062), [PACT-068](phase-2-social.md#pact-068), [PACT-073](phase-3-season-one.md#pact-073), [PACT-078](phase-3-season-one.md#pact-078)

**Components:** provider/client release certification.

**Specification:** [access](../pact/access.md), [delivery](../pact/delivery.md), [architecture](../pact/architecture.md), [alpha](../pact/alpha.md) · **Release checks:** L04

**Implement / deliver**

- Repeat full real-game connection, read/write, authority approval, bounded run, revoke, and reconnect checks for all five adapters plus ChatGPT and Claude on the release candidate.
- Submit and complete required external-client distribution reviews; publish tested plans/platforms/models/dates and a generic MCP guide.
- Certify Gemini CLI and the Grok-powered external tool client with real eligible accounts, and run the deferred five-person-per-route unaided setup study; clearly separate API model support from consumer-chat installation availability.

**Acceptance**

- [ ] All required routes and the deferred unfamiliar-user setup study pass against production-like endpoints and shipped schemas, not just phase-0 fixtures.
- [ ] Review acceptance and host availability are evidenced before advertising support; a private developer connection is not represented as universal installation.

**External prerequisites:** Eligible release host accounts and any required distribution approvals.

<a id="pact-095"></a>
## PACT-095 — Prepare and certify mobile-store and Telegram distribution

**Status:** todo · **Role:** Mobile / Operations · **Size:** L · **Type:** operations

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-073](phase-3-season-one.md#pact-073), [PACT-078](phase-3-season-one.md#pact-078), [PACT-087](phase-3-season-one.md#pact-087), [PACT-088](phase-2-social.md#pact-088), [PACT-090](phase-2-social.md#pact-090), [PACT-091](phase-2-social.md#pact-091), [PACT-093](phase-3-season-one.md#pact-093), [PACT-094](phase-3-season-one.md#pact-094)

**Components:** signed builds, store submissions, Telegram production configuration.

**Specification:** [architecture](../pact/architecture.md), [privacy](../pact/privacy.md), [delivery](../pact/delivery.md), [alpha](../pact/alpha.md) · **Release checks:** L04, L06

**Implement / deliver**

- Prepare iOS/Android signed releases, privacy/data disclosures, account deletion access, report/block controls, review accounts, production app links/push, and supported-device testing.
- Complete required store reviews, Telegram Mini App/bot metadata/deep links, and each channel’s digital-purchase checks; record policy versions and acceptance evidence.

**Acceptance**

- [ ] Release artifacts are reproducible and the tested binaries match submitted builds; production links resolve to the correct account/destination.
- [ ] Required reviews/disclosures and purchase checks pass; web availability alone cannot mark native/Telegram distribution done.

**External prerequisites:** Apple/Google distribution approvals; production Telegram bot/domain configuration.

<a id="pact-097"></a>
## PACT-097 — Certify the full production channel matrix

**Status:** todo · **Role:** QA · **Size:** L · **Type:** verification

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-079](phase-3-season-one.md#pact-079), [PACT-092](phase-2-social.md#pact-092), [PACT-093](phase-3-season-one.md#pact-093), [PACT-094](phase-3-season-one.md#pact-094), [PACT-095](phase-3-season-one.md#pact-095), [PACT-096](phase-1-rules.md#pact-096)

**Components:** production-like cross-surface certification.

**Specification:** [architecture](../pact/architecture.md), [delivery](../pact/delivery.md), [alpha](../pact/alpha.md) · **Release checks:** L04, L06

**Implement / deliver**

- Repeat handoff/approval/revoke/inbox/model-run fixtures across the production-like web, signed native apps, Telegram, and certified assistant clients.
- Rehearse channel outage, store/Stars refund replay, device reinstall, stale client API version, account deletion, and external-host feature unavailability.

**Acceptance**

- [ ] Each required surface has evidence tied to its build/client version and backend revision; advertised capability labels match actual supported routes.
- [ ] Cross-surface entitlements, run leases, event state, and privacy controls remain consistent; a blocked store review or failed required channel blocks release.

<a id="pact-099"></a>
## PACT-099 — Complete agent-first access, learning, and observable play

**Status:** todo · **Role:** Integrations · **Size:** L · **Type:** implementation

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-054](phase-2-social.md#pact-054), [PACT-055](phase-2-social.md#pact-055), [PACT-056](phase-2-social.md#pact-056), [PACT-057](phase-2-social.md#pact-057), [PACT-058](phase-2-social.md#pact-058), [PACT-059](phase-2-social.md#pact-059), [PACT-061](phase-2-social.md#pact-061), [PACT-062](phase-2-social.md#pact-062), [PACT-069](phase-3-season-one.md#pact-069), [PACT-070](phase-3-season-one.md#pact-070), [PACT-073](phase-3-season-one.md#pact-073)

**Components:** agent guide and game tool registry, observable agent activity, external and in-app result summaries.

**Specification:** [alpha](../pact/alpha.md), [runtime](../pact/runtime.md), [social](../pact/social.md), [product](../pact/product.md) · **Release checks:** G02, G03

**Implement / deliver**

- Extend shared MCP/in-app tools and short versioned lessons to every Alpha social/season feature, including real player/opportunity discovery and explicit human-decision handoff.
- Persist bounded, owner-visible activity and concise run summaries for external and in-app agents: actions/record IDs, results, pending decisions and next steps, never hidden reasoning.
- Support useful recovery from busy/stale/invalid actions and small-model-friendly context; keep separate account identity and existing bounded runs, with no scheduled unsolicited inference.

**Acceptance**

- [ ] A fresh connected agent learns state/rules, discovers real counterparties and acts from a normal objective without repository access, supplied UUIDs or action JSON; no fabricated players.
- [ ] New gameplay tools use the existing dispatcher/views and hand back human-only decisions rather than bypassing them; web and agent reads show the same committed records.
- [ ] Each account's web activity/report view truthfully separates committed/proposed/failed/waiting steps and can resume from receipts after disconnect; malformed/busy actions provide useful feedback without duplicate effects.

<a id="pact-080"></a>
## PACT-080 — Rehearse Season One end to end

**Status:** todo · **Role:** QA · **Size:** L · **Type:** verification

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-054](phase-2-social.md#pact-054), [PACT-055](phase-2-social.md#pact-055), [PACT-056](phase-2-social.md#pact-056), [PACT-057](phase-2-social.md#pact-057), [PACT-058](phase-2-social.md#pact-058), [PACT-059](phase-2-social.md#pact-059), [PACT-061](phase-2-social.md#pact-061), [PACT-062](phase-2-social.md#pact-062), [PACT-069](phase-3-season-one.md#pact-069), [PACT-070](phase-3-season-one.md#pact-070), [PACT-073](phase-3-season-one.md#pact-073), [PACT-099](phase-3-season-one.md#pact-099)

**Components:** full-season release validation.

**Specification:** [delivery](../pact/delivery.md), [alpha](../pact/alpha.md) · **Release checks:** G01, G02, G03, G04, G05, G06

**Implement / deliver**

- Rehearse the game-only Alpha from founding through development, discovery, negotiation, supply/garrison, intelligence, conflict, political publication and season conclusion; use an isolated accelerated world for season boundaries.
- Observe three independent connected agents from ordinary objectives without operator UUIDs/action coaching; retain visible activity/reports and document actual successes, failures, model use and enjoyment feedback. No production/payments/native/load certification.

**Deferred original scope:** Preserved in this ticket's `original_plan` in tasks.json; Alpha completion does not certify its former production/pilot acceptance.

**Acceptance**

- [ ] All preceding Alpha tickets are done and the complete gameplay sequence has reproducible evidence, coherent receipts/state and no unresolved gameplay-blocking defect.
- [ ] Three agent accounts discover/learn/play without repository material or privileged edits; pending agents remain pending, reports agree with receipts, and failed behavior is recorded and rerun after fixes.
- [ ] The isolated season rehearsal preserves assets/ongoing terms and concludes with correct results; Alpha handoff names the deployed revision, known limits and how friends connect/play, without claiming production or an unobserved fun result.

<a id="pact-098"></a>
## PACT-098 — Replace MVP operator placeholders with reviewed production facts

**Status:** todo · **Role:** Operations / Privacy · **Size:** M · **Type:** operations

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-025](phase-0-connections.md#pact-025), [PACT-068](phase-2-social.md#pact-068), [PACT-078](phase-3-season-one.md#pact-078)

**Components:** production operator configuration, legal and processor records.

**Specification:** [privacy](../pact/privacy.md), [access](../pact/access.md), [architecture](../pact/architecture.md), [delivery](../pact/delivery.md), [alpha](../pact/alpha.md) · **Release checks:** L04

**Implement / deliver**

- Replace every synthetic MVP controller, address, contact, ownership, terms/privacy, privacy-request, processor, agreement, data-location, transfer, and email-sender value with reviewed production facts.
- Verify production staff MFA, public notices, outbound email, privacy requests, and processor/transfer records before enabling production or paid signup.

**Acceptance**

- [ ] No test domain, temporary owner, placeholder agreement, synthetic-data restriction, or captured-only sender remains in the production operator register or public notices.
- [ ] The production preflight and independent review pass against the deployed register before any production or paid account is admitted.

**External prerequisites:** Actual operator identity, public legal contacts, reviewed notices, and processor agreements.

<a id="pact-081"></a>
## PACT-081 — Accept and prepare the Season One release

**Status:** todo · **Role:** Release · **Size:** S · **Type:** gate

**Delivery track:** later · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-068](phase-2-social.md#pact-068), [PACT-069](phase-3-season-one.md#pact-069), [PACT-070](phase-3-season-one.md#pact-070), [PACT-071](phase-3-season-one.md#pact-071), [PACT-072](phase-3-season-one.md#pact-072), [PACT-073](phase-3-season-one.md#pact-073), [PACT-074](phase-3-season-one.md#pact-074), [PACT-075](phase-3-season-one.md#pact-075), [PACT-076](phase-3-season-one.md#pact-076), [PACT-077](phase-3-season-one.md#pact-077), [PACT-078](phase-3-season-one.md#pact-078), [PACT-079](phase-3-season-one.md#pact-079), [PACT-080](phase-3-season-one.md#pact-080), [PACT-098](phase-3-season-one.md#pact-098), [PACT-084](phase-3-season-one.md#pact-084), [PACT-087](phase-3-season-one.md#pact-087), [PACT-093](phase-3-season-one.md#pact-093), [PACT-094](phase-3-season-one.md#pact-094), [PACT-095](phase-3-season-one.md#pact-095), [PACT-097](phase-3-season-one.md#pact-097), [PACT-099](phase-3-season-one.md#pact-099)

**Components:** Season One release gate.

**Specification:** [delivery](../pact/delivery.md), [product](../pact/product.md), [alpha](../pact/alpha.md) · **Release checks:** L01, L02, L03, L04, L05, L06

**Implement / deliver**

- Assemble the release revision, schema/rules versions, supported-client matrix, migration plan, tested capacity, operator roster, rollback runbook, season configuration, and pass/fail register. Include native/Telegram builds, store approval evidence, and the tested client capability matrix.
- Prepare the deploy command and controlled signup enablement; actual release execution is a separate explicit operational action, not an effect of generating this backlog.

**Acceptance**

- [ ] Every L01–L06 criterion passes, including native/Telegram distribution, verified payments, and the complete channel matrix; all blocking defects/external reviews are closed.
- [ ] The release record names who can pause/recover the world and provides a reproducible go/no-go checklist; no task is marked completed merely because it is scheduled.
