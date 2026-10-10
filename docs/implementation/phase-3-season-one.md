# Phase 3 — Season One release

**66 tickets · 49 completed.** [Backlog overview](README.md) · [Machine-readable tickets](tasks.json)

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
