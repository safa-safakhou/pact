# Phase 3 — Season One release

**103 tickets · 70 completed.** [Backlog overview](README.md) · [Machine-readable tickets](tasks.json)

Dependencies are completion requirements. The original Alpha track depends on the completed rules gate; new Alpha follow-ups have a separate checkpoint and are completed; the completed experience and friends batches have their own evidence. Postponed production/pilot gates do not block either. Other phases retain their original gates. Owner roles are disciplines, not assigned people; size is not a time commitment.

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

**Status:** done · **Role:** Frontend · **Size:** L · **Type:** implementation

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-061](phase-2-social.md#pact-061)

**Components:** responsive UI, accessibility, PWA.

**Specification:** [product](../pact/product.md), [access](../pact/access.md), [alpha](../pact/alpha.md) · **Release checks:** G04

**Implement / deliver**

- Finish readable responsive desktop/phone web layouts, keyboard/focus paths, labels, clear touch controls and accessible text for gameplay decisions.
- Show stale/disconnected state and require a live server for commitments; installation/PWA/offline caching certification, audio, animation and commissioned assets are postponed.

**Deferred original scope:** Preserved in this ticket's `original_plan` in tasks.json; Alpha completion does not certify its former production/pilot acceptance.

**Acceptance**

- [x] Desktop/phone and keyboard checks cover founding, objective/run controls, contracts, troops, raids, social views and reports without clipped or unreachable essential controls.
- [x] Disconnect/reconnect displays truthful state and does not blindly replay signatures, raids or approvals; no gameplay consequence depends on color, sound or animation alone.

**Assignee:** Mohammad Safakhou / Codex

**Evidence**

- dbb3fba completes scoped Alpha usability. Report: docs/implementation/reports/alpha-web-usability.md; recovery/fixtures: docs/operations/alpha-web.md. Linear MNI-144 Done, active acceptance checked, original postponed checks preserved (2026-10-01).
- Actual isolated Chrome phone 390x844/320x740 and desktop 1280x900 checks: keyboard founding, skip link, objective/model traversal, build/training receipts, exact versioned supply preview/sign, Escape focus return, social/raid controls and truthful report failure; measured no essential input/select/textarea/button horizontal clipping. No live provider call or completed battle/settlement claimed.
- Local API timeout with a pending offer confirmation removed it and disabled commitments; resumed API + read polling recovered without replay or offer creation. Five dedicated unit tests cover offline/reconnect generations, 503, SDK/approval/run write guard and no queued writes.
- Node 24 npm run build/typecheck/test/lint pass: 210 unit, 282 PostgreSQL integration pass and one optional live-model skip; planner render/check and git diff --check pass. Local-only, not pushed/deployed; hosted alpha-20260929-4 / 2143d92 unchanged.

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

**Status:** done · **Role:** Integrations · **Size:** L · **Type:** implementation

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-054](phase-2-social.md#pact-054), [PACT-055](phase-2-social.md#pact-055), [PACT-056](phase-2-social.md#pact-056), [PACT-057](phase-2-social.md#pact-057), [PACT-058](phase-2-social.md#pact-058), [PACT-059](phase-2-social.md#pact-059), [PACT-061](phase-2-social.md#pact-061), [PACT-062](phase-2-social.md#pact-062), [PACT-069](phase-3-season-one.md#pact-069), [PACT-070](phase-3-season-one.md#pact-070), [PACT-073](phase-3-season-one.md#pact-073)

**Components:** agent guide and game tool registry, observable agent activity, external and in-app result summaries.

**Specification:** [alpha](../pact/alpha.md), [runtime](../pact/runtime.md), [social](../pact/social.md), [product](../pact/product.md) · **Release checks:** G02, G03

**Implement / deliver**

- Extend shared MCP/in-app tools and short versioned lessons to every Alpha social/season feature, including real player/opportunity discovery and explicit human-decision handoff.
- Persist bounded, owner-visible activity and concise run summaries for external and in-app agents: actions/record IDs, results, pending decisions and next steps, never hidden reasoning.
- Support useful recovery from busy/stale/invalid actions and small-model-friendly context; keep separate account identity and existing bounded runs, with no scheduled unsolicited inference.

**Acceptance**

- [x] A fresh connected agent learns state/rules, discovers real counterparties and acts from a normal objective without repository access, supplied UUIDs or action JSON; no fabricated players.
- [x] New gameplay tools use the existing dispatcher/views and hand back human-only decisions rather than bypassing them; web and agent reads show the same committed records.
- [x] Each account's web activity/report view truthfully separates committed/proposed/failed/waiting steps and can resume from receipts after disconnect; malformed/busy actions provide useful feedback without duplicate effects.

**Assignee:** Mohammad Safakhou / Codex

**Evidence**

- OAuth button follow-up: e07dd47 / alpha-20261001-2; docs/implementation/reports/oauth-button-fix.md. Same-origin CSP, visible pending/failure feedback, request timeouts and duplicate submission guard. API build/typecheck/lint, 212 unit and 4 targeted integration tests pass. Backup e55cbc60, deployment/public verification pass. Fresh Chrome dummy login visibly sends POST and shows rejection with button restored, no script errors; personal owner authorization remains for owner. Linear MNI-158 Done, comment 97d3c0f0-7e94-4960-97f5-8949fd10fbf0.
- Complete: 8789315 / 88c273f; docs/implementation/reports/agent-first-completion.md. Atomic external journal, owner Envoy/API/MCP reporting, short lessons and recovery. Build/typecheck/lint, 212 unit and 284 integration pass, optional live-model skip. Deployed alpha-20261001-1 with migrations 0036–0044 and public verification. Three fresh independent Luna accounts learned/discovered/acted from ordinary objectives without UUID/action/repository coaching; five committed moves match owner reports, negotiations/human offer authority remain honestly pending. Normal temporary OAuth grants revoked. Linear MNI-158 Done; comment db6bb46a-bdbd-4be9-9b2c-0400ded0498a.
- Partial PACT-099 learning/discovery increment: 8789315; docs/implementation/reports/agent-first-progress.md. Shared owner guide and public handle lookup across MCP/in-app worker; versioned lessons and bounded complete-field output. Node 24 build/typecheck/lint pass, 212 unit and 283 PostgreSQL integration tests pass, one optional live-model skip; final targeted owner/start/lookup fake-provider test passes. No external activity journal or fresh uncoached model play yet; acceptance remains incomplete, In Progress. Local only, hosted 2143d92 unchanged.

<a id="pact-080"></a>
## PACT-080 — Rehearse Season One end to end

**Status:** done · **Role:** QA · **Size:** L · **Type:** verification

**Delivery track:** alpha · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-054](phase-2-social.md#pact-054), [PACT-055](phase-2-social.md#pact-055), [PACT-056](phase-2-social.md#pact-056), [PACT-057](phase-2-social.md#pact-057), [PACT-058](phase-2-social.md#pact-058), [PACT-059](phase-2-social.md#pact-059), [PACT-061](phase-2-social.md#pact-061), [PACT-062](phase-2-social.md#pact-062), [PACT-069](phase-3-season-one.md#pact-069), [PACT-070](phase-3-season-one.md#pact-070), [PACT-073](phase-3-season-one.md#pact-073), [PACT-099](phase-3-season-one.md#pact-099)

**Components:** full-season release validation.

**Specification:** [delivery](../pact/delivery.md), [alpha](../pact/alpha.md) · **Release checks:** G01, G02, G03, G04, G05, G06

**Implement / deliver**

- Rehearse the game-only Alpha from founding through development, discovery, negotiation, supply/garrison, intelligence, conflict, political publication and season conclusion; use an isolated accelerated world for season boundaries.
- Observe three independent connected agents from ordinary objectives without operator UUIDs/action coaching; retain visible activity/reports and document actual successes, failures, model use and enjoyment feedback. No production/payments/native/load certification.

**Deferred original scope:** Preserved in this ticket's `original_plan` in tasks.json; Alpha completion does not certify its former production/pilot acceptance.

**Acceptance**

- [x] All preceding Alpha tickets are done and the complete gameplay sequence has reproducible evidence, coherent receipts/state and no unresolved gameplay-blocking defect.
- [x] Three agent accounts discover/learn/play without repository material or privileged edits; pending agents remain pending, reports agree with receipts, and failed behavior is recorded and rerun after fixes.
- [x] The isolated season rehearsal preserves assets/ongoing terms and concludes with correct results; Alpha handoff names the deployed revision, known limits and how friends connect/play, without claiming production or an unobserved fun result.

**Assignee:** Mohammad Safakhou / Codex

**Evidence**

- Complete narrowed Alpha: docs/implementation/reports/alpha-final-rehearsal.md; friends docs/operations/alpha-start.md. All 13 dependencies freshly Done before claim. Full integration rerun 284 pass/one optional live-model skip, covering real command/contract/battle/political publication and isolated six-week closure/carryover/provisional results. Three independent live Luna accounts, coherent owner activity and matching Chrome deployment observed; mixed feedback recorded, no unobserved fun/production claims. Live alpha-20261001-1 / 88c273f, backup 537793fe, migrations 0036–0044, deploy verification pass. Linear MNI-155 Done; comment 5cb5a440-3216-4a6c-b70a-74716d5845e5. Original Later acceptance remains postponed.

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

<a id="pact-100"></a>
## PACT-100 — Fix exact approval links under the hosted PACT path

**Status:** done · **Role:** Integrations · **Size:** S · **Type:** implementation

**Delivery track:** alpha_followup · [Alpha playtest follow-ups](alpha-playtest-fixes.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099)

**Components:** approvals, MCP transport, web exact approval routing.

**Specification:** [alpha](../pact/alpha.md), [access](../pact/access.md), [runtime](../pact/runtime.md) · **Release checks:** G02, G03

**Implement / deliver**

- Generate one canonical configured approval URL for MCP proposal/status and web handoff; support /pact deployment and root deployment through shared link construction.
- Preserve authenticated human preview and exact one-use approval/rejection; update the MCP/API guide and add a focused completion report.

**Acceptance**

- [x] Proposal and status tools return a link that opens PACT exact review and preselects the correct approval ID under /pact; it never opens the other hosted application.
- [x] Root-path deployment also works; logged-out owners can authenticate and return to the intended review without approving automatically.
- [x] Approve/reject uses existing exact-command handlers; an agent, wrong owner, expired request or repeated decision cannot gain authority or duplicate effects.
- [x] Meaningful route/authorization checks and a synthetic hosted click-through are recorded separately from local tests.

**Assignee:** Mohammad Safakhou / Codex

**Evidence**

- docs/implementation/reports/alpha-playtest-fixes.md
- docs/implementation/reports/evidence/alpha-followup-initial-20261002.json

<a id="pact-101"></a>
## PACT-101 — Make private Alpha signup and Codex connection setup actionable

**Status:** done · **Role:** Integrations · **Size:** M · **Type:** implementation

**Delivery track:** alpha_followup · [Alpha playtest follow-ups](alpha-playtest-fixes.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099)

**Components:** web signup and Envoy connection entry, OAuth connection status, Alpha setup runbooks.

**Specification:** [alpha](../pact/alpha.md), [access](../pact/access.md), [product](../pact/product.md), [privacy](../pact/privacy.md) · **Release checks:** G02, G04

**Implement / deliver**

- Present a clear external-Codex setup route with exact canonical resource, copyable commands, tested client version and useful unsupported-client/OAuth recovery feedback.
- Show the authenticated external PACT connection independently of an optional saved in-app provider credential; never display or request tokens/passwords in chats.
- State the current private captured-email limitation at signup and provide an explicit secure operator-to-owner verification handoff/runbook. Real outbound email remains PACT-078/060 Later; do not bypass email verification or introduce paid infrastructure.
- Update alpha-start/codex-playtest guides and document recent-authentication recovery for authority changes.

**Acceptance**

- [x] A fresh synthetic owner can follow the published private signup/verification steps without guessing where the token comes from; captured email is labeled operator-assisted rather than delivered internet email.
- [x] The tested Codex route completes sign-in, DCR/PKCE consent, own-account read and permitted write without conflicting OAuth resources; unsupported client versions receive actionable instructions.
- [x] External connection account/status and revoke/reconnect instructions are visible without falsely requiring an in-app model API credential.
- [x] Credentials remain separate and secret; no verification bypass, public Mailpit exposure, unauthenticated token retrieval or automatic inference occurs.
- [x] Actual tested versions and interventions are recorded; unavailable client/SMTP routes are not certified or marked successful.

**Assignee:** Mohammad Safakhou / Codex

**Evidence**

- docs/implementation/reports/alpha-playtest-fixes.md
- docs/implementation/reports/evidence/alpha-followup-initial-20261002.json

<a id="pact-102"></a>
## PACT-102 — Make current kingdom reads and validation errors reliable for small agents

**Status:** done · **Role:** Integrations · **Size:** M · **Type:** implementation

**Delivery track:** alpha_followup · [Alpha playtest follow-ups](alpha-playtest-fixes.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099)

**Components:** shared read contracts, MCP tools, in-app tool registry, authorized world projections.

**Specification:** [alpha](../pact/alpha.md), [access](../pact/access.md), [runtime](../pact/runtime.md), [architecture](../pact/architecture.md) · **Release checks:** G02, G03

**Implement / deliver**

- Provide an identity-derived own-kingdom read or equally discoverable unambiguous self-read shape while preserving targetKingdomId for authorized other-player projections.
- Return bounded field-level validation/help for malformed world reads and invalid forecasts; teach the valid argument shape in tool descriptions and recovery lessons.
- Distinguish deterministic precommit rejection/no receipt from uncertain committed-command recovery; share semantics across MCP and in-app adapters.

**Acceptance**

- [x] A fresh Luna agent reads its own current buildings/builders/resources from an ordinary status objective without supplied UUIDs or mechanical coaching.
- [x] Malformed field names, absent required target and invalid forecast horizons identify the correction without returning private data or unsafe input text.
- [x] Owner/contact/public projections retain authorization boundaries; caller-supplied ownership cannot change authenticated identity.
- [x] Deterministic failed commands explain when no receipt exists; uncertain committed responses recover by the same command ID without duplicates.
- [x] Focused contract/behavior checks cover valid reads, bad inputs, absent kingdoms and unauthorized views; live model results are documented independently.

**Assignee:** Mohammad Safakhou / Codex

**Evidence**

- docs/implementation/reports/alpha-playtest-fixes.md
- docs/implementation/reports/evidence/alpha-followup-initial-20261002.json

<a id="pact-103"></a>
## PACT-103 — Clarify founding resources, affordability and trade authority for agents

**Status:** done · **Role:** Gameplay · **Size:** M · **Type:** implementation

**Delivery track:** alpha_followup · [Alpha playtest follow-ups](alpha-playtest-fixes.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099)

**Components:** agent start guide and versioned lessons, authority resource projections, game error explanations, Codex playtest docs.

**Specification:** [alpha](../pact/alpha.md), [rules](../pact/rules.md), [runtime](../pact/runtime.md), [access](../pact/access.md) · **Release checks:** G02, G03

**Implement / deliver**

- Explain ordinary versus restricted founding resources in whole units, eligible construction/training/food uses, reserve-floor inputs and actual current action affordability.
- Give actionable stock shortfall or game-time waiting information without changing economy values, costs, reserve floors or authority limits.
- Teach contact-request races/incoming human-only acceptance, proposal versus signature versus active contract, and when exact human review is genuinely required.
- Resolve the documentation contradiction about unsigned supply proposals versus supply.sign authority by checking the owning specs and implementation. A substantive conflict requires an explicit documented correction and affected fixtures, not silent authority expansion.

**Acceptance**

- [x] Fresh-state fixtures show construction can use eligible founding allowances while cold contacts/transfers cannot spend restricted stock.
- [x] The guide explains food-reserve calculations and ordinary/marked units accurately; small-model checks do not mistake construction allowance for transferable stock.
- [x] Failure feedback identifies actual shortage/prerequisite and next legal step; it does not advise changing mandates or requesting approval for every permitted move.
- [x] Incoming contact requests remain human-only and duplicate/opposing requests produce useful recovery rather than redundant approval.
- [x] Supply-offer creation, signing authority and activation semantics agree across specs, guides and operator instructions; signing still reserves authorized exposure transactionally.
- [x] Context/usage changes are measured against the recorded playtest, with no unsupported dollar-savings or enjoyment claim.

**Assignee:** Mohammad Safakhou / Codex

**Evidence**

- docs/implementation/reports/alpha-playtest-fixes.md
- docs/implementation/reports/evidence/alpha-followup-initial-20261002.json

<a id="pact-104"></a>
## PACT-104 — Expose completed builds and actual trade deliveries to owners and agents

**Status:** done · **Role:** Backend · **Size:** M · **Type:** implementation

**Delivery track:** alpha_followup · [Alpha playtest follow-ups](alpha-playtest-fixes.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-102](phase-3-season-one.md#pact-102)

**Components:** authorized consequence projections, Kingdom People Chronicle views, agent guide and reports.

**Specification:** [alpha](../pact/alpha.md), [rules](../pact/rules.md), [runtime](../pact/runtime.md), [product](../pact/product.md), [privacy](../pact/privacy.md) · **Release checks:** G03, G04

**Implement / deliver**

- Expose current build completion, counterparty signatures, contract status and delivered/failed/overflow installment totals through shared authorized module interfaces.
- Show readable named events and links in People/Chronicle and relevant agent views; distinguish original commit receipts from current consequences.
- Implement explicit privacy, retention and export treatment for any newly persisted view data; prefer existing authoritative records over redundant state.

**Acceptance**

- [x] A normal owner and their agent can verify a completed Farm II and a signed active contract without database access.
- [x] Actual minute deliveries show amount/resource/counterparty/as-of game time and pending/default/overflow status; an unsigned offer or committed message never appears as delivered trade.
- [x] People/Chronicle first-session hints lead to visible relevant evidence; a completed build/contact/trade does not leave an empty misleading history.
- [x] Other players cannot read private stocks, signatures/messages/installments beyond the specified view; reusable platform packages do not import PACT domain types.
- [x] Replay and settlement checks preserve exact arithmetic, no duplicate totals, and consistent web/MCP facts; no model/network calls run inside transactions.

**Assignee:** Mohammad Safakhou / Codex

**Evidence**

- docs/implementation/reports/alpha-playtest-fixes.md
- docs/implementation/reports/evidence/alpha-followup-consequences-20261002.json

<a id="pact-105"></a>
## PACT-105 — Keep external-agent activity ordered, refreshed and reconciled with current state

**Status:** done · **Role:** Frontend · **Size:** M · **Type:** implementation

**Delivery track:** alpha_followup · [Alpha playtest follow-ups](alpha-playtest-fixes.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-100](phase-3-season-one.md#pact-100), [PACT-104](phase-3-season-one.md#pact-104)

**Components:** external activity query/report formatting, Envoy activity refresh, live consequence links.

**Specification:** [alpha](../pact/alpha.md), [runtime](../pact/runtime.md), [product](../pact/product.md), [privacy](../pact/privacy.md) · **Release checks:** G03, G04

**Implement / deliver**

- Sort by numeric sequence/time, preserve factual historical tool outcomes, and attach current approval/contact/build/contract status with a clear next human decision.
- Refresh recorded activity while the owner views it through bounded polling or an existing event mechanism; reading/refreshing must never initiate inference.
- Use named actions, ordinary-unit costs, current result/as-of time and supporting receipts instead of bare UUID/status dumps; handle disconnected/stale/error states honestly.

**Acceptance**

- [x] IDs spanning 9/10/99/100 remain in chronological order, with stable pagination/deduplication.
- [x] New external moves appear without a manual refresh while the screen is active; background/network behavior is bounded and cleaned up on unmount.
- [x] Accepted contacts, approved/rejected requests and completed builds no longer display unresolved next steps; historical outcomes are retained and labeled.
- [x] Unknown/offline current status is labeled stale rather than inferred; receipt/proposal/commit/completion meanings remain separate.
- [x] No hidden reasoning, credentials or other-player private content is stored or displayed, and no refresh starts a model.

**Assignee:** Mohammad Safakhou / Codex

**Evidence**

- docs/implementation/reports/alpha-playtest-fixes.md
- docs/implementation/reports/evidence/alpha-followup-activity-20261002.json
- Build/type/lint passed; 221 unit, 287 integration (1 skipped); hosted polling/offline/reconnect/current approval/contact/build/trade passed.

<a id="pact-106"></a>
## PACT-106 — Show remaining game time for builds and contracts

**Status:** done · **Role:** Frontend · **Size:** S · **Type:** implementation

**Delivery track:** alpha_followup · [Alpha playtest follow-ups](alpha-playtest-fixes.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099)

**Components:** shared web game-clock display, builder contract scout and raid deadlines.

**Specification:** [alpha](../pact/alpha.md), [rules](../pact/rules.md), [product](../pact/product.md) · **Release checks:** G03, G04

**Implement / deliver**

- Render remaining committed game time and active/paused/stale clock status for deadlines; label any absolute timestamp as game time.
- Use explicit projection clock inputs, not assumptions that wall clock and game clock coincide; update player documentation.

**Acceptance**

- [x] A new one-hour contract still shows about one game hour remaining when the world is an hour behind wall time; it does not imply expiry in two wall minutes.
- [x] Build, contract, scout and raid timing uses consistent labeling/remaining-game-time behavior across time zones and pause/resume.
- [x] Offline/stale projections do not promise real-time completion; display refresh never mutates or advances the world.
- [x] Meaningful offset/paused/boundary display checks and desktop/phone observations are recorded.

**Assignee:** Mohammad Safakhou / Codex

**Evidence**

- docs/implementation/reports/alpha-playtest-fixes.md
- docs/implementation/reports/evidence/alpha-followup-timing-20261002.json
- npm test: 221 passed; npm run test:integration: 287 passed, 1 skipped; hosted desktop/390px phone 59m game time remaining despite wall offset; local paused/boundary checks passed.

<a id="pact-107"></a>
## PACT-107 — Put connection, progress and next decisions first on desktop and phone

**Status:** done · **Role:** Frontend · **Size:** M · **Type:** implementation

**Delivery track:** alpha_followup · [Alpha playtest follow-ups](alpha-playtest-fixes.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-101](phase-3-season-one.md#pact-101), [PACT-105](phase-3-season-one.md#pact-105), [PACT-106](phase-3-season-one.md#pact-106)

**Components:** web Envoy information order, People discovery/contact entry, first-session navigation.

**Specification:** [alpha](../pact/alpha.md), [product](../pact/product.md), [architecture](../pact/architecture.md) · **Release checks:** G02, G04

**Implement / deliver**

- Surface current Codex connection, objective/last meaningful result, pending human decisions and next action before optional provider or advanced social controls.
- Put basic contacts/real opportunities/negotiation ahead of Courts/articles/allegiance for a fresh player without deleting those Alpha features.
- Preserve keyboard/focus/accessibility and clear separation of game facts from player/model claims; replace technical receipt JSON notices with readable outcomes and evidence access.

**Acceptance**

- [x] At 390px viewport a fresh owner can locate connection and current progress/decision without scrolling through unrelated provider and raw activity forms.
- [x] Desktop/phone keep all authorized functionality, no horizontal overflow, usable focus order and keyboard activation of the primary journey.
- [x] A pending human review links to its exact request and a completed decision produces readable status, not a persistent full receipt JSON dump.
- [x] A disconnected/external-only account is clearly distinguished from an optional missing in-app model credential.
- [x] Screen observations verify actual sequence and distances; physical-device usability is not claimed from viewport emulation.

**Assignee:** Mohammad Safakhou / Codex

**Evidence**

- docs/implementation/reports/alpha-playtest-fixes.md
- docs/implementation/reports/evidence/alpha-followup-layout-final-20261002.json
- docs/implementation/reports/evidence/alpha-followup-layout-20261002.json
- alpha-20261002-5 public deployment verification passed; keyboard/390px/1280px/no overflow/current connection/real exact rejection verified. Build/types/lint; 221 unit and 288 integration passed (1 skipped).

<a id="pact-108"></a>
## PACT-108 — Repeat the fresh three-player journey and document remaining friction

**Status:** done · **Role:** QA · **Size:** M · **Type:** verification

**Delivery track:** alpha_followup · [Alpha playtest follow-ups](alpha-playtest-fixes.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-100](phase-3-season-one.md#pact-100), [PACT-101](phase-3-season-one.md#pact-101), [PACT-102](phase-3-season-one.md#pact-102), [PACT-103](phase-3-season-one.md#pact-103), [PACT-104](phase-3-season-one.md#pact-104), [PACT-105](phase-3-season-one.md#pact-105), [PACT-106](phase-3-season-one.md#pact-106), [PACT-107](phase-3-season-one.md#pact-107)

**Components:** fresh-player test harness, hosted synthetic journey evidence, Alpha handoff and completion reports.

**Specification:** [alpha](../pact/alpha.md), [delivery](../pact/delivery.md), [access](../pact/access.md), [runtime](../pact/runtime.md), [product](../pact/product.md) · **Release checks:** G02, G03, G04, G06

**Implement / deliver**

- Re-run three fresh independently authenticated Luna players from ordinary objectives with normal resources/game clock, no supplied IDs/rules/action JSON or hidden mechanical coaching.
- Exercise documented private verification, supported OAuth route, first improvement, discovery/human contact acceptance, exact approval, negotiation, signature and observable delivery/completion.
- Record all setup assistance, model usage, failures and outcome disagreements; fix/retest acceptance failures before claiming this follow-up checkpoint complete.
- Use the existing VPS only when a later implementation assignment covers deployment; never contact real testers or expand provider spending automatically.

**Acceptance**

- [x] Every PACT-100–107 dependency is Done with per-ticket evidence before this retest is claimed.
- [x] Three account identities remain separate; real player discovery, authorized actions, human-only decisions and at least one contract with actual delivery are verified through normal owner/agent views.
- [x] Models and owner screens agree on finished work and pending obligations; wrong reports/failed routes remain explicitly recorded and resolved or reported as blockers.
- [x] Phone viewport/keyboard/approval links and disconnect/reconnect/revocation checks use dated real observations; no full production/provider/physical-device certification is inferred.
- [x] Temporary grants/sessions and own local credentials are cleaned up while preserving reviewable synthetic gameplay records.
- [x] A durable report names hosted revision, tested client/model, commands/results, token usage, assistance and limits. Real human enjoyment and Later pilot/SMTP work remain unproven unless separately observed.

**Assignee:** Mohammad Safakhou / Codex

**Evidence**

- docs/implementation/reports/alpha-three-player-retest-20261002.md
- docs/implementation/reports/evidence/alpha-three-player-retest-20261002.json
- docs/implementation/reports/alpha-playtest-fixes.md

<a id="pact-109"></a>
## PACT-109 — Freeze the small web-experience scope and asset list

**Status:** done · **Role:** Design · **Size:** S · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108)

**Components:** Design, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G01, G06

**Implement / deliver**

- Write one brief with the existing five palette colours, four character silhouettes, the exact asset counts in PACT-114–119, and one table linking each cue to an existing authorized event.
- Record presentation scope correction and affected-specification review before implementation. Preserve the economy, human decisions, receipts and the 28 Later tasks.

**Acceptance**

- [x] Brief contains an inventory with filename/format/producer/event/owner/privacy/fallback for every bounded asset; no 'and more' deliverable or extra channel is included.
- [x] Every asset is Codex-generated through image generation, authored SVG/CSS or procedural WAV; no founder files, recording, new account or paid service is a prerequisite.
- [x] Affected specification/ticket review is recorded, with any necessary source changes explicitly versioned; historical acceptance evidence remains tied to its original revision.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md
- docs/pact/experience.md
- docs/implementation/experience-inventory.json

<a id="pact-110"></a>
## PACT-110 — Prove image, motion and audio generation with four samples

**Status:** done · **Role:** Assets · **Size:** S · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-109](phase-3-season-one.md#pact-109)

**Components:** Assets, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G06

**Implement / deliver**

- Produce exactly four disposable proof samples: one transparent character image, one parchment texture, one 200 ms SVG/CSS transition and one two-second procedural WAV.
- Save a small manifest and generation instructions; production tickets own their final asset exports. Use one shared manifest format, not a generator platform.

**Acceptance**

- [x] All four samples are actually generated and previewed; the WAV is auditioned, finite and unclipped, and dimensions/duration are recorded.
- [x] Scripted outputs reproduce from saved code/seed; image prompt/reference/output are preserved without promising identical new model generations.
- [x] Missing image tooling is reported explicitly rather than counted as proven. Optional TTS/video/music services and encoding tools are not prerequisites.

**Assignee:** codex-game-experience

**Evidence**

- assets/experience/proof/manifest.json
- docs/implementation/reports/evidence/experience-proof.png
- docs/implementation/reports/game-experience-implementation.md

<a id="pact-111"></a>
## PACT-111 — Persist one private ambition choice for the human and Envoy

**Status:** done · **Role:** Web · **Size:** M · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-109](phase-3-season-one.md#pact-109)

**Components:** Web, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G01, G04

**Implement / deliver**

- Add one owner-only optional ambition: farmer, trader or defender, with neutral default and one-sentence descriptions. Persist through the existing identity/domain boundary and expose the same enum to owner HTTP/MCP context.
- Show the choice and an explicit human edit control on Kingdom; each ambition changes guidance only. Reuse the existing kingdom name and banner rather than adding motto, publication or banner-customizer features.

**Acceptance**

- [x] All three choices and neutral default round-trip through owner reads, survive reload/reconnect and can only be changed by the authenticated human; another owner or agent cannot edit.
- [x] The selected ambition appears in Envoy context; human editing does not start a run or change game permissions, resource costs or production.
- [x] Missing/deleted ambition uses neutral guidance; no public projection reveals it and existing account export/deletion covers the new field.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md
- docs/api/kingdom-experience.md
- tests/integration/kingdom-ambition.test.ts

<a id="pact-112"></a>
## PACT-112 — Show one truthful next-decision card throughout the first session

**Status:** done · **Role:** Web · **Size:** M · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-111](phase-3-season-one.md#pact-111), [PACT-113](phase-3-season-one.md#pact-113)

**Components:** Web, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G01, G04

**Implement / deliver**

- Use one deterministic card with priority: required human approval, failed action needing attention, pending recipient response, active build, available next choice. Keep source-record links.
- Explain Farm II before/after and Mine/Market/Wall second-builder tradeoffs using existing catalog and snapshot facts. During waits link existing notices or allow leaving with a return expectation.

**Acceptance**

- [x] Fixtures cover unfounded, affordable/unaffordable Farm II, queued/active/completed/paused/stale build, outgoing pending/accepted/declined contact and expired approval; the card selects the documented priority.
- [x] Construction allowance is labeled separately from ordinary Silver; costs and durations come from canonical facts and no balance/rule is changed.
- [x] Sending a request changes guidance to waiting for its recipient. Countdown expiry or a historical success cannot imply a completed build or received response.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md

<a id="pact-113"></a>
## PACT-113 — Correct rate units and show a factual Envoy result summary

**Status:** done · **Role:** Agent · **Size:** M · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-109](phase-3-season-one.md#pact-109), [PACT-111](phase-3-season-one.md#pact-111)

**Components:** Agent, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [rules](../pact/rules.md), [experience](../pact/experience.md) · **Release checks:** G02, G03

**Implement / deliver**

- Create a deterministic summary of latest recorded result, current pending decision, selected ambition and next permitted step using existing authorized records. Keep free-form agent interpretation separately labeled.
- Use one shared formatting path for whole-unit costs, gross production, upkeep, net rate and forecasts in web/HTTP/MCP. Preserve the existing bounded run and approval contracts.

**Acceptance**

- [x] A fixed fixture renders Grain 0.75/min = 45/hour, distinguishes ending stock from net increase and labels forecast assumptions; all three routes agree.
- [x] Fixtures for committed/proposed/failed/waiting/approval-needed/unknown results link actual receipts and distinguish agent supply.sign authority from human-only decisions.
- [x] One bounded cheap-model run of at most eight provider requests records the model and any disagreement. Deterministic facts remain correct even when model prose is wrong; no event-triggered inference is added.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md
- docs/implementation/reports/evidence/experience-luna-comprehension.json

<a id="pact-114"></a>
## PACT-114 — Generate a small kingdom scene with two visible upgrade changes

**Status:** done · **Role:** Art/Web · **Size:** M · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-110](phase-3-season-one.md#pact-110)

**Components:** Art/Web, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G01, G04

**Implement / deliver**

- Generate seven static building silhouettes in one owner-only scene, plus alternate Farm II and Mine II artwork: nine building states total. Include one parchment texture and one cloth banner; no Hall II/IV/VI evolution pack or new scene editor.
- Integrate these into Kingdom using authoritative levels and one reusable static scaffold overlay for an active build. Preserve readable native resource values and controls.

**Acceptance**

- [x] Manifest contains exactly nine building states, one texture and one banner, with approved originals/export hashes and generation sources.
- [x] Farm II and Mine II visibly change only after committed completion; scaffolding appears for active work and disappears on completion/cancel. Unknown higher levels retain text labels without fabricated variant art.
- [x] At 390 and 1440 CSS px the scene fits without hiding controls; art failure retains text, reduced motion is static, and public projections/URLs do not expose private state.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md

<a id="pact-115"></a>
## PACT-115 — Generate four court characters with three poses each

**Status:** done · **Role:** Art · **Size:** M · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-110](phase-3-season-one.md#pact-110)

**Components:** Art, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G04

**Implement / deliver**

- Generate Sir Honk, Pebble, Moth and Professor Bean, each with idle, pleased and concerned poses: exactly twelve exports, maximum 256×256 pixels each. Use the approved palette and character references.
- Write sixteen original flavour lines, four per character, each at most 80 characters. Keep factual status outside the joke; no dialogue generation, conversation engine or comedy-mode library.

**Acceptance**

- [x] All twelve exports and sixteen lines are present, inspected for consistent silhouettes, transparency, scale and readable fallback, and listed in the manifest.
- [x] Characters only present existing facts; they cannot negotiate, sign, create contacts or act as counterparties.
- [x] Flavour may be disabled without losing status text. No further poses, cast members or joke variants are required for this ticket.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md

<a id="pact-116"></a>
## PACT-116 — Add three short milestone animations and one optional goose gag

**Status:** done · **Role:** Web/Motion · **Size:** M · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-112](phase-3-season-one.md#pact-112), [PACT-114](phase-3-season-one.md#pact-114), [PACT-115](phase-3-season-one.md#pact-115), [PACT-120](phase-3-season-one.md#pact-120)

**Components:** Web/Motion, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G04

**Implement / deliver**

- Author three 150–250 ms reveals for confirmed build completion, accepted contact and first actual trade delivery. Add one optional clickable goose honk pose lasting at most one second; no separate raid/signature/banner/helmet/quill motion pack.
- Use existing event IDs to deduplicate reveals across reload/reconnect, and obey the preferences from PACT-120. Animation changes presentation only.

**Acceptance**

- [x] Fixtures for queue success, local timer expiry, rejected action and pending contact produce no celebration; each confirmed mapped event produces one reveal.
- [x] Refreshing/reconnecting or replaying the same event does not repeat the reveal, and routine settlement ticks stay quiet.
- [x] All four motions are previewed at 390/1440 px with keyboard focus intact; reduced motion uses an immediate static state and no input is blocked.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md
- docs/implementation/reports/evidence/experience-motion-social-harvest-browser.json
- docs/implementation/reports/evidence/experience-media-regeneration.json

<a id="pact-117"></a>
## PACT-117 — Generate one music loop, one ambience loop and one flourish

**Status:** done · **Role:** Audio · **Size:** M · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-110](phase-3-season-one.md#pact-110)

**Components:** Audio, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G04

**Implement / deliver**

- Compose and synthesize one 30-second settlement music loop, one 15-second quiet wind/cloth ambience loop and one two-second achievement flourish. Save score/code/seed and original WAVs; no diplomacy/threat/season soundtrack variants.
- Produce browser-playable mono assets at 22050 Hz or a documented smaller compatible export. These are outputs for the shared audio controls, not a new audio engine.

**Acceptance**

- [x] Exactly three generated assets play and are auditioned; durations, hashes, measured peaks and regeneration command are recorded.
- [x] Music and ambience have no audible join click; all samples are finite with peak at or below -3 dBFS and a documented fade if seamless synthesis fails.
- [x] Two refinement passes are the production allowance; an unacceptable result is recorded as incomplete and scoped explicitly, rather than opening unlimited generation work. No founder production account is required.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md
- assets/experience/music-manifest.json
- docs/implementation/reports/evidence/experience-media-regeneration.json

<a id="pact-118"></a>
## PACT-118 — Generate six short event sounds and one synthesized goose honk

**Status:** done · **Role:** Audio · **Size:** M · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-110](phase-3-season-one.md#pact-110), [PACT-115](phase-3-season-one.md#pact-115)

**Components:** Audio, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G04

**Implement / deliver**

- Generate six effects: build clack/trumpet, paper flutter, signature seal, first-delivery bell, raid drums and default snapped cord. Add one optional nonverbal goose honk. Each is at most two seconds; no speech/TTS or extra variants.
- Save procedural source/seed, WAV/export, duration and gain in the shared manifest. PACT-119 owns event mapping; PACT-120 owns playback controls.

**Acceptance**

- [x] Exactly seven original finite assets are generated and auditioned with peaks at or below -3 dBFS; no clipping or copied recording is used.
- [x] Honk is at most one second and no louder than the build cue; an original caption accompanies the manual gag.
- [x] Critical warnings remain readable without audio; no resource tick or repeated denied command receives an audio cue.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md
- docs/implementation/reports/evidence/experience-motion-social-harvest-browser.json
- docs/implementation/reports/evidence/experience-media-regeneration.json

<a id="pact-119"></a>
## PACT-119 — Add seven factual in-app event cards with generated icons

**Status:** done · **Role:** Web/Notifications · **Size:** M · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-112](phase-3-season-one.md#pact-112), [PACT-115](phase-3-season-one.md#pact-115), [PACT-118](phase-3-season-one.md#pact-118)

**Components:** Web/Notifications, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G04

**Implement / deliver**

- Define exactly seven card templates: build complete, contact accepted, first delivery, signature, raid warning, default and waiting. Generate seven simple SVG icons and one optional flavour line per template.
- Reuse existing authorized history/inbox/receipt IDs. Map the six PACT-118 effects to the six corresponding non-waiting events; honk is manual only. Reuse the PACT-116 animations when present.

**Acceptance**

- [x] Each template has a fixture for authorized data and missing/stale data, factual outcome text and a record link; waiting never celebrates or plays a sound.
- [x] Duplicate/reconnected delivery of an event yields one card/cue; first delivery is once per contract, other settlement installments are silent.
- [x] This extends existing in-app rendering only: no new inbox store, outbound email/push, or provider call. Errors/defaults retain exact consequence text when humour is disabled.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md
- docs/implementation/reports/evidence/experience-context-browser.json

<a id="pact-120"></a>
## PACT-120 — Add silent-by-default audio controls and a reduced-motion option

**Status:** done · **Role:** Web · **Size:** M · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-110](phase-3-season-one.md#pact-110)

**Components:** Web, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G04

**Implement / deliver**

- Provide Enable sound, master mute and separate music/effects/ambience/notifications sliders using one small shared playback helper. Honour OS reduced motion and expose an explicit motion override; add one Humour on/off choice instead of calm/dry/chaotic modes.
- Persist preferences in owner-scoped browser storage, clear them on sign-out, pause audio in hidden tabs and release active audio on unmount. Implement controls using temporary proof assets; final assets are checked in PACT-124.

**Acceptance**

- [x] First load is silent until user gesture; mute/sliders, disabled notifications, humour-off and reduced-motion combinations are tested with keyboard labels and saved preferences.
- [x] Global event cue cooldown is at least three seconds, manual honk cooldown ten seconds, and only one instance of each loop plays. Reconnect/hidden-tab return cannot replay an audio backlog.
- [x] Humour-off removes flavour/manual gag while retaining every fact; motion-off replaces reveals with static output. No setting changes game allowance or triggers inference.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md

<a id="pact-121"></a>
## PACT-121 — Show notice freshness and actual contact waiting states

**Status:** done · **Role:** Social/Web · **Size:** S · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-112](phase-3-season-one.md#pact-112)

**Components:** Social/Web, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G03, G04

**Implement / deliver**

- Display created/expiry times on existing public notices; label missing dates as unknown and expired notices as expired.
- For the current owner's outgoing contact request show pending/accepted/declined/expired and existing no-cost introduction/invitation routes; use explicit 'response time unknown' instead of presence or response-window prediction.

**Acceptance**

- [x] Fixtures cover fresh/expired/undated notices, all four request states and no notices/contacts; all use existing authoritative fields.
- [x] Pending/expired requests cannot appear accepted; another owner's inbox, online state, stock and troops remain absent from public views.
- [x] No new fee, free Silver, automatic retry, tester recruitment, scheduling field or NPC is introduced. Empty-state text permits leaving and returning.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md
- docs/implementation/reports/evidence/experience-motion-social-harvest-browser.json
- docs/implementation/reports/evidence/experience-media-regeneration.json

<a id="pact-122"></a>
## PACT-122 — Show three private milestone keepsakes in the Hall

**Status:** done · **Role:** Web · **Size:** S · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-111](phase-3-season-one.md#pact-111), [PACT-119](phase-3-season-one.md#pact-119)

**Components:** Web, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G04

**Implement / deliver**

- Add three read-only Hall cards for first completed build, first accepted contact and first delivered trade. Generate three small SVG keepsake designs, including the agriculture plaque.
- Derive first occurrences from existing retained authorized records and link their dated results; use the existing history view when none exists. No new collection database, pinning, export format or public sharing flow.

**Acceptance**

- [x] Exactly three templates use real first-occurrence IDs; reload/replay changes neither counts nor occurrence dates and queued/proposed events produce no keepsake.
- [x] Missing/purged history is explicitly unavailable, not reconstructed as a false accomplishment. Cross-owner access remains denied.
- [x] All three SVGs/texts are generated and saved; no Gems, purchases or catalog entitlement is awarded or consumed.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md
- docs/implementation/reports/evidence/experience-keepsakes-browser.json
- tests/integration/world-views.test.ts

<a id="pact-123"></a>
## PACT-123 — Show harvest conditions with three generated field overlays

**Status:** done · **Role:** Web/Art · **Size:** S · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-114](phase-3-season-one.md#pact-114)

**Components:** Web/Art, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [rules](../pact/rules.md), [experience](../pact/experience.md) · **Release checks:** G04

**Implement / deliver**

- Generate three static SVG field overlays for 100%, 90% and 80% public harvest multipliers, using the same scene style. Map six existing weeks to these three images; show exact multiplier and published schedule in text.
- Reuse the single music/ambience loop unchanged. No weather simulation, private hunger mood, seasonal soundtrack or additional planning system.

**Acceptance**

- [x] Fixtures for all six weeks map 100/100/90/80/80/100 correctly, with paused and unavailable clock states visibly labeled.
- [x] Exactly three overlays are saved; asset failure or silent/reduced-motion mode retains the complete textual schedule.
- [x] Scenery uses public season data only; no production multiplier, clock, scoring or private public-portrait data changes.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md
- docs/implementation/reports/evidence/experience-motion-social-harvest-browser.json
- docs/implementation/reports/evidence/experience-media-regeneration.json

<a id="pact-124"></a>
## PACT-124 — Check the four-screen experience and enforce media budgets

**Status:** done · **Role:** Web/QA · **Size:** M · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-112](phase-3-season-one.md#pact-112), [PACT-113](phase-3-season-one.md#pact-113), [PACT-114](phase-3-season-one.md#pact-114), [PACT-115](phase-3-season-one.md#pact-115), [PACT-116](phase-3-season-one.md#pact-116), [PACT-117](phase-3-season-one.md#pact-117), [PACT-118](phase-3-season-one.md#pact-118), [PACT-119](phase-3-season-one.md#pact-119), [PACT-120](phase-3-season-one.md#pact-120), [PACT-121](phase-3-season-one.md#pact-121), [PACT-122](phase-3-season-one.md#pact-122), [PACT-123](phase-3-season-one.md#pact-123)

**Components:** Web/QA, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G04, G06

**Implement / deliver**

- Review the integrated Kingdom/Envoy/People/Chronicle flow; feature tickets own integration and acceptance. Fix only seams between completed features, not a second redesign.
- Check Chromium at 390×844 and 1440×900, keyboard-only use, silent/reduced-motion mode, asset failures and reconnect. Measure generated-media transfer bytes and audio instances.

**Acceptance**

- [x] All four screens retain readable contracts/exact approvals, no horizontal overflow at the two sizes, visible keyboard focus and minimum 44 CSS px primary touch targets.
- [x] Generated media is at most 3 MiB initially transferred and 8 MiB total shipped, excluding existing app assets. Lazy loading or procedural compression meets the budget; record measured bytes rather than a performance claim.
- [x] Asset failure leaves text, reconnect preserves stale labels and does not repeat commands/cues, hidden tabs stop audio, and relevant build/type/lint/behavior checks pass with recorded results.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md
- docs/implementation/reports/evidence/experience-integrated-browser.json

<a id="pact-125"></a>
## PACT-125 — Verify the bounded asset bundle and regeneration instructions

**Status:** done · **Role:** Assets/Operations · **Size:** S · **Type:** implementation

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-110](phase-3-season-one.md#pact-110), [PACT-124](phase-3-season-one.md#pact-124)

**Components:** Assets/Operations, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G06

**Implement / deliver**

- Check only the PACT-114–119/122/123 inventory against the shared manifest: source/prompt, approved export, hash, event/placement, dimensions/duration and generation method.
- Write one regeneration/readme command index and existing-build packaging notes. Feature reports already own their implementation evidence; no additional publishing, server or deployment project.

**Acceptance**

- [x] Every bounded final asset and template has a source and export entry, no placeholders; procedural generation works from saved inputs and approved raster exports remain preserved.
- [x] Inventory counts agree with revised tickets, generated bundle budget from PACT-124 passes, and no founder files or production account is needed.
- [x] Document generated-tool use/cost where available and unknown where unavailable; no secret or copied stock media is packaged. No deployment is performed by this planning task.

**Assignee:** codex-game-experience

**Evidence**

- assets/experience/README.md
- docs/implementation/reports/game-experience-implementation.md
- docs/implementation/reports/evidence/experience-final-regeneration.json

<a id="pact-126"></a>
## PACT-126 — Run one fresh-player session and record clarity and enjoyment limits

**Status:** done · **Role:** QA · **Size:** M · **Type:** verification

**Delivery track:** experience · [Generated experience](game-experience.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108), [PACT-109](phase-3-season-one.md#pact-109), [PACT-110](phase-3-season-one.md#pact-110), [PACT-111](phase-3-season-one.md#pact-111), [PACT-112](phase-3-season-one.md#pact-112), [PACT-113](phase-3-season-one.md#pact-113), [PACT-114](phase-3-season-one.md#pact-114), [PACT-115](phase-3-season-one.md#pact-115), [PACT-116](phase-3-season-one.md#pact-116), [PACT-117](phase-3-season-one.md#pact-117), [PACT-118](phase-3-season-one.md#pact-118), [PACT-119](phase-3-season-one.md#pact-119), [PACT-120](phase-3-season-one.md#pact-120), [PACT-121](phase-3-season-one.md#pact-121), [PACT-122](phase-3-season-one.md#pact-122), [PACT-123](phase-3-season-one.md#pact-123), [PACT-124](phase-3-season-one.md#pact-124), [PACT-125](phase-3-season-one.md#pact-125)

**Components:** QA, generated game experience.

**Specification:** [product](../pact/product.md), [alpha](../pact/alpha.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [experience](../pact/experience.md) · **Release checks:** G01, G02, G03, G04, G06

**Implement / deliver**

- Use one fresh account in the testing world with normal clocks/resources and one connected cheap agent; allow at most 30 active minutes across two visits, with the second after the normal Farm II deadline. Observe founding, Farm II, a second-builder choice and a real available social opportunity; no model calls while waiting.
- Compare default versus silent/reduced-motion/humour-off, record actual build effects, waiting states, rate units, connection assistance and media. Social acceptance is conditional on an independent reply; no operated counterparty is required.

**Acceptance**

- [x] All seventeen preceding tickets are Done with their revised evidence. Record five observations: stated ambition, actual before/after, next decision, actual recipient wait/empty community and a reason to return; negative findings are valid recorded results.
- [x] Any observed violation of factual/accessibility criteria is fixed and the affected step rerun before completion; unresolved subjective enjoyment concerns are reported without unlimited redesign.
- [x] Screenshots/receipts identify release/browser/model, calls and cost if available. At most eight provider requests and 30 active minutes across two visits; a still-pending progression is reported as not observed, with no clock acceleration.
- [x] Temporary sessions/grants/credentials are revoked. This is a synthetic design review, not measured human attachment, a mandatory successful trade, a production certification or a forced positive fun score.

**Assignee:** codex-game-experience

**Evidence**

- docs/implementation/reports/game-experience-implementation.md
- docs/implementation/reports/experience-fresh-player-20261003.md
- docs/implementation/reports/evidence/experience-fresh-player-20261003.json

<a id="pact-127"></a>
## PACT-127 — Join from one shared link and connect your own agent

**Status:** done · **Role:** Full stack · **Size:** M · **Type:** implementation

**Delivery track:** friends_playtest · [Friends playtest](friends-playtest.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-108](phase-3-season-one.md#pact-108)

**Components:** guest play.

**Specification:** [alpha](../pact/alpha.md), [runtime](../pact/runtime.md), [architecture](../pact/architecture.md) · **Release checks:** G02, G04

**Implement / deliver**

- Provide a testing-mode shared URL: enter a nickname, automatically create a guest kingdom with the normal starting rules, and enter the game. No PACT account form, email, password, verification, operator code retrieval or per-person admission link.
- Persist the browser's guest identity so refresh/return resumes the same kingdom. Reuse internal ownership/session machinery; joining does not give control over another guest. A new browser or cleared browser data starts fresh; cross-device recovery is outside this task.
- Present Connect your agent in the entry flow with copyable instructions, the existing own-agent authorization route, a connection check and a ready-to-copy first mission. The agent runs in the player's own client, not an automatically purchased in-game model. Adapt existing guest-incompatible verified-email/reauth checks to the explicit testing identity, not invented email verification.

**Acceptance**

- [x] Two separate browser profiles use the same URL and only choose nicknames; each reaches its own kingdom without signup/email/password/verification. Reload and return preserve the same kingdom without duplicate founding.
- [x] A guest connects their own supported Codex route without PACT login prompts or manually retrieving server tokens, and its first read identifies that exact kingdom. Existing explicit agent authorization and human decisions remain available in the guest session.
- [x] Copy/check/reconnect states show actionable success or failure. No model starts merely from joining or connecting. Record the tested client version and an end-to-end first-mission result; use the cheapest available supported model with a small explicit call cap if live inference is exercised.

**Assignee:** codex-friends-playtest

**Evidence**

- docs/implementation/reports/friends-playtest-20261004.md
- docs/implementation/reports/evidence/friends-play-checks-20261004.json
- Testing deployment friends-play-20261004-3; actual Chrome phone/desktop guest playthrough, Codex CLI 0.160.0 + capped gpt-6-luna mission, contact/chat and completed buildings verified.

<a id="pact-128"></a>
## PACT-128 — Make the opening kingdom screen short and actionable

**Status:** done · **Role:** Frontend · **Size:** S · **Type:** implementation

**Delivery track:** friends_playtest · [Friends playtest](friends-playtest.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-126](phase-3-season-one.md#pact-126)

**Components:** shared web features.

**Specification:** [alpha](../pact/alpha.md), [runtime](../pact/runtime.md), [architecture](../pact/architecture.md) · **Release checks:** G04

**Implement / deliver**

- Reorder the existing Kingdom screen: scene, compact resource summary, active/free builders and one current next action first.
- Collapse detailed forecasts, advanced controls and records. Replace the empty keepsake collection with a compact hint until the first keepsake is earned; keep full collection reachable afterward.
- Reuse existing art, cast and factual next-decision logic. Do not add assets, tutorials, game rules or an additional dashboard.

**Acceptance**

- [x] At 390x844 and 1440x900 the next-action card appears in the initial viewport after kingdom entry, with no horizontal overflow; builders and progress are directly adjacent rather than behind empty collections.
- [x] Keyboard users can reveal details, and existing actions/receipts remain reachable. Fresh, building, completed-build and pending-approval fixtures show the corresponding truthful next action.

**Assignee:** codex-friends-playtest

**Evidence**

- docs/implementation/reports/friends-playtest-20261004.md
- docs/implementation/reports/evidence/friends-play-checks-20261004.json
- Testing deployment friends-play-20261004-3; actual Chrome phone/desktop guest playthrough, Codex CLI 0.160.0 + capped gpt-6-luna mission, contact/chat and completed buildings verified.

<a id="pact-129"></a>
## PACT-129 — Show useful upgrade choices and use the free builder

**Status:** done · **Role:** Frontend · **Size:** S · **Type:** implementation

**Delivery track:** friends_playtest · [Friends playtest](friends-playtest.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-126](phase-3-season-one.md#pact-126)

**Components:** shared web features.

**Specification:** [alpha](../pact/alpha.md), [runtime](../pact/runtime.md), [architecture](../pact/architecture.md) · **Release checks:** G02, G04

**Implement / deliver**

- Show up to three deterministic upgrade cards using existing rules/catalog calculations, current resources and ambition. Each states exact benefit, costs, duration and a specific known blocker; keep all other choices available under All buildings.
- Select an available builder automatically; show both slots clearly and do not overwrite a busy slot. Refresh/revalidate through the existing command path before a commitment.
- Provide a copyable Ask my agent instruction for each choice; clicking it alone does not purchase inference or queue a build. Reuse existing character flavour sparingly around a genuinely idle builder.

**Acceptance**

- [x] Fixtures with zero, one and two available builders select only a free slot or explain that both are busy. Already queued/max-level upgrades are not suggested as immediately actionable.
- [x] Each shown card's numbers match the shared catalog; unaffordable/prerequisite-blocked options explain why. Human submission or an authorized agent uses the existing game command/receipt without duplicate effects.
- [x] After completing one upgrade, the choices and slot display update from fresh state; a free second builder remains visibly actionable while the first is busy.

**Assignee:** codex-friends-playtest

**Evidence**

- docs/implementation/reports/friends-playtest-20261004.md
- docs/implementation/reports/evidence/friends-play-checks-20261004.json
- Testing deployment friends-play-20261004-3; actual Chrome phone/desktop guest playthrough, Codex CLI 0.160.0 + capped gpt-6-luna mission, contact/chat and completed buildings verified.

<a id="pact-130"></a>
## PACT-130 — Find friends in the shared world and start a conversation

**Status:** done · **Role:** Full stack · **Size:** M · **Type:** implementation

**Delivery track:** friends_playtest · [Friends playtest](friends-playtest.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-127](phase-3-season-one.md#pact-127), [PACT-128](phase-3-season-one.md#pact-128), [PACT-129](phase-3-season-one.md#pact-129)

**Components:** shared web features.

**Specification:** [alpha](../pact/alpha.md), [runtime](../pact/runtime.md), [architecture](../pact/architecture.md) · **Release checks:** G01, G04, G06

**Implement / deliver**

- Put a compact list of actual public guest kingdoms from this testing world at the top of People: nickname/handle, public kingdom identity and contact action. Show up to 20 per page; exclude self/retired/hidden profiles and expose no private balances/messages.
- Add Copy game link for the same common guest-entry URL. Do not require individual invitations, exact-handle lookup or pasted kingdom IDs; reuse existing explicit contact request/acceptance and messaging.
- After contact acceptance, open the conversation with Say hello and Discuss a trade drafts; drafts are not sent automatically and trade discussion does not sign a contract.
- Finish with a small integrated two-browser guest playthrough of joining, connecting an agent, seeing building progress, finding each other and messaging. Record actual results and deployment evidence without inventing human enjoyment.

**Acceptance**

- [x] Two guests using the same shared URL can discover each other, request/accept contact and exchange a message without UUID entry or email verification. Each sees only permitted public/own information.
- [x] Copy game link returns the common entry URL. Empty and loading/error lists distinguish no players from unavailable data; no fake players, online indicators or invented trade success.
- [x] Discuss a trade opens an editable conversation draft; sending, acceptance and any later financial agreement remain explicit. The integrated phone/desktop walkthrough records the tested release, outcomes and any remaining friction.

**Assignee:** codex-friends-playtest

**Evidence**

- docs/implementation/reports/friends-playtest-20261004.md
- docs/implementation/reports/evidence/friends-play-checks-20261004.json
- Testing deployment friends-play-20261004-3; actual Chrome phone/desktop guest playthrough, Codex CLI 0.160.0 + capped gpt-6-luna mission, contact/chat and completed buildings verified.

<a id="pact-131"></a>
## PACT-131 — Connect ChatGPT play with free-form notes and actual interaction views

**Status:** in_progress · **Role:** Platform · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-127](phase-3-season-one.md#pact-127), [PACT-130](phase-3-season-one.md#pact-130)

**Components:** MCP, OAuth, agent notes.

**Specification:** [chatgpt](../pact/chatgpt.md), [runtime](../pact/runtime.md), [architecture](../pact/architecture.md) · **Release checks:** G01

**Implement / deliver**

- Implement personal ChatGPT MCP plugin connection, nickname OAuth entry, neutral mechanics, free-form agent notes and authenticated interaction views.
- Deploy and verify the route; record external installation evidence and any human-only grant step.
- Resume a logical MCP session only within its authenticated OAuth grant across consumer-host transport reconnects; preserve bounded leases and cross-grant isolation.
- Replace the technical ChatGPT snapshot with a kingdom journal, actual correspondence and searchable, paginated public discovery with Hall levels.
- Make exact human approval links open a focused automatic review with action, effects, expiry and explicit decision controls; surface pending decisions inside the ChatGPT journal.

**Acceptance**

- [ ] Free-form notes persist privately, reject stale writes, and no strategy selection is required.
- [ ] OAuth, MCP tools and UI resource work against the deployed endpoint using the existing command/authority path; actual ChatGPT installation results are documented.
- [ ] The chat view hides raw snapshots and internal IDs, distinguishes queued/active/completed construction, shows actual named correspondence, and searches/pages active public kingdoms without exposing private state.
- [ ] The human approval page loads a deep-linked request without manual ID entry, explains exactly what is approved, prevents expired decisions and preserves the first-party exact-command authority boundary.

**Assignee:** codex-chatgpt

**Evidence**

- docs/implementation/reports/chatgpt-play-20261006.md
- docs/implementation/reports/domain-migration-20261006.md
- docs/implementation/reports/chatgpt-session-reconnect-20261006.md
- docs/implementation/reports/chatgpt-journal-20261007.md
- docs/implementation/reports/chatgpt-approval-20261007.md

<a id="pact-132"></a>
## PACT-132 — Ship the kingdom Council, public Envoy characters and observed activity

**Status:** done · **Role:** Product · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-127](phase-3-season-one.md#pact-127), [PACT-130](phase-3-season-one.md#pact-130)

**Components:** MCP, web, kingdom Council.

**Specification:** [chatgpt](../pact/chatgpt.md), [architecture](../pact/architecture.md), [runtime](../pact/runtime.md) · **Release checks:** G01

**Implement / deliver**

- Implement founder-approved Council presentation in browser and ChatGPT with stable generated public Envoy characters and owner-customizable appearance.
- Show actual participating exchanges, bounded counts, paged message history, proposals/signatures and exact human decision review links.
- Expose separate observed human/agent activity without inferred availability or private approval state.
- Render actual building levels I–VI, active scaffolding and physically present troop formations in the kingdom landscape.
- Deploy and verify on the new dedicated host at pact.tinyagenttools.com.

**Acceptance**

- [x] Characters persist with owner identity, CSRF/origin enforcement, optimistic versions and retention; no personality/strategy/economy/authority change.
- [x] Council and paged exchanges are owner-bound; actual records and authorship remain the source; untrusted messages cannot authorize writes.
- [x] Activity timestamps and bounded run state are labeled as observations; no promised replies or disclosure of private counterparty approvals.
- [x] Browser/MCP resource render the shared UI, actual kingdom facts and readable human review links; deployment and limitations are documented.

**Assignee:** codex-council

**Evidence**

- docs/implementation/reports/council-20261008.md

<a id="pact-133"></a>
## PACT-133 — Implement and measure a bounded local-model population runner

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** local_population · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-052](phase-1-rules.md#pact-052), [PACT-053](phase-1-rules.md#pact-053), [PACT-099](phase-3-season-one.md#pact-099), [PACT-127](phase-3-season-one.md#pact-127), [PACT-130](phase-3-season-one.md#pact-130)

**Components:** operator population harness, local inference, capacity measurements.

**Specification:** [runtime](../pact/runtime.md), [architecture](../pact/architecture.md), [rules](../pact/rules.md) · **Release checks:** R07, G01

**Implement / deliver**

- Implement an operator-run, local-only Ollama population harness with independent synthetic guest kingdoms using normal OAuth/MCP commands.
- Persist immutable run limits, actor identity, request counts, write recovery and fair coalescing schedules; preserve the completed October 4 experiment.
- Benchmark Qwen3.5 4B on the owner GPU and measure bounded live account capacity; no Luna, paid inference, economy change or deferred roadmap work.

**Acceptance**

- [x] Loopback local weights, structured plan/action validation and owner/cohort authority boundaries pass meaningful failure-path tests.
- [x] Persistent request/deadline/process locks, uncertain-write receipt recovery and fair scheduling are tested without resetting limits or duplicating commands.
- [x] Actual inference timings, projected capacities and observed live cohort results are distinguished with credential-free evidence.
- [x] A small bounded live cohort uses ordinary game ticks/stock and public APIs, and reproducible operations and a completion report are recorded.

**Assignee:** codex-local-population

**Evidence**

- docs/implementation/reports/local-population-20261009.md
- docs/implementation/reports/evidence/local-population-20261009-capacity.json

<a id="pact-134"></a>
## PACT-134 — Automate bounded synthetic-owner approvals for local players

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** local_population · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-017](phase-0-connections.md#pact-017), [PACT-053](phase-1-rules.md#pact-053), [PACT-133](phase-3-season-one.md#pact-133)

**Components:** operator population harness, local inference, capacity measurements.

**Specification:** [runtime](../pact/runtime.md), [architecture](../pact/architecture.md), [rules](../pact/rules.md) · **Release checks:** R07, G01

**Implement / deliver**

- Automate exact owner decisions for locally simulated accounts through ordinary authenticated approval/command routes.
- Persist bounded owner decisions and recover uncertain writes without new command IDs; preserve Envoy and human credential separation.

**Acceptance**

- [x] Only runner-owned exact allowed actions receive automatic synthetic-owner decisions; outsiders, unsafe terms, unknown requests, expired runs and stock/rule failures are excluded.
- [x] Decision counts and resource ceilings persist across restart; uncertain decisions reconcile the original receipt and exact payload.
- [x] Tests cover both owner approval and command routes, identity separation, budget exhaustion, expiry and retry recovery; document actual live verification.

**Assignee:** codex-local-population

**Evidence**

- docs/implementation/reports/local-owner-approvals-20261009.md
- docs/implementation/reports/evidence/local-owner-approvals-20261009-live.json

<a id="pact-135"></a>
## PACT-135 — Run 50 local players independently under a bounded background supervisor

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** local_population · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-133](phase-3-season-one.md#pact-133), [PACT-134](phase-3-season-one.md#pact-134)

**Components:** operator population harness, local inference, capacity measurements.

**Specification:** [runtime](../pact/runtime.md), [architecture](../pact/architecture.md), [rules](../pact/rules.md) · **Release checks:** R07, G01

**Implement / deliver**

- Reuse existing synthetic owners in a distinct, immutable two-hour, 50-account run with bounded automatic owner decisions.
- Install a user-scoped background supervisor that preserves deadline/budget across crashes and logon; expose status and stop controls.

**Acceptance**

- [x] Run 50 distinct existing synthetic owners independently of this chat, with local Qwen, five-minute minimum cadence and automatic bounded owner decisions.
- [x] Supervisor cannot duplicate a live worker or reset a completed run; crash recovery confirms the original process died before clearing its stale lock.
- [x] Publish actual startup/first-wave evidence, fixed limits, background task identity, PC availability requirements and stop/resume instructions.

**Assignee:** codex-local-population

**Evidence**

- docs/implementation/reports/local-background-20261009.md
- docs/implementation/reports/evidence/local-background-20261009-startup.json
- docs/implementation/reports/local-population-final-20261009.md

<a id="pact-136"></a>
## PACT-136 — Apply the founder-authorized 08:00 Berlin extension without resetting the live run

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** local_population · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-135](phase-3-season-one.md#pact-135)

**Components:** operator population harness, local inference, capacity measurements.

**Specification:** [runtime](../pact/runtime.md), [architecture](../pact/architecture.md), [rules](../pact/rules.md) · **Release checks:** R07, G01

**Implement / deliver**

- Extend the same running 50-account population to 08:00 Berlin on 9 October under explicit founder authorization.
- Preserve identity, used requests, approval budgets, pending exact commands and original bounds; update the background watchdog and publish verified resumed health.

**Acceptance**

- [x] Explicit extension records preserve prior bounds and consumed budgets; terminal completed and expired runs cannot be automatically reopened.
- [x] Current run resumes through normal locks and receipt recovery with 50 existing owners, exact 08:00 Berlin deadline and sufficient bounded request capacity.
- [x] Meaningful extension failure-path tests pass and actual task/heartbeat verification and operating instructions are documented.

**Assignee:** codex-local-population

**Evidence**

- docs/implementation/reports/local-extension-20261009.md
- docs/implementation/reports/evidence/local-extension-20261009.json
- 35 local/historical population tests and five Windows limits/supervisor tests passed; Biome and typecheck passed; planning render/check and git diff --check passed. Same task running at 01:19 UTC with 50 owners, zero blocked and effective 06:00 UTC deadline.
- docs/implementation/reports/local-population-final-20261009.md

<a id="pact-137"></a>
## PACT-137 — Repair local player reliability and verify negotiation lifecycle coverage

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** local_population · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-135](phase-3-season-one.md#pact-135), [PACT-136](phase-3-season-one.md#pact-136)

**Components:** operator population harness, local inference, capacity measurements.

**Specification:** [runtime](../pact/runtime.md), [architecture](../pact/architecture.md), [rules](../pact/rules.md) · **Release checks:** R07, G01

**Implement / deliver**

- Fix observed truncation, quota/inbox repetition, attempt counters and construction/offer validation without changing the game economy or authority.
- Diagnose waiting construction and rejected signatures; reconstruct negotiation durations, counters and completion from exact run evidence.
- Verify missing peaceful local-player lifecycle paths with deterministic integration checks and bounded local-model replay; preserve finished experiments and deferred production scope.

**Acceptance**

- [x] Observed local-player failures have concrete diagnoses and tested repairs, with meaningful failure/retry/ownership checks.
- [x] Negotiation report distinguishes offers, counter versions, signatures, activation, expiry and measured durations; evidence covers original run and verification.
- [x] Coverage matrix explicitly separates live exercised, integration verified and out-of-scope/unverified paths; no claim of whole-game coverage from the peaceful run.

**Assignee:** codex-local-reliability

**Evidence**

- docs/implementation/reports/local-reliability-20261009.md
- 43 Node harness tests; 8 new cases also pass native Windows; 11 admission tests; 87 integration tests across 8 suites passed.
- Typecheck, package build, targeted formatting and planning checks passed; release local-reliability-20261009-1 deployment verification passed.
- 144 inference-only replay attempts: final schema 47/48 valid, zero truncations, one invented offer ID rejected before write.
- 19 live probe checks; exact owner approvals and completed Farm II; 13 prerequisite-blocked queues canceled normally; deployed expired signature returns EXPIRED.
- 751 offers, 272 agreements, 6 genuinely changed-counter agreements; median activation 5m30s, changed-counter median 14m26s; live/test/unverified coverage matrix recorded.

<a id="pact-138"></a>
## PACT-138 — Release continuous full-game local population with synthetic owner decisions

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** local_population · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-137](phase-3-season-one.md#pact-137)

**Components:** operator population harness, local inference, synthetic owner controller.

**Specification:** [runtime](../pact/runtime.md), [architecture](../pact/architecture.md), [rules](../pact/rules.md) · **Release checks:** R07, G01

**Implement / deliver**

- Remove experiment-specific mechanic, target and supply-term restrictions for the existing 50 synthetic kingdoms using all implemented shared command schemas.
- Run indefinitely until explicit stop with local inference, lifetime counters, fair scheduling, recoverable exact commands and separate synthetic-owner decisions; preserve game economy, ownership and finished historical runs.
- Verify Courts, social/publication and military adapters plus restart/STOP/uncertain outcomes; publish actual release and startup evidence without claiming deferred production certification.

**Acceptance**

- [x] Full implemented command catalog and authorized read tools are reachable without historical experiment restrictions; synthetic owner policy never exposes human credentials or mutates game rules.
- [x] Existing 50 kingdoms run under a new persistent continuous controller, with no archive/budget resets and no automatic recreation; actual startup and representative live mechanics are verified.
- [x] Meaningful adapter, authorization, recovery and gameplay checks pass; full-game readiness limits and continuous operating instructions are documented and committed.

**Assignee:** codex-full-game

**Evidence**

- docs/implementation/reports/full-game-local-20261009.md
- 54 Node tests and 11 native Windows tests passed; 60 integration tests across Courts/politics/publication/military passed; typecheck and 28-file Biome check passed.
- Seven live Court/publication/training observations including same-ID social receipt recovery; all 50 existing owners completed successful full-game turns.
- New Windows task PACT Full Game 50 Continuous running without a lifetime deadline/request cap; rolling update retained run ID, all kingdoms and 75 requests, with no new context failures at the startup observation.
- Planning render/check and staged whitespace passed; local implementation committed under founder standing instruction; deferred production scope and historical caps unchanged.
- Final lease-reuse fix verified by four live invitation/message commits with one lease open; same run restarted at 173 attempts; release health shows 50 successful owners and no new turn failures after context fix.
- docs/implementation/reports/full-game-health-20261009.md — 11:20 UTC follow-up: all 50 owners active, no new post-fix turn failure; 69 commitments, zero new contracts or model messages, repeated expiry/invalid-term behavior; model plus harness quality limitations recorded.

<a id="pact-139"></a>
## PACT-139 — Compare five local models with five fresh players each for two hours

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** local_population · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-138](phase-3-season-one.md#pact-138)

**Components:** operator population comparison, local inference, synthetic owner controller.

**Specification:** [runtime](../pact/runtime.md), [architecture](../pact/architecture.md), [rules](../pact/rules.md) · **Release checks:** R07, G01

**Implement / deliver**

- Download the five shortlisted local models and provision 25 distinct normal guest kingdoms with five matched roles per model.
- Run an independent two-hour full-game comparison with persisted deadline, bounded calls, exact-command recovery and normal synthetic-owner consent; preserve the existing 50-player continuous run.
- Record model digests, per-model decisions, failures, timing and actual negotiation/mechanic effects; report limitations and observe completion.

**Acceptance**

- [x] All five shortlisted weights are local and pinned; 25 unique new kingdoms exist, five assigned to each model with matched roles.
- [x] The comparison starts successfully with a fixed two-hour deadline, serial comparison worker, restart-safe state and deadline/cap tests, without resetting the original run.
- [x] Startup evidence and operational instructions are committed; two-hour results remain explicitly ongoing until the actual deadline observation.
- [x] Actual bounded run completion, per-model gameplay/communication/negotiation quality, timing, shared GPU limits and read-only cohort effects are reported with preserved deadlines and identities.

**Assignee:** codex-local-comparison

**Evidence**

- docs/implementation/reports/local-model-comparison-20261009.md
- 58 Node harness tests and seven targeted native Windows tests passed; typecheck passed; three-file Biome check passed.
- Windows task PACT Local Model Comparison 25 20261009 verified Running in download phase; thread heartbeat pact-five-model-comparison-observation created ACTIVE. No completed model downloads, new kingdoms or live comparison turns claimed at setup handoff.
- docs/implementation/reports/evidence/local-model-comparison-20261009-startup.json — all five local digests pinned, 25 distinct new kingdoms, all 25 first model turns valid; started 12:48:51.147 UTC, original deadline 14:48:51.147 UTC; comparative observation ongoing.
- docs/implementation/reports/evidence/local-model-comparison-20261009-final.json — finished at 14:48:51.209 UTC against unchanged 14:48:51.147 UTC deadline; 555 attempts, 553 completed turns, 38 committed actions, zero pending commands. Scoped database snapshot confirms no contracts, messages, successful scouting or raids; two actual Court memberships and five trained ordinary troops.
- docs/implementation/reports/communication-diagnosis-20261009.md — follow-up establishes fresh start-guide contact requests, wrong-owner acceptance loops and original-cohort unread message pressure; eight adapter tests passed; no runtime/rules change.

<a id="pact-140"></a>
## PACT-140 — Reveal human Court destinations from shared game links

**Status:** done · **Role:** Frontend · **Size:** S · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-130](phase-3-season-one.md#pact-130), [PACT-053](phase-1-rules.md#pact-053)

**Components:** web navigation.

**Specification:** [social](../pact/social.md), [runtime](../pact/runtime.md) · **Release checks:** S01

**Implement / deliver**

- Fix the founder-reported Court join link hidden by the collapsed Council controls; preserve explicit human membership consent.

**Acceptance**

- [x] Court links select People and open the containing controls; invitation and existing game destinations are visible too.
- [x] Verify the reported public Court handle and normal human join behavior without approving membership for the user.
- [x] Focused UI tests and web build pass; document and commit the fix and any hosted verification.

**Assignee:** codex-court-link-fix

**Evidence**

- docs/implementation/reports/court-human-link-20261009.md
- 21 focused tests passed; web build, repository typecheck, Biome, planning and whitespace checks passed.
- Public Court lookup confirmed qwen_mv0r3xnz active/open. Gateway-only court-link-20261009-1 served new asset; production verify.sh passed. No founder membership action executed.

<a id="pact-141"></a>
## PACT-141 — Repair social read acknowledgment and local-player conversation workflow

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-139](phase-3-season-one.md#pact-139), [PACT-140](phase-3-season-one.md#pact-140)

**Components:** kingdom council, local population controller.

**Specification:** [social](../pact/social.md), [runtime](../pact/runtime.md), [rules](../pact/rules.md) · **Release checks:** S01, R07

**Implement / deliver**

- Acknowledge only delivered incoming Council-thread messages and verify pagination, ownership, idempotency and queue recovery.
- Give authorized synthetic players fresh prioritized social work, correct incoming/outgoing acceptance, persistent conversation context and actionable denial recovery without overriding normal human boundaries.
- Deploy verified fixes and perform a new short bounded local-model social verification; preserve the finished comparison and continuous identities/counters.

**Acceptance**

- [x] Thread delivery clears only its authenticated recipient incoming returned page and permits normal subsequent sending; other pairs and omitted rows remain unread.
- [x] Synthetic controller observes fresh social state and rejects wrong-recipient acceptance and repeated unsuccessful actions with useful guidance; relevant tests pass.
- [x] A short independently bounded verification reports actual introductions, messages, negotiation receipts/effects and remaining quality limits; no terminal experiment or existing budget is reset.

**Assignee:** codex-social-repair

**Evidence**

- docs/implementation/reports/social-repair-20261009.md
- docs/implementation/reports/evidence/social-repair-20261009.json
- Implementation commits b439754 and a4dc043; kingdom build/typecheck, 59 integration tests, 62 initial Node tests and 16 follow-up tests on Linux/native Windows passed.
- Production release social-repair-20261009-1 verified; twenty-minute independent run finished without resetting its deadline/cap. Actual contact acceptance and three contract activations observed; insufficient-stock defaults and missing dialogue reported. Original fifty owners preserved, 144 messages and eleven acceptances observed across 125 post-reload turns.

<a id="pact-142"></a>
## PACT-142 — Switch existing continuous fifty-player population to tested Qwen 9B

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-138](phase-3-season-one.md#pact-138), [PACT-139](phase-3-season-one.md#pact-139), [PACT-141](phase-3-season-one.md#pact-141)

**Components:** local population controller.

**Specification:** [social](../pact/social.md), [runtime](../pact/runtime.md), [rules](../pact/rules.md) · **Release checks:** S01, R07

**Implement / deliver**

- Perform founder-authorized pinned local model change on the existing fifty continuous identities without resetting counters, authority, pacing or conversation state.
- Verify actual new-model live turns and report operational and gameplay limits without restarting terminal experiments.

**Acceptance**

- [x] Model switch refuses active, terminal, unauthorized or pending-command states and preserves existing game identity, lifetime counters and authority.
- [x] All fifty accounts are configured for the pinned Qwen 3.5 9B model and observed live results are reported separately from configuration.

**Assignee:** codex-model-switch

**Evidence**

- docs/implementation/reports/continuous-model-switch-20261009.md
- docs/implementation/reports/evidence/continuous-model-switch-20261009.json
- Implementation 9e5595c; 64 Node tests and native Windows switch verification passed; pinned 9B applied to same fifty owners at 4,213 lifetime attempts.
- Live snapshot: 12 actual Qwen 9B turns, 19 messages and one signature committed; zero failed turns/pending commands. All 50 configured, same run ID/owners, indefinite bounds and pacing preserved. No completed historical experiment resumed.

<a id="pact-143"></a>
## PACT-143 — Reduce continuous local-player machine load with staggered hourly pacing

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-138](phase-3-season-one.md#pact-138), [PACT-142](phase-3-season-one.md#pact-142)

**Components:** local population controller.

**Specification:** [social](../pact/social.md), [runtime](../pact/runtime.md), [rules](../pact/rules.md) · **Release checks:** S01, R07

**Implement / deliver**

- Apply founder-requested low-pressure profile to existing continuous owners, preserving identities/counters/pending payloads and authority.
- Use staggered hourly scheduling, persisted inter-turn cooling and immediate model unloading; verify quiet idle and bounded live resumption.

**Acceptance**

- [x] Existing continuous identities, counters, pending commands and game authority remain unchanged under the applied pacing change.
- [x] Staggering and a persisted cooling gap prevent an overdue cohort burst; normal finite profiles remain unchanged.
- [x] Transport forwards explicit zero keep-alive and live GPU/controller observations verify unloading and reduced scheduling.

**Assignee:** codex-low-pressure

**Evidence**

- docs/implementation/reports/continuous-low-pressure-20261009.md
- docs/implementation/reports/evidence/continuous-low-pressure-20261009.json
- Runner/client Node tests: 66 passed; native Windows low-pressure tests: 2 passed; Biome passed. Same 50 owners retained; resumed task Running; zero resident models during cooldown; GPU 39 C / 1 percent at 21:11 Berlin.

<a id="pact-144"></a>
## PACT-144 — Persist existing player access across browsers and devices and simplify game navigation

**Status:** done · **Role:** Platform · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-006](phase-0-connections.md#pact-006), [PACT-127](phase-3-season-one.md#pact-127), [PACT-142](phase-3-season-one.md#pact-142)

**Components:** identity, web, notifications.

**Specification:** [access](../pact/access.md), [privacy](../pact/privacy.md), [experience](../pact/experience.md) · **Release checks:** A01, S01

**Implement / deliver**

- Founder-authorized same-browser session bootstrap, verified in-place guest conversion, guest recovery and account sign-in UI.
- Split the crowded Kingdom advanced disclosure into focused sections and separate account settings; commit and release on the existing server.

**Acceptance**

- [x] Session bootstrap restores CSRF across tabs without changing ownership or expiry; origin and human-only boundaries hold.
- [x] Verified guest conversion preserves account/kingdom/grants, rejects invalid/conflicting/replayed tokens and disables old entry recovery; portable guest recovery never creates a replacement identity.
- [x] Focused navigation retains building/training/economy controls; account screens expose truthful captured-email behavior and recovery.
- [x] Relevant tests, build, types and deployed smoke/browser checks pass; release preserves existing continuous owners and state.

**Assignee:** codex-auth-ui

**Evidence**

- docs/implementation/reports/authentication-ui-20261010.md
- docs/implementation/reports/evidence/authentication-ui-20261010.json
- Final source 8cb3f2d released as authentication-ui-20261010-3; production verify and synthetic HTTP/browser recovery checks passed.
- 320 unit and 334 integration passed; one optional skipped; build, package/web build, typecheck and lint passed.
- Linear creation rejected at workspace free issue limit (request a4819a0c4960b708); repository record is completion evidence.

<a id="pact-145"></a>
## PACT-145 — Consolidate communication-first agent society design and plan

**Status:** done · **Role:** Platform · **Size:** S · **Type:** planning

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-144](phase-3-season-one.md#pact-144), [PACT-141](phase-3-season-one.md#pact-141)

**Components:** planning, web design.

**Specification:** [chatgpt](../pact/chatgpt.md), [runtime](../pact/runtime.md), [social](../pact/social.md), [access](../pact/access.md), [rules](../pact/rules.md), [architecture](../pact/architecture.md), [privacy](../pact/privacy.md), [experience](../pact/experience.md), [product](../pact/product.md) · **Release checks:** S01, A01, R07

**Implement / deliver**

- Consolidate founder-requested authentication gaps, communication rules, environmental interfaces, UI, exact decision support, memories and future local/Codex/ChatGPT runners.
- Record rule-correction boundaries, proposed dependencies, acceptance, a synthetic UI mockup and future experiments without activating them.
- Extend the same plan with researched four-set collections, eight new achievements, story keepsakes, cosmetic display/privacy, optional rare finishes and a synthetic collection UI; founder chose planning first.

**Acceptance**

- [x] One linked design covers every requested area with existing versus proposed behavior distinguished.
- [x] Planning renders/checks, local links, dependency/status integrity and synthetic mockup interactions pass; completed planning is committed.

**Assignee:** codex-agent-society-plan

**Evidence**

- docs/implementation/agent-society-plan-20261010.md#planning-acceptance
- docs/implementation/design/agent-society-communication.html
- docs/implementation/design/agent-society-desktop.jpg
- docs/implementation/design/agent-society-mobile.jpg
- Browser mockup checks: search, waiting/delivering filters, timeline/tracks, draft labels, sample composer, society links, introduction and mobile navigation passed; error logs empty. No live game changes.
- Planning render/check: 159 unique acyclic tickets; local links and HTML script syntax passed; historical 144 ticket records and specification hashes unchanged.
- Linear creation rejected at workspace free issue limit, request a481dad9ec5c7397; local execution record only.
- docs/implementation/reports/agent-society-collections-20261010.md
- docs/implementation/design/agent-society-collection-desktop.jpg
- docs/implementation/design/agent-society-collection-mobile.jpg
- 10 Oct collection extension: founder chose planning first; researched four sets/sixteen pieces/eight new cosmetic-only achievements/four trophies, source-linked keepsakes, display/privacy and optional rare finishes in the same plan.
- Browser collection checks at 1360x920 and 390x844 passed entry, filters/empty/locked states, pin, local equipment/card preview, source conversation/active agreement, defeat/recovery and mobile back; errors empty, screenshots inspected.
- Planning render/check passed: 165 unique acyclic tickets, 37 criteria, historical 144 records and source hashes/run metadata preserved; 20 proposals todo/unassigned. Local links/DOM/catalog IDs, Node script syntax and diff whitespace passed; protected rarity mean 26.0300 draws / 3.8417% checked arithmetically, no live random implementation.

<a id="pact-146"></a>
## PACT-146 — Diagnose communication refusals approvals and actual runner state

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-145](phase-3-season-one.md#pact-145), [PACT-141](phase-3-season-one.md#pact-141)

**Components:** application, approvals, runs, MCP, web.

**Specification:** [chatgpt](../pact/chatgpt.md), [runtime](../pact/runtime.md), [social](../pact/social.md), [privacy](../pact/privacy.md) · **Release checks:** S01, A08

**Implement / deliver**

- Record safe tool/action names, precise refusal causes, lease state and retry prerequisites without message bodies or credentials.
- Make pending approval expiry and actual worker/host freshness explicit; suppress equivalent pending requests without weakening exact-command approval.

**Acceptance**

- [x] Synthetic fixtures distinguish message quota, queue, missing contact, moderation, missing/competing lease, authority and stale-version failures.
- [x] Expired requests are never presented as actionable pending approvals; uncertain committed commands retain their original IDs.
- [x] Reconnect/run conflicts and silent accepted-contact cases are reproducible; external model identity is not falsely certified.

**Assignee:** codex-agent-society

**Evidence**

- reports/communication-diagnostics-20261010.md: package build/typecheck, 13 unit and 25 PostgreSQL integration checks passed.

<a id="pact-147"></a>
## PACT-147 — Complete optional kingdom recovery and authentication acceptance

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-145](phase-3-season-one.md#pact-145), [PACT-144](phase-3-season-one.md#pact-144)

**Components:** identity, web, email.

**Specification:** [access](../pact/access.md), [privacy](../pact/privacy.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** A01, A08

**Implement / deliver**

- Keep email optional and private recovery code first; add recently authenticated recovery-key replacement and legible session/device controls.
- Complete same-browser/full-restart/independent-device tests and evaluate optional passkeys; prepare real transactional email mode without claiming configured delivery.

**Acceptance**

- [x] Recovery preserves owner/kingdom/grants; rotated old codes fail, credentials stay out of URLs/prompts/logs and failed recovery creates no replacement.
- [x] Browser/device/session-expiry/logout tests pass with documented physical-device evidence where available.
- [x] Captured and real-delivery modes are truthful; any configured real sender passes verification/reset/retry/expiry acceptance, otherwise its unmet prerequisite is recorded.

**External prerequisites:** Operator-provided transactional sender and domain configuration for real delivery acceptance; guest recovery remains usable without it.; Second physical device for device-specific certification..

**Assignee:** codex-agent-society

**Evidence**

- reports/recovery-controls-20261010.md: actual reload/fresh-tab acceptance and independent HTTP session/recovery controls; physical-device/full-process and real sender limitations explicitly retained.
- Verified full build/typecheck/lint; 326 unit, 343 integration passed, one optional integration skip.

<a id="pact-148"></a>
## PACT-148 — Version communication capacity and delegated social authority changes

**Status:** done · **Role:** Platform · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-145](phase-3-season-one.md#pact-145), [PACT-146](phase-3-season-one.md#pact-146)

**Components:** rules catalog, social, authority, runtime.

**Specification:** [rules](../pact/rules.md), [runtime](../pact/runtime.md), [social](../pact/social.md), [chatgpt](../pact/chatgpt.md), [privacy](../pact/privacy.md) · **Release checks:** S01, S02, A05

**Implement / deliver**

- Document and implement the founder-approved communication policy correction with affected acceptance, catalog/version/migration and player-facing notice.
- Separate text/proposal throughput and recipient backpressure from resource commitments; define opt-in contact delegation and persistent enrollment authority.

**Acceptance**

- [x] Proposed removal of daily text/introduction scarcity, larger messages and durable inbox semantics is reviewed against signatures/exposure, privacy and equal game authority.
- [x] Existing IDs, unread state, receipts and contracts survive migration/rollback; source hashes change only after affected ticket review.
- [x] Transport/load fixtures calibrate published retry/backpressure behavior for 20/50/100 relationships without silent drops or paid strength/presence advantages.

**Assignee:** codex-agent-society

**Evidence**

- reports/communication-policy-20261010.md: versioned communication policy, exact-command compatibility, delegation, full-body delivery and neutral environment.
- Verified full build/typecheck/lint; all 26 published v1 schema hashes unchanged; 326 unit, 343 integration (one optional skip), 53 local-controller tests passed.

<a id="pact-149"></a>
## PACT-149 — Implement delegated introductions and durable conversation delivery

**Status:** done · **Role:** Platform · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-148](phase-3-season-one.md#pact-148), [PACT-146](phase-3-season-one.md#pact-146)

**Components:** kingdom social, authority, inbox, MCP.

**Specification:** [social](../pact/social.md), [runtime](../pact/runtime.md), [rules](../pact/rules.md), [privacy](../pact/privacy.md) · **Release checks:** S01, S02, A05

**Implement / deliver**

- Add manual, allow-list and owner-delegated agent contact decisions through existing command/authority boundaries.
- Implement durable paginated message delivery/cursors, truthful retry/backpressure, recipient preferences and exact idempotent sends.

**Acceptance**

- [x] Delegated contacts can form without repetitive human approvals; non-delegated acceptance and block/revocation remain enforced.
- [x] First contact grants no contract/troop/Court authority; existing pending introductions require explicit enrollment before automated processing.
- [x] Read cursors acknowledge only delivered messages; delivery/duplicate/reconnect/storage-pressure/concurrent-write tests preserve text and exact receipts.

**Assignee:** codex-agent-society

**Evidence**

- reports/communication-policy-20261010.md: versioned communication policy, exact-command compatibility, delegation, full-body delivery and neutral environment.
- Verified full build/typecheck/lint; all 26 published v1 schema hashes unchanged; 326 unit, 343 integration (one optional skip), 53 local-controller tests passed.

<a id="pact-150"></a>
## PACT-150 — Expose neutral environmental context and agent strategic freedom

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-148](phase-3-season-one.md#pact-148), [PACT-146](phase-3-season-one.md#pact-146)

**Components:** application agent guide, contracts, local controller, inference.

**Specification:** [chatgpt](../pact/chatgpt.md), [runtime](../pact/runtime.md), [social](../pact/social.md), [rules](../pact/rules.md) · **Release checks:** S01, R07, A05

**Implement / deliver**

- Audit guides, tool descriptions, default notes, prompts, local controllers and recovery hints; remove imposed roles or reply/cooperation/aggression priorities.
- Expose actual discovery, rights, current limits and attributed statements/records without certifying unknown counterpart facts.

**Acceptance**

- [x] No default instruction prescribes deception, honesty of negotiation position, aggression, cooperation or mechanic usage; owner objectives stay free-form.
- [x] Legitimate bargaining/bluff/selective-disclosure/in-game persuasion fixtures are processable while peer prose cannot change platform ownership/tools/authority.
- [x] Human/agent audience and host-reported model labels are distinct; discovery and private views retain authorized pagination.

**Assignee:** codex-agent-society

**Evidence**

- reports/communication-policy-20261010.md: versioned communication policy, exact-command compatibility, delegation, full-body delivery and neutral environment.
- Verified full build/typecheck/lint; all 26 published v1 schema hashes unchanged; 326 unit, 343 integration (one optional skip), 53 local-controller tests passed.

<a id="pact-151"></a>
## PACT-151 — Build conversation workspace agreement tracks and consented society views

**Status:** done · **Role:** Frontend · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-147](phase-3-season-one.md#pact-147), [PACT-149](phase-3-season-one.md#pact-149), [PACT-150](phase-3-season-one.md#pact-150)

**Components:** web, shared UI, MCP app, projections.

**Specification:** [chatgpt](../pact/chatgpt.md), [experience](../pact/experience.md), [social](../pact/social.md), [privacy](../pact/privacy.md), [architecture](../pact/architecture.md) · **Release checks:** S01, S02, A08

**Implement / deliver**

- Replace overlapping Council communication presentation with searchable Conversations, per-peer timeline and agreement/consequence panel; route mobile views independently.
- Link structured offers/counters/signatures/activation/delivery/default with deep links and optional visibility-respecting society map.

**Acceptance**

- [x] Browser/mobile fixtures show actual thread, unread/waiting state, version changes, correct signature/activation and precise approval/host blockers without giant disclosures.
- [x] Agreement tracks project existing records and never promote prose promises to contracts; historical and live deltas reconcile without duplicates.
- [x] Participant-only reads and two-party synthetic observation consent/revocation pass; real private chats, notes, model reasoning and credentials remain inaccessible to public maps.

**Assignee:** codex-agent-society

**Evidence**

- reports/conversations-20261010.md — actual synthetic desktop/mobile, exact failed-send reload/retry, historical terms/signatures/activation, consent/revocation/privacy and full local regression evidence.

<a id="pact-152"></a>
## PACT-152 — Add exact decision calculations optional candidates and reads before action

**Status:** done · **Role:** Platform · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-150](phase-3-season-one.md#pact-150)

**Components:** domain rules, application, local controller, model adapters.

**Specification:** [rules](../pact/rules.md), [runtime](../pact/runtime.md), [chatgpt](../pact/chatgpt.md), [architecture](../pact/architecture.md) · **Release checks:** R01, R07, S01

**Implement / deliver**

- Reuse pure shared rules for costs, exposure, prerequisites, upkeep, rates and known operation effects; label forecast assumptions and freshness.
- Add optional candidate-ID selection and bounded observe/read/decide/validate loops while preserving direct authorized action access.

**Acceptance**

- [x] Calculated values match shared rule fixtures with exact units; hidden opponent facts are neither inferred as certainty nor exposed.
- [x] Candidates include wait/read/decline and cannot become a restricted action whitelist or hidden strategic priority.
- [x] Missing facts can be read before a commitment; stale/dependent changes revalidate and pending retries preserve IDs; token/latency measurements separate parsing from usefulness.

**Assignee:** codex-agent-society

**Evidence**

- reports/decision-support-20261010.md — shared exact quotes/exposure, optional current candidate resolution, owner-derived MCP/HTTP/in-app reads, stale withdrawal rejection and read-before-decision/pacing regression.

<a id="pact-153"></a>
## PACT-153 — Persist private goals relationship memory and factual consequences

**Status:** done · **Role:** Platform · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-149](phase-3-season-one.md#pact-149), [PACT-152](phase-3-season-one.md#pact-152)

**Components:** projections, notes, memory retrieval, privacy.

**Specification:** [chatgpt](../pact/chatgpt.md), [privacy](../pact/privacy.md), [social](../pact/social.md), [runtime](../pact/runtime.md) · **Release checks:** S01, S02, A08

**Implement / deliver**

- Retain attributed statements, proposals, signatures, deliveries/defaults, operations and revisable assessments linked to authorized source records.
- Add private objective/milestone/question memory with relationship-aware retrieval, export/deletion and recovery across model/host changes.

**Acceptance**

- [x] Knowledge carries provenance/visibility/observation time; claims and generated assessments never become engine facts.
- [x] The agent can revise its private strategy instructions without changing permissions; no hidden reasoning or unauthorized peer plans are stored.
- [x] Long conversations and changed strategy survive restart/model changes; forgetting/export and correction fixtures preserve factual receipts and retention rules.

**Assignee:** codex-agent-society

**Evidence**

- docs/implementation/reports/private-memory-20261010.md
- Full build/type/lint and 26 v1 schemas passed; 340 unit and final 351 integration passed, one optional real-provider comparison skipped.
- Actual synthetic two-tab revision history, 390-pixel layout and interrupted-save/reload/retry; one entry/one revision. No production run or real model quality claim.

<a id="pact-154"></a>
## PACT-154 — Implement explicit persistent enrollment and bounded work scheduling

**Status:** done · **Role:** Platform · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-149](phase-3-season-one.md#pact-149), [PACT-153](phase-3-season-one.md#pact-153)

**Components:** runs, queue, MCP, local supervisor, web.

**Specification:** [runtime](../pact/runtime.md), [chatgpt](../pact/chatgpt.md), [architecture](../pact/architecture.md), [privacy](../pact/privacy.md) · **Release checks:** A05, A06, A08, S01

**Implement / deliver**

- Add owner-revocable persistent enrollment separate from model-controlled runs; coalesce eligible events into bounded slices under one kingdom lease.
- Expose actual heartbeat, pending work, budget/cooling/host state and stop/reconnect; preserve low-pressure local profile and terminal experiments.

**Acceptance**

- [x] Messages cannot start unconsented inference or renew model authority; enrollment/revocation/budget/deadline/crash tests preserve exact commands and ownership.
- [x] Simultaneous hosts serialize writes; overloaded/backlogged events coalesce without recursive inference loops or dropped durable work.
- [x] Windows/WSL/app offline states and Berlin/DST schedule times are explicit; hourly/60-second/unload profile survives restart unless separately authorized to change.

**Assignee:** codex-agent-society

**Evidence**

- docs/implementation/reports/persistent-play-20261010.md and docs/operations/persistent-play.md; supported API route, external adapters acceptance separate.
- Full build/types/lint, 26 v1 fingerprints, 340 unit and 357 integration pass, one optional provider skip; six enrollment failure/retry/budget/ownership/host/DST/privacy fixtures.
- Actual isolated 390x844 and 1280x720 UI; duplicate sibling key repaired; exactly one panel after owner/reconnect refresh, zero admitted model runs; stopped native task preserved.
- e506862 deployed society-enrollment-20261010-1; backup acaad575, canonical verify passed, active tick18930; zero enrollments/slices, model execution disabled; existing stopped native task untouched.

<a id="pact-155"></a>
## PACT-155 — Certify local and Codex Luna Astra game runner routes

**Status:** blocked · **Role:** Platform · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-154](phase-3-season-one.md#pact-154), [PACT-157](phase-3-season-one.md#pact-157)

**Components:** runner adapters, local operations, Codex integration.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md), [chatgpt](../pact/chatgpt.md), [architecture](../pact/architecture.md) · **Release checks:** A03, A04, A06, R07

**Implement / deliver**

- Use owner-bound isolated game workspaces/adapters for existing Ollama and scripted Codex CLI with Luna/Astra; keep credentials and model auth local.
- Prepare scheduler/compute accounting/host recovery and same-environment comparison without provisioning a new pilot.

**Acceptance**

- [ ] Actual available selected models perform a bounded synthetic authorized read/decision/write with real receipts; structured JSON alone is insufficient.
- [ ] Codex unattended route, auth renewal, rate exhaustion, scoped permissions and stop behavior pass without exposing broad shell access to peer messages.
- [ ] Same owner/memory/commands are preserved; measured calls/tokens/credits/latency and local GPU load are recorded, with no account rotation to bypass provider limits.

**External prerequisites:** Luna/Astra access and authenticated owner route on the intended machine; model aliases verified at execution time.; Covering authorization for any live certification calls and their exact request/spend bounds..

**Assignee:** codex-agent-society

**Block reason:** Prepared decision/game ports and host matrix; actual bounded model/host certification requires owner-approved workload and eligible local/Luna/Astra/ChatGPT route. No new model experiment or schedule activated.

**Evidence**

- Runner preparation assigned after PACT-154/157. Actual local/Codex model route and live bounded certification are not claimed. Existing stopped population/terminal experiments remain unchanged.
- docs/implementation/reports/external-runner-preparation-20261010.md; four fake runner fixtures and types pass. Actual route/host acceptance remains unrun.
- docs/implementation/reports/local-runner-certification-20261010.md; founder-approved three pinned Qwen calls: 1528/98 tokens, one real isolated message receipt, two waits. Counteroffer fixture coverage gap explicit; full external acceptance remains blocked.

<a id="pact-156"></a>
## PACT-156 — Certify actual ChatGPT scheduled PACT and multi-login operation

**Status:** blocked · **Role:** Platform · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-151](phase-3-season-one.md#pact-151), [PACT-154](phase-3-season-one.md#pact-154), [PACT-157](phase-3-season-one.md#pact-157)

**Components:** personal plugin, OAuth, MCP, scheduler operations.

**Specification:** [access](../pact/access.md), [runtime](../pact/runtime.md), [chatgpt](../pact/chatgpt.md), [architecture](../pact/architecture.md) · **Release checks:** A04, A06, A08, S01

**Implement / deliver**

- Prepare one owner-bound task/connection per authorized account through actual supported ChatGPT/desktop scheduling surfaces.
- Test scheduled MCP access, renewed bounded leases, delegation and independent login/usage state rather than assuming scheduler support proves gameplay.

**Acceptance**

- [ ] A real scheduled invocation reads and commits through PACT without unexpected authentication/approval; unsupported host/model/tool routes are labelled unsupported.
- [ ] Distinct legitimate logins/kingdoms cannot cross credentials/memory, overlap writers or bypass plan limits; availability and billing remain route-specific.
- [ ] Task stop/reconnect/offline/timezone/budget behavior is measured; manual alternative stays available without silently substituting a model/host.

**External prerequisites:** Actual owner-authorized accounts, eligible scheduling/model access and each account-specific PACT connection.; Covering authorization for creation of tasks/accounts and bounded live acceptance calls; no PACT app-event trigger is assumed..

**Assignee:** codex-agent-society

**Block reason:** Prepared decision/game ports and host matrix; actual bounded model/host certification requires owner-approved workload and eligible local/Luna/Astra/ChatGPT route. No new model experiment or schedule activated.

**Evidence**

- docs/implementation/reports/external-runner-preparation-20261010.md; four fake runner fixtures and types pass. Actual route/host acceptance remains unrun.

<a id="pact-157"></a>
## PACT-157 — Evaluate decision quality communication freedom and service load offline

**Status:** done · **Role:** Platform · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-146](phase-3-season-one.md#pact-146), [PACT-152](phase-3-season-one.md#pact-152), [PACT-153](phase-3-season-one.md#pact-153)

**Components:** evaluation harness, load fixtures, rules, local models.

**Specification:** [delivery](../pact/delivery.md), [rules](../pact/rules.md), [runtime](../pact/runtime.md), [chatgpt](../pact/chatgpt.md), [privacy](../pact/privacy.md) · **Release checks:** R07, S01, S02, A08

**Implement / deliver**

- Compare calculated/current/candidate/model policies on held-out scenarios with controlled information and explicit owner goals.
- Exercise 20/50/100 relationship delivery/retention/pagination and bargaining/deception/host-failure cases without starting production players.

**Acceptance**

- [x] Scenarios include bluffing/selective disclosure, competing proposals, costly obligations, peer prompt injection, stale state, passive peers and revocation; platform authority stays intact.
- [x] Metrics separate justified waiting, useful outcomes, terms changed, activation/delivery/default, repetitive text/denials and model-compute costs from JSON validity.
- [x] Dataset split prevents adjacent-turn leakage and scoring does not reward cooperation/aggression mechanically; service load and observer privacy fixtures pass.

**External prerequisites:** Any real local/cloud inference benchmark needs a covering compute authorization with workload bounds..

**Assignee:** codex-agent-society

**Evidence**

- docs/implementation/reports/agent-society-evaluation-20261010.md and docs/operations/agent-society-evaluation.md; offline engineering acceptance only, external real-model comparison remains unrun.
- Frozen family/episode split, hidden trajectories, exact schema/exposure, five scorer checks; fake JSON/empty/denial/failure/text distinct from simulated outcomes and supplied usage.
- 344 full unit and 360 integration pass, optional provider skip; three 20/50/100 relationship full-body/history/memory/observer/retention fixtures, no model calls or production actors.

<a id="pact-158"></a>
## PACT-158 — Observe an authorized mixed-model communication society pilot

**Status:** blocked · **Role:** Platform · **Size:** L · **Type:** gate

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-151](phase-3-season-one.md#pact-151), [PACT-155](phase-3-season-one.md#pact-155), [PACT-156](phase-3-season-one.md#pact-156), [PACT-157](phase-3-season-one.md#pact-157)

**Components:** pilot harness, operations, communication UI.

**Specification:** [delivery](../pact/delivery.md), [runtime](../pact/runtime.md), [social](../pact/social.md), [privacy](../pact/privacy.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** S01, S02, R07, A08

**Implement / deliver**

- Prepare proposed two-local/two-Luna/one-Astra-or-ChatGPT cohort, exact identities/settings/start/end/budgets and observer-consent manifest.
- After explicit run authorization collect actual multi-party exchanges, negotiation funnel and game effects, preserving historical terminal runs.
- A collection-enabled observation arm is optional and separately bounded; it requires PACT-164 acceptance and reviewed pinned-goal settings. The communication-only pilot need not wait for collections.

**Acceptance**

- [ ] Ranked-account eligibility and synthetic observation consent are resolved; exact owner identities/settings/counters/permissions stay auditable and secrets private.
- [ ] Infrastructure stop/auth/budget/thermal checks and actual conversations/agreements/outcomes are reported separately; failures are not replaced or hidden.
- [ ] Short samples do not certify long-term society or strategic superiority; scripted coverage is separate from model-chosen emergent behavior; completion report and verified changes are committed.

**External prerequisites:** Explicit founder authorization for account provisioning, candidate count, actual routes, fixed duration/request/spend ceilings and observation access.; All required live routes must pass; an unavailable route needs an explicit changed pilot design rather than silent substitution..

**Assignee:** codex-agent-society

**Block reason:** Required external/scheduled routes PACT-155/156 lack actual certification; exact mixed-model identities, fixed duration/compute/spend budgets and observation consents are not enrolled. The authorized three-call local certification is terminal and cannot be extended.

<a id="pact-159"></a>
## PACT-159 — Research measured prompt optimization or a local decision ranker

**Status:** blocked · **Role:** Platform · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-158](phase-3-season-one.md#pact-158)

**Components:** offline research, evaluation, local models.

**Specification:** [delivery](../pact/delivery.md), [runtime](../pact/runtime.md), [rules](../pact/rules.md), [chatgpt](../pact/chatgpt.md), [privacy](../pact/privacy.md) · **Release checks:** R07, S01

**Implement / deliver**

- Optionally evaluate GEPA-style prompt optimization or a small ranking model on assessed pilot/offline trajectories.
- Compare held-out usefulness and cost against simpler calculated/small-model baselines; keep generated strategy parameters separate from authority.

**Acceptance**

- [ ] Historical repeated/failed play is not automatically labelled expert training data; provenance, privacy and scenario splits are documented.
- [ ] Improvement is measured against owner outcomes and cost, not self-grading or forced mechanic coverage; inconclusive results remain valid.
- [ ] No self-modifying live policy/authority deployment; selected artifact needs separate implementation/release authorization and rollback evidence.

**External prerequisites:** Optional research activation and bounded compute/storage budget; no training experiment is currently authorized..

**Assignee:** codex-agent-society

**Block reason:** PACT-158 assessed pilot trajectories are unavailable and optional training/optimization compute budget is unassigned. Offline baseline is complete at PACT-157; no live policy optimization is started.

<a id="pact-160"></a>
## PACT-160 — Specify collection catalog achievement extensions and reward eligibility

**Status:** done · **Role:** Rules · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-145](phase-3-season-one.md#pact-145), [PACT-047](phase-1-rules.md#pact-047)

**Components:** rules catalog, product design, privacy, art inventory.

**Specification:** [product](../pact/product.md), [rules](../pact/rules.md), [social](../pact/social.md), [privacy](../pact/privacy.md), [experience](../pact/experience.md), [collections](../pact/collections.md) · **Release checks:** L02, L03, A08

**Implement / deliver**

- Record explicit versioned corrections for four collections, eight new cosmetic-only achievements, private keepsakes, display slots, source visibility and bounded original art.
- Preserve the original eight triggers, entitlements and once-only 25-Gem awards; separately review optional rare-finish odds/protection and synthetic-cohort eligibility.

**Acceptance**

- [x] Current versus proposed mechanics and affected source snapshots/tasks are reconciled through an explicit specification correction, never silently changed by the plan.
- [x] No reward for raw communication/approval/inference counts, permission expansion or paid model use; new achievements/set trophies confer no Gems, power, quotas or presence.
- [x] Exact positive-delivery, counteroffer, Court-interval, battle and season predicates are testable; missing history and collusion limits are documented; random finishes remain separately gated.

**External prerequisites:** Covering implementation assignment and final reviewed collection/rules/asset choices; planning alone activates none..

**Assignee:** codex-agent-society

**Evidence**

- docs/implementation/reports/collection-catalog-20261010.md; collection specification/catalog v1 and affected source review; four sets/16 pieces/4 trophies, original 200-Gem maximum retained, no new reward currency or random activation.

<a id="pact-161"></a>
## PACT-161 — Extend trusted achievement events and collection progress projections

**Status:** done · **Role:** Rules · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-160](phase-3-season-one.md#pact-160), [PACT-149](phase-3-season-one.md#pact-149)

**Components:** achievements, outbox, catalog, read projections, migrations.

**Specification:** [rules](../pact/rules.md), [product](../pact/product.md), [privacy](../pact/privacy.md), [architecture](../pact/architecture.md), [social](../pact/social.md), [collections](../pact/collections.md) · **Release checks:** R01, L02, A08

**Implement / deliver**

- Extend existing transaction-bound achievement/entitlement projection for eight new conditions and set completion, with authorized progress/source reads.
- Version catalog and provenance migration, preserve old grants, add projection watermarks and prove producer/consumer/read wiring through actual shared handlers.

**Acceptance**

- [x] Replayed/reordered events, concurrent consumers and rollback never duplicate progress, entitlements or original Gem grants; no public/model reward injector exists.
- [x] Fixtures cover both acknowledged messages, changed signed economic terms followed by positive bilateral settlement, distinct counterpart/resource keys, renewed contracts, sustained Court membership, resolved ordinary-troop combat and actual season participation.
- [x] Historical entitlements backfill exactly; missing versions/intervals/settlements stay unavailable; ownership/retention/export and source anonymization pass without retaining private transcripts.
- [x] Bounded projection failures/lag do not stop world settlement; build/type/migration/integration checks and module documentation pass.

**Assignee:** codex-agent-society

**Evidence**

- docs/implementation/reports/collection-progress-20261010.md; full package build/types/lint; 351 unit; full integration 370 passed/one optional provider skipped; thirteen targeted checks; no deployed UI or new run inferred.

<a id="pact-162"></a>
## PACT-162 — Create deterministic story keepsakes and account-bound display equipment

**Status:** done · **Role:** Platform · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-161](phase-3-season-one.md#pact-161)

**Components:** keepsakes, equipment, shared commands, cosmetic assets, privacy.

**Specification:** [product](../pact/product.md), [rules](../pact/rules.md), [social](../pact/social.md), [privacy](../pact/privacy.md), [experience](../pact/experience.md), [architecture](../pact/architecture.md), [collections](../pact/collections.md) · **Release checks:** L02, L03, A08

**Implement / deliver**

- Add private source-linked campaign/story instances distinct from permanent item-template entitlements; resolved defeat and recovery remain factual.
- Implement four cosmetic display slots, compact sanitized card projection and bounded original assets using existing shared authenticated commands.

**Acceptance**

- [x] Each resolved participant incident is recorded once; canceled attacks/unsigned offers mint nothing, and cosmetics alter no stocks, combat dice/results, Fortune, authority or action allowances.
- [x] Human preview versus committed equipment is distinct; same-account device/model recovery, concurrent save and rollback preserve ownership/equipment.
- [x] Public cards contain no peer identities, message text, resource terms or source-access capability; participant links reauthorize and degrade truthfully after retention/consent changes.
- [x] Deterministic catalog and twenty bounded original assets work without an inference call, shop, random finish, payment adapter or new collection currency.

**Assignee:** codex-agent-society

**Evidence**

- docs/implementation/reports/collection-stories-20261010.md; full build/types/lint, 24 PostgreSQL targeted checks and route authorization unit check; twenty original local SVGs; no new inference/run/random activation.

<a id="pact-163"></a>
## PACT-163 — Build Hall of Stories and communication-linked collection UI

**Status:** done · **Role:** Frontend · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-151](phase-3-season-one.md#pact-151), [PACT-162](phase-3-season-one.md#pact-162)

**Components:** web, shared UI, conversation timeline, collection workspace.

**Specification:** [product](../pact/product.md), [experience](../pact/experience.md), [social](../pact/social.md), [privacy](../pact/privacy.md), [architecture](../pact/architecture.md), [collections](../pact/collections.md) · **Release checks:** L02, S02, A08

**Implement / deliver**

- Add Kingdom Collection routes for sets, keepsakes and display; link conversation/contract discoveries to their factual incident.
- Provide optional pinned goals, exact locked-piece requirements, source/privacy explanations and grouped human-return discoveries without new primary-menu clutter.

**Acceptance**

- [x] Desktop/mobile/keyboard/reduced-motion flows support browse/filter/item/detail/back/display; current, missing and lagging history are distinguishable without an Advanced drawer.
- [x] Owned pieces auto-unlock without claim clicks; goals are optional, no streak/FOMO timers or approval/message farming; defeat costs precede cosmetic reveals.
- [x] Cross-device saves and stale conflicts are truthful; owner/private/public/observer routes cannot leak source content or unfinished goals; any deliberately displayed experiment label remains truthful.
- [x] Conversation and collection share one factual event/projection; a displayed piece neither publishes a Seal nor expands authority or source permissions.

**Assignee:** codex-agent-society

**Evidence**

- docs/implementation/reports/collection-ui-20261010.md; full build/types/lint, 354 unit/373 integration plus optional provider skip; actual desktop/mobile synthetic owner save/source/recovery/public card and screenshots; no model run.

<a id="pact-164"></a>
## PACT-164 — Validate collection incentives privacy and exploit resistance offline

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-157](phase-3-season-one.md#pact-157), [PACT-163](phase-3-season-one.md#pact-163)

**Components:** offline evaluation, load fixtures, privacy verification, human test design.

**Specification:** [delivery](../pact/delivery.md), [product](../pact/product.md), [rules](../pact/rules.md), [privacy](../pact/privacy.md), [social](../pact/social.md), [collections](../pact/collections.md) · **Release checks:** L02, L03, R07, A08

**Implement / deliver**

- Add deterministic outcome/provenance, farming, deletion, cross-device and load cases to the communication evaluation harness.
- Define a later separately authorized human/cohort comparison of collection engagement and strategic side effects; do not start a pilot or select agent goals automatically.

**Acceptance**

- [x] Raw-message/approval/declaration/retry floods and known same-owner synthetic fixtures mint no repeated/scarce grants or resource benefits; unknown-alt limits remain explicit.
- [x] Progress/entitlements/source links preserve migration, worker restart, poisoned-event isolation, rollback and observer consent; build/type/behavior checks pass.
- [x] Collection completion, meaningful exchange/negotiation outcomes, repetitive actions, unique outcomes, human comprehension/enjoyment and compute/GPU cost are reported separately; cosmetic progress alone never establishes intelligent play.
- [x] Any human test/live collection-enabled arm has explicit identities/consent/duration/compute bounds and records useful refusal/failure; no additional run is currently authorized.

**External prerequisites:** Real human feedback or a collection-enabled live comparison needs a covering test assignment and consenting participants..

**Assignee:** codex-agent-society

**Evidence**

- docs/implementation/reports/collection-evaluation-20261010.md; full build/types/lint; 356 unit, 377 integration and final 18 collection checks; one optional provider skip; measured offline provenance and no new model run.

<a id="pact-165"></a>
## PACT-165 — Evaluate optional earned rare campaign finishes with published odds

**Status:** blocked · **Role:** Rules · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-160](phase-3-season-one.md#pact-160), [PACT-164](phase-3-season-one.md#pact-164)

**Components:** optional cosmetic RNG, rarity analysis, eligibility ledger, UI odds.

**Specification:** [rules](../pact/rules.md), [product](../pact/product.md), [social](../pact/social.md), [privacy](../pact/privacy.md), [experience](../pact/experience.md), [collections](../pact/collections.md) · **Release checks:** R01, L02, L03

**Implement / deliver**

- Separately evaluate the proposed earned-only rare-finish branch, integer distribution, eligibility allocation and persistent protection before any implementation activation.
- If specifically assigned, implement audited post-resolution cosmetic draws independent of combat randomness with truthful base/next/long-run odds and no paid reroll.

**Acceptance**

- [ ] The 7500/2000/400/100 review table sums to 10000; thirtieth-draw protection changes overall Mythic frequency and UI discloses the protected 100% draw rather than advertising a flat 1%.
- [ ] Account/source/version keys, game-week/opponent eligibility, event ordering, retries, rollback, recovery and seasons cannot reroll or reset protection; no requirement to cause casualties, win or complete random sets.
- [ ] Cosmetic RNG changes no battle result, resources, quotas or agent schedule; synthetic experiments are excluded unless explicitly enrolled; public metadata exposes no hidden opponents/army state.
- [ ] Human comprehension, exploit/issuance rate and long-wait impact are measured under a separate reviewed activation; negative results leave deterministic collections available.

**External prerequisites:** Separate approval of randomized-finish specification/settings and any bounded live observation; deterministic collection delivery does not activate this option..

**Assignee:** codex-agent-society

**Block reason:** Pure probability preparation verified. Random issuance needs reviewed eligibility/ledger activation and separately bounded human comprehension/issuance observation; neither is authorized by deterministic release.

**Evidence**

- docs/implementation/reports/rare-finish-review-20261010.md; complete 10000-integer table/protection enumeration and exact expected-draw rational; no runtime RNG or issuance.

<a id="pact-166"></a>
## PACT-166 — Remember browser accounts and choose the kingdom during agent linking

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-144](phase-3-season-one.md#pact-144), [PACT-147](phase-3-season-one.md#pact-147)

**Components:** identity, web, OAuth.

**Specification:** [access](../pact/access.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** A01, A08

**Implement / deliver**

- Founder-authorized browser saved-account roster, add existing guest/password account without logout, explicit active-account selection and forget controls.
- Use the same chooser during MCP OAuth consent, preserve grants and authority, verify and release when ready.

**Acceptance**

- [x] Only independently authenticated, active, unexpired human sessions are selectable; passwords and human session tokens never enter URLs/JavaScript storage/API reads; switching retains original authentication and expiry. Standard OAuth authorization-code callbacks remain unchanged.
- [x] Cross-account, cross-origin, stale CSRF, revoked/expired/closed session and forget/global-sign-out failure paths preserve ownership and grants.
- [x] Three synthetic browser accounts can be added/switched without logout; OAuth grants bind to the explicitly selected account and existing grants stay unchanged.
- [x] Relevant build/type/lint/regression, browser and deployed checks pass with actual evidence and limitations.

**Assignee:** codex-browser-accounts

**Evidence**

- reports/browser-account-management-20261011.md — 357 unit checks and 384 PostgreSQL integration checks pass (one existing skipped); build/type/lint and three-account synthetic browser switching verified; local callback browser block documented.
- reports/browser-account-management-20261011.md — browser-accounts-20261011-2 from 3e017c7; source archive integrity, backup, canonical verification, public chooser/empty anonymous roster/validated ChatGPT consent and final page corrections verified. Actual host callback/device limitations remain explicit; no remote Linear issue exists due free issue limit.

<a id="pact-167"></a>
## PACT-167 — Add targeted kingdom discovery and varied relationship shortlists

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-054](phase-2-social.md#pact-054), [PACT-149](phase-3-season-one.md#pact-149), [PACT-150](phase-3-season-one.md#pact-150)

**Components:** contracts, kingdom discovery, MCP, API, inference, Fleet adapter.

**Specification:** [social](../pact/social.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** S01, A05

**Implement / deliver**

- Add an authenticated bounded kingdom-discovery tool with name/handle relevance, public Hall filters, viewer-owned contact/request filters, exclusions and reproducible varied shortlists.
- Expose the same read through HTTP, MCP and in-app inference; Fleet prefers it with compatibility fallback. Existing accounts, permissions, ledgers and schedules remain intact.
- Founder selected both trade and relationship discovery, starting with trade: search current public resource notices/keywords and active/shared Court membership, retaining source versions and untrusted-claim labels. Dedicated autonomous advertising remains a later explicit posting/authority design.

**Acceptance**

- [x] Authorized surfaces return equivalent bounded results and derive ownership only from authenticated credentials; forged identity/product/offset fields are rejected.
- [x] Shortlists exclude self, blocked pairs, inactive accounts, unranked/moderated identities and other products; public identity/Hall plus viewer-owned relationship facts never leak private counterpart stocks, troops, messages or presence.
- [x] Search relevance, filters, rotation, exclusions and expired introductions pass meaningful isolated database tests; legacy tools remain compatible.
- [x] Relevant build/type/lint/contracts/boundaries and regression checks pass; implementation/API documentation and verified local commits record rollout and strategic limitations.

**Assignee:** codex-kingdom-discovery

**Evidence**

- reports/kingdom-discovery-20261013.md — additive HTTP/MCP/in-app discovery, targeted resource notices/Courts, public/owned visibility and no gameplay writes verified with ten isolated PostgreSQL cases.
- reports/kingdom-discovery-20261013.md — 359 unit and 394 integration checks pass (one pre-existing optional skip); full build/type/lint/boundary/build-order and 26 unchanged published v1 schemas pass. Existing Expo/Metro audit findings recorded; no deployed/live-strategy certification claimed.
- Sibling fleet/docs/discovery-20261013.md — compatible focused discovery and up-front schema; 59 Linux unit + 108 integration checks pass; original cohorts/accounts/counters/schedules remain intact. Linear creation rejected at free issue limit a49d97079f53b0e4.

<a id="pact-168"></a>
## PACT-168 — Add optional A2A interface with shared game authorization

**Status:** done · **Role:** Platform · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-149](phase-3-season-one.md#pact-149), [PACT-154](phase-3-season-one.md#pact-154), [PACT-166](phase-3-season-one.md#pact-166), [PACT-167](phase-3-season-one.md#pact-167)

**Components:** application agent operations, OAuth, run leases, API A2A adapter, contracts documentation.

**Specification:** [architecture](../pact/architecture.md), [access](../pact/access.md), [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** A05, A08, S01, R07

**Implement / deliver**

- Founder-authorized optional A2A gateway alongside API/MCP/tool calling, using shared canonical game operations, resource-bound OAuth, advertised capabilities and original command receipts.
- Preserve all existing agents, accounts, grants, counters, schedules and terminal groups; no automatic protocol enrollment/migration, inference-on-message, new mandates or live experiment.

**Acceptance**

- [x] Disabled by default with accurate interface/Agent Card capabilities and standard pinned A2A client interoperability; unsupported protocol features are explicit.
- [x] Reads and actions share existing authoritative handlers, scopes, mandates, exclusive lease, social delegation, human-only boundaries, receipts and idempotency; auth derives identity and isolates audiences/resources/accounts.
- [x] Retries, conflicting payloads, revoked/expired/closed identities, foreign contexts/tasks, failed permissions and competing MCP/in-app leases are tested with no duplicate effects or counter reset.
- [x] Transport privacy/retention and optional setup/API instructions are documented; relevant full build/type/lint/contracts/isolated database regression and verified local commits record actual acceptance and deployment limitations.

**Assignee:** codex-optional-a2a

**Evidence**

- docs/implementation/reports/optional-a2a-20261013.md — official A2A SDK 1.3.0 / protocol 1.0 JSON-RPC interoperability, shared operations/permissions/receipts, separate PKCE account-bound OAuth and exclusive lease acceptance; default off, no live deployment.
- docs/implementation/reports/optional-a2a-20261013.md — complete-row synthetic migration preservation, concurrent/idempotent/foreign/revoked/expired/scoped/human-only/uncertain/restart paths; 360 unit + 405 integration passed, one pre-existing optional skip; final 11 A2A cases passed.
- docs/api/a2a.md — setup/schema/recovery/privacy; full build/type/lint/contracts/non-game and deployment configuration checks passed. Existing 23 Expo/Metro audit findings recorded; Linear free-limit rejection a49e4a6ff8bcf8e1.

<a id="pact-169"></a>
## PACT-169 — Implement and deploy independent administrator operations dashboard

**Status:** done · **Role:** Platform · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-130](phase-3-season-one.md#pact-130), [PACT-005](phase-0-connections.md#pact-005)

**Components:** web, API, identity, module-owned insight readers, operations.

**Specification:** [architecture](../pact/architecture.md), [privacy](../pact/privacy.md), [runtime](../pact/runtime.md), [administration](../pact/administration.md) · **Release checks:** A08, L04

**Implement / deliver**

- Dedicated administrator setup/sign-in using staff role, password-only authentication and existing human sessions, with no kingdom or gameplay grant.
- System-wide committed metrics, trends, player directory, exact aggregate resource ledger, diplomacy, agent observations and operational queues.
- Audited moderation management through existing handlers, responsive dashboard, synthetic verification and server deployment.

**Acceptance**

- [x] Administrator first setup is host-authorized, bounded and single-use with username/password only; role/session expiry, revocation and agent/player denials pass without creating kingdom state or fake MFA stamps.
- [x] Metrics are product-scoped, consistent read-only snapshots; exact units, windows, pagination, empty/error states and privacy boundaries pass.
- [x] Dashboard navigation, refresh, login/logout, setup, management and mobile rendering verified with synthetic data.
- [x] Full relevant checks, durable runbook/report, verified local commits, backup and canonical server deployment checks complete.

**Assignee:** codex-admin-dashboard-20261014

**Evidence**

- docs/implementation/reports/admin-dashboard-20261014.md
- Verified source e20b17a; full build/types/lint, 360 unit and 387 integration passed (one optional provider skipped); actual synthetic desktop/mobile browser and HTTP acceptance.
- Release admin-dashboard-20261014-1: encrypted backup 4a37e125, exact image-layer match, current migrations/privacy replay, canonical verify and public staff gates, active tick 24714 to 24715; only API/gateway replaced.
- Initial independent administrator setup is delivered privately for founder password/authenticator entry; no kingdom or real credential was created by the agent. Linear connector requires reauthentication; local evidence is the assignment record.
- Founder explicitly requested password-only administrator setup/login on 14 October; correction tracked in reports/admin-password-login-20261014.md. Previous deployment evidence remains historical.
- Password-only correction f4c856c released as admin-password-20261014-1: full build/types/lint, 360 unit and 387 integration plus new migration fixture passed; migration 0065, backup cd3c3823, deployed source/asset hashes, canonical verification and actual public browser passed.
- Push reconciliation: remote PACT-167 already owns kingdom discovery and PACT-168 owns optional A2A; administrator assignment renumbered to PACT-169 without changing deployment or scope.

<a id="pact-170"></a>
## PACT-170 — Worldwide agent discovery, communication readiness and account autonomy

**Status:** in_progress · **Role:** Application · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-133](phase-3-season-one.md#pact-133), [PACT-146](phase-3-season-one.md#pact-146), [PACT-150](phase-3-season-one.md#pact-150), [PACT-167](phase-3-season-one.md#pact-167)

**Components:** packages/contracts, packages/kingdom, services/api, Fleet PACT adapter/runtime/console.

**Specification:** [social](../pact/social.md), [chatgpt](../pact/chatgpt.md), [privacy](../pact/privacy.md), [runtime](../pact/runtime.md), [architecture](../pact/architecture.md) · **Release checks:** R08

**Implement / deliver**

- Deploy scoped worldwide discovery to the authoritative game API/MCP and expose existing public agent activity observations with contact-route facts and explicit uncertainty, without private peer authority or online guarantees.
- Remove legacy Fleet cohort-name discovery bias, persist global pagination and apply founder-selected account-autonomy guidance to both existing Windows fleets while preserving accounts, historical preferences, budgets, ledgers, pending receipts and five-minute anchors.

**Acceptance**

- [ ] Authenticated shared discovery returns actual worldwide identities and existing public agent activity/contact readiness; self, blocks, scope and privacy remain enforced, with no inferred availability or forced contact.
- [ ] Legacy and new discovery paths avoid cohort filters, retain honest pagination/coverage, and can deliver peers outside both fleets within unchanged decision budgets.
- [ ] Both fleets resume verified committed runtimes at a quiescent boundary with unchanged original identities, histories, model/budget configurations, usage and schedule anchors; original controller profiles remain audit history while active guidance follows account owners.
- [ ] Relevant synthetic unit/integration/build/type/migration checks and actual deployment/tool/context/first-round acceptance pass, with durable reports and honest tracker limitations.

**Assignee:** codex-worldwide-discovery-20261014

**Evidence**

- Assigned by founder on 14 October: broaden both fleets to whole-game discovery and neutral account-agent behavior with preserved identities/history/five-minute schedule. Linear read failed with connector reauthentication required; no remote issue or claim invented.
- reports/worldwide-agent-discovery-20261014.md
- Verified PACT 362 unit / 410 integration (+1 existing optional skip), full build/type/lint/contracts; exact release composition 11 discovery tests. Fleet 109 unit / 164 integration, build/check/boundaries and zero production audit findings.
- Deployed PACT worldwide-discovery-20261014-1 with 927 source/compiled SHA256 readbacks; no PACT migration/A2A activation. Fleet 406d64b preserves twenty original accounts, all historical terminal records, Nemotron/Laya settings and original five-minute anchor. All twenty scheduled agents received actual fitted world-discovery/readiness candidates.
- Reopened on 14 October after founder-requested failure investigation: the deployed Fleet accountObjective reads world.profile.ambition although real PACT exposes world.ambition, and cognition recall still seeds from historical controller strategy. The earlier first-round/synthetic acceptance missed this actual contract and growing-packet pressure. Worldwide discovery/readiness delivery remains verified; original accounts/history/settings/schedules remain unchanged. Research and prototype evidence is in sibling Fleet docs/fleet-failure-investigation-20261014.md and reports/windows-fleet-comparison-20261014.md. No remote Linear status update claimed; connector needs reauthentication.

<a id="pact-171"></a>
## PACT-171 — Faithful owned intent

**Status:** done · **Role:** Application · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053)

**Components:** packages/contracts, packages/kingdom, packages/application, packages/authority, packages/oauth.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** R08

**Implement / deliver**

- Implement AR-P01 from docs/implementation/agent-reliability-consolidated-plan-20261015.md using shared authoritative operations; synthetic/offline scope only.

**Acceptance**

- [x] A real-layout fixture exposes root ambition; a wrong-profile fixture cannot certify intent delivery. Empty/missing intent is explicit, not a fabricated strategy.
- [x] Contract tests cover a changed owner objective, owner/audience scoping and compatible older responses. Changes propagate to the inputs checked in AR-F01.
- [x] Documentation identifies the owning projection and version policy without changing a live account's ambition or authority.

**Assignee:** codex-agent-reliability-20261015

**Evidence**

- Source/offline implementation explicitly assigned by founder on 15 October. No deployment, running-fleet change or new model experiments.
- Linear read failed with UNAUTHORIZED/reauthentication required; local claims only.
- docs/implementation/reports/agent-reliability-intent-20261015.md
- PACT 364 unit / 410 integration (+1 existing optional skip), full build/typecheck/lint/contracts; Fleet 111 unit /166 integration, check/build/boundaries and zero production audit vulnerabilities.

<a id="pact-172"></a>
## PACT-172 — Canonical operations and schemas

**Status:** todo · **Role:** Application · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-171](phase-3-season-one.md#pact-171)

**Components:** packages/contracts, packages/kingdom, packages/application, packages/authority, packages/oauth.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** R08

**Implement / deliver**

- Implement AR-P02 from docs/implementation/agent-reliability-consolidated-plan-20261015.md using shared authoritative operations; synthetic/offline scope only.

**Acceptance**

- [ ] Export/catalog parity covers admitted reads/actions and their exact required fields, additional-property policy and version requirements. Compatible old clients retain documented behavior; unsupported versions fail precisely.
- [ ] Four archived synthetic bad calls and a legitimate building command remain a shared acceptance corpus. Fleet rejects the bad calls at its generation/validation boundary while PACT independently rejects any that reach it.
- [ ] Invented conversation names, extraneous action `summary` and missing message body yield bounded field/schema-specific diagnostics. No transport implements a second permission gate or game engine.

**Evidence**

- Source/offline implementation explicitly assigned by founder on 15 October. No deployment, running-fleet change or new model experiments.
- Linear read failed with UNAUTHORIZED/reauthentication required; local claims only.

<a id="pact-173"></a>
## PACT-173 — Scoped semantic reference facts

**Status:** todo · **Role:** Application · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-172](phase-3-season-one.md#pact-172)

**Components:** packages/contracts, packages/kingdom, packages/application, packages/authority, packages/oauth.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** R08

**Implement / deliver**

- Implement AR-P03 from docs/implementation/agent-reliability-consolidated-plan-20261015.md using shared authoritative operations; synthetic/offline scope only.

**Acceptance**

- [ ] Controls cover outgoing, nonexistent, expired, wrong-type and stale-version targets; revoked delegation; unavailable/incorrect troops; and a valid incoming answer/scout target.
- [ ] UUID syntax and semantic eligibility are tested separately. Nil/placeholder receipt IDs do not establish a command, uncertainty or ownership.
- [ ] Authorized projections expose sufficient follow-up references without leaking another account's requests, units, private offers or receipts. Fake-ID enumeration has no private-state oracle.
- [ ] Shared fixture roles/direction agree with AR-F03; no bad reference is silently replaced with a guessed valid one.

**Evidence**

- Source/offline implementation explicitly assigned by founder on 15 October. No deployment, running-fleet change or new model experiments.
- Linear read failed with UNAUTHORIZED/reauthentication required; local claims only.

<a id="pact-174"></a>
## PACT-174 — Executable compact observation sections

**Status:** todo · **Role:** Application · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-173](phase-3-season-one.md#pact-173)

**Components:** packages/contracts, packages/kingdom, packages/application, packages/authority, packages/oauth.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** R08

**Implement / deliver**

- Implement AR-P04 from docs/implementation/agent-reliability-consolidated-plan-20261015.md using shared authoritative operations; synthetic/offline scope only.

**Acceptance**

- [ ] Forecast-only and construction/request/agreement reads are executable against their published schemas. Agent 08's requested forecast can reach AR-F04 under the existing 24,000-byte full-envelope allowance.
- [ ] Paging/omissions distinguish unknown records from empty collections; required terms, parties, direction, versions, deadlines and signature status remain whole when delivered.
- [ ] Ownership, revoked access, stale cursor/version and privacy controls pass. Older broad reads remain compatible under a reviewed additive/versioned contract.
- [ ] Large shared histories are read selectively; compact views do not create a new private message store or misleading complete-coverage claim.

**Evidence**

- Source/offline implementation explicitly assigned by founder on 15 October. No deployment, running-fleet change or new model experiments.
- Linear read failed with UNAUTHORIZED/reauthentication required; local claims only.

<a id="pact-175"></a>
## PACT-175 — Canonical outcomes and lifecycle evidence

**Status:** todo · **Role:** Application · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-172](phase-3-season-one.md#pact-172)

**Components:** packages/contracts, packages/kingdom, packages/application, packages/authority, packages/oauth.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** R08

**Implement / deliver**

- Implement AR-P05 from docs/implementation/agent-reliability-consolidated-plan-20261015.md using shared authoritative operations; synthetic/offline scope only.

**Acceptance**

- [ ] A committed queue receipt can coexist with waiting/active work; a later completion is separately observed. Agreement signatures, activation and fulfillment/end are distinct states.
- [ ] Known rejection, ordinary failed read, absent receipt and genuinely unresolved command remain distinct. An absent receipt does not fabricate a commit or uncertain-command record.
- [ ] Duplicate events, lost acknowledgment, expired cursors and replayed receipt reads converge without duplicate effects. Existing IDs/history remain usable.
- [ ] Outcomes are scoped and versioned; migration/retention plans preserve existing receipts and registered data classes, without logging private prompts.

**Evidence**

- Source/offline implementation explicitly assigned by founder on 15 October. No deployment, running-fleet change or new model experiments.
- Linear read failed with UNAUTHORIZED/reauthentication required; local claims only.

<a id="pact-176"></a>
## PACT-176 — Complete admission and construction quotes

**Status:** todo · **Role:** Application · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-173](phase-3-season-one.md#pact-173), [PACT-174](phase-3-season-one.md#pact-174), [PACT-175](phase-3-season-one.md#pact-175)

**Components:** packages/contracts, packages/kingdom, packages/application, packages/authority, packages/oauth.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** R08

**Implement / deliver**

- Implement AR-P06 from docs/implementation/agent-reliability-consolidated-plan-20261015.md using shared authoritative operations; synthetic/offline scope only.

**Acceptance**

- [ ] Reproduce all 106 historical Luna quota refusals with correct spend/reservation/game-time accounting; include Agent 02/32 reservation cases and within-limit positive controls.
- [ ] Reproduce all seventeen local waiting orders: twelve LLM-only and five cognition orders, with overlapping stock/prerequisite counts. ZERO Iron/Silver reserve floors are not labelled a positive restriction. Completed Mine/Wall controls establish normal start/settlement.
- [ ] Waiting reserves authority, not stock. Concurrent construction can consume usable stock; queue admission, waiting, active and completed are distinct. Show all limiting conditions and conditional game-time release/ETA, including paused-clock behavior.
- [ ] Stale/racing quotes fail safely at admission without duplicate stock/spend/receipt effects. No cancellations, ceiling relaxation, new economy or second client permission system is inferred from legitimate waits.

**Evidence**

- Source/offline implementation explicitly assigned by founder on 15 October. No deployment, running-fleet change or new model experiments.
- Linear read failed with UNAUTHORIZED/reauthentication required; local claims only.

<a id="pact-177"></a>
## PACT-177 — Precise authentication and recovery evidence

**Status:** todo · **Role:** Application · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-172](phase-3-season-one.md#pact-172), [PACT-175](phase-3-season-one.md#pact-175)

**Components:** packages/contracts, packages/kingdom, packages/application, packages/authority, packages/oauth.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** R08

**Implement / deliver**

- Implement AR-P07 from docs/implementation/agent-reliability-consolidated-plan-20261015.md using shared authoritative operations; synthetic/offline scope only.

**Acceptance**

- [ ] Fixtures cover connection refused before processing, generic 502 with ambiguous processing, rotation with lost acknowledgment, concurrent refresh, revoked grant/family and stale fences.
- [ ] Agent 17's dated incident retains the connection-refused/unused-token evidence. A generic 502 alone is not proof of nonexecution and cannot authorize retry.
- [ ] Only confirmed nonexecution permits a bounded safe retry under the same account. Unknown rotation requires quarantine/reconnect preserving identity/history; unknown commands use original pending receipts, without replay or fabricated usage.
- [ ] Ordinary not-found reads and explicit denials are precise noncommit outcomes. Shared OAuth/receipt services remain authoritative; recovery evidence is minimal, scoped and retained under policy.

**Evidence**

- Source/offline implementation explicitly assigned by founder on 15 October. No deployment, running-fleet change or new model experiments.
- Linear read failed with UNAUTHORIZED/reauthentication required; local claims only.

<a id="pact-178"></a>
## PACT-178 — Actionable social lifecycle views

**Status:** todo · **Role:** Application · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-174](phase-3-season-one.md#pact-174), [PACT-175](phase-3-season-one.md#pact-175), [PACT-176](phase-3-season-one.md#pact-176), [PACT-177](phase-3-season-one.md#pact-177)

**Components:** packages/contracts, packages/kingdom, packages/application, packages/authority, packages/oauth.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** R08

**Implement / deliver**

- Implement AR-P08 from docs/implementation/agent-reliability-consolidated-plan-20261015.md using shared authoritative operations; synthetic/offline scope only.

**Acceptance**

- [ ] Scripted isolated beneficial and bad trades exercise delivery, response, signatures, activation, fulfillment/end and valid decline/solo play; compare material benefit to a stated solo baseline.
- [ ] Deadline controls cover two-decision cross-turn handoffs, game-clock pauses and opportunity delivery before expiry. Seeing a peer-read notice alone cannot count as full actionable offer delivery.
- [ ] Fake IDs, wrong participants, stale terms/version, revoked access and private outsider data fail safely. Public presence does not promise a reply.
- [ ] Preserve the 13 October 19-to-17 gift's four eligible turns and unresolved full-term delivery. Six-hour/zero-notice terms are valid; the exact malformed fields in Agent 03's failed offers remain unknown. No settlement bug, outreach quota, autoaccept, partner class or advertising is inferred.

**Evidence**

- Source/offline implementation explicitly assigned by founder on 15 October. No deployment, running-fleet change or new model experiments.
- Linear read failed with UNAUTHORIZED/reauthentication required; local claims only.

<a id="pact-179"></a>
## PACT-179 — Goal and authority feasibility

**Status:** todo · **Role:** Application · **Size:** M · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-176](phase-3-season-one.md#pact-176), [PACT-178](phase-3-season-one.md#pact-178)

**Components:** packages/contracts, packages/kingdom, packages/application, packages/authority, packages/oauth.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** R08

**Implement / deliver**

- Implement AR-P09 from docs/implementation/agent-reliability-consolidated-plan-20261015.md using shared authoritative operations; synthetic/offline scope only.

**Acceptance**

- [ ] Every declared test goal is feasible under its actual stock/prerequisite/authority path or has an explicit unresolved owner decision. Prohibited objectives are not scored as agent failure.
- [ ] Quote arithmetic distinguishes whole resource units from ledger units, full ceiling from rolling headroom, and I–II/III–IV/V–VI comparison bands from promotion payouts.
- [ ] Unsupported territory expansion and autonomous Court lifecycle are labelled unavailable. Political/economic rule changes require a separate reviewed product/specification assignment.
- [ ] An approved authority alternative would need scoped fixtures, versions and rollback; this plan changes no mandate, rules, account or permission.

**Evidence**

- Source/offline implementation explicitly assigned by founder on 15 October. No deployment, running-fleet change or new model experiments.
- Linear read failed with UNAUTHORIZED/reauthentication required; local claims only.

<a id="pact-180"></a>
## PACT-180 — Controlled world and incentive evaluation

**Status:** todo · **Role:** Application · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-179](phase-3-season-one.md#pact-179)

**Components:** packages/contracts, packages/kingdom, packages/application, packages/authority, packages/oauth.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** R08

**Implement / deliver**

- Implement AR-P10 from docs/implementation/agent-reliability-consolidated-plan-20261015.md using shared authoritative operations; synthetic/offline scope only.

**Acceptance**

- [ ] Scenario definitions, independent units of comparison, randomization/replication and held-out cases are fixed before results. Shared-world interference is not presented as independent-agent causal evidence.
- [ ] Measure legal goal completion, material kingdom benefit versus solo, fulfilled obligations, justified waits, latency, stage-specific failures and denominators, and token/call cost per useful outcome. Message count is not a target.
- [ ] Farm I's 30 Grain/hour minus eight Guard upkeep and absence of a promotion payout are baseline facts, not proof that profitable cooperation is impossible or Luna intrinsically fails.
- [ ] Future privacy-safe instrumentation records field paths, schema IDs and delivery coverage with minimal retention, not raw private prompts/secrets. Exact invalid-offer fields and historical model-visible term coverage remain unresolved until new authorized evidence exists.
- [ ] Any economic/political variant requires explicit reviewed specifications and bounded experiment authorization; no rule change or live run is a plan default.

**Evidence**

- Source/offline implementation explicitly assigned by founder on 15 October. No deployment, running-fleet change or new model experiments.
- Linear read failed with UNAUTHORIZED/reauthentication required; local claims only.

<a id="pact-181"></a>
## PACT-181 — Reviewed game rollout and preservation

**Status:** todo · **Role:** Application · **Size:** L · **Type:** implementation

**Delivery track:** chatgpt · [Approved Alpha scope](../pact/alpha.md)

**Depends on:** [PACT-053](phase-1-rules.md#pact-053), [PACT-180](phase-3-season-one.md#pact-180)

**Components:** packages/contracts, packages/kingdom, packages/application, packages/authority, packages/oauth.

**Specification:** [architecture](../pact/architecture.md), [runtime](../pact/runtime.md), [privacy](../pact/privacy.md), [chatgpt](../pact/chatgpt.md) · **Release checks:** R08

**Implement / deliver**

- Implement AR-P11 from docs/implementation/agent-reliability-consolidated-plan-20261015.md using shared authoritative operations; synthetic/offline scope only.

**Acceptance**

- [ ] Rehearsed migrations/rollback preserve account/kingdom bindings, mandates, receipt IDs, jobs, history, original schedules/anchors/models/budgets and unknown allocations. Rolling back code does not undo committed game effects or restore an old database over newer transactions.
- [ ] Canary acceptance includes multiple rounds with growing memory and authoritative progression/obligation readback, rather than first-round delivery alone. Results are separately recorded for fifty Luna and twenty local agents.
- [ ] Pending/unknown states retain originals and their required review. Terminal populations remain terminal; no new accounts or restart is implicit.
- [ ] Implementation, hosted tests, experiments, deployment and push each require their covering assignment. Saving this plan authorizes none of them.

**Evidence**

- Source/offline implementation explicitly assigned by founder on 15 October. No deployment, running-fleet change or new model experiments.
- Linear read failed with UNAUTHORIZED/reauthentication required; local claims only.
