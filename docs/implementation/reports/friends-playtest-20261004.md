# Friends playtest implementation — 4 October 2026

Scope: PACT-127/MNI-221, PACT-128/MNI-222, PACT-129/MNI-223, PACT-130/MNI-224. All 24 original Later items remain deferred.

## Implemented

- Shared URL https://safa.dedyn.io/pact/: nickname/default nickname and Play creates a real guest kingdom. No signup, password, email, verification, or operator token retrieval. Browser identity resumes the same kingdom. Migration 0051 keeps guest email and verification null. The existing ledger creates normal starting resources, troops and buildings.
- Guest browser session authorizes its own Codex connection with one explicit button. Copyable setup, connection status, an explicit bounded-play preset and a first mission live in Envoy. Joining starts no hosted inference. PACT_GUEST_PLAY defaults off and is enabled on the disposable testing deployment.
- A compact next action and both builders appear in the initial phone/desktop viewport. Ambition, records and advanced controls are expandable; empty keepsakes use a hint. Existing generated art, audio and flavour are reused.
- Three deterministic upgrade suggestions show actual catalog benefit, cost, duration and blockers. Fresh-state submission chooses a free builder and retains existing server rules/receipts. Queued/maxed buildings are filtered. Ask my agent copies a prompt without executing it.
- People lists actual guest kingdoms, 20 per page, excluding self/hidden/retired profiles. Copy game link returns the common URL. Contact/message drafts remain editable and explicit. Trade discussion does not sign anything. Advanced lookup and diplomacy remain available.
- Sound engine stays mounted across tabs. New recorded outcomes can appear in the existing status notice; full moments remain expandable.

## PACT-127 evidence

Two independent Chrome contexts (1440x900 and 390x844) joined with nicknames only and reloaded into the same distinct kingdoms. No email was fabricated or sent. Guest integration tests verify identity, stable CSRF, duplicate founding prevention, public neighbor projection and separation of owner/public views.

Actual Codex CLI 0.160.0 used DCR/PKCE login with the remembered guest browser. The no-browser option let the automated harness follow the same authorization page; no PACT password or server-issued token was manually extracted. OAuth credentials stayed in a private temporary Codex home.

A gpt-6-luna run, low reasoning, capped at eight upstream inference requests, identified gprofessort_834c9012 and committed Farm II in slot 1. Receipt 4d7fe4f3-4478-4aa9-aacc-76e7bd86be2c. Six game tool calls, eight provider requests, all HTTP 200; no over-budget call. Usage: 195950 input tokens, 168960 cached input, 500 output. Existing Codex subscription was used; no dollar charge was returned. Hosted inference remains disabled.

## PACT-128/129 evidence

Initial next-action card stayed within the first viewport at both sizes without horizontal overflow. Both builders sit immediately after it. Live phone player queued Farm II in slot 1 and Mine II in slot 2; the desktop agent used slot 1 while slot 2 stayed free. UI numbers matched normal server costs and ten-game-minute duration.

Fixtures cover fresh/build/completed/pending approval decisions; suggestion tests cover catalog values, max/queued exclusions, resource and Hall blockers, and zero/one/two busy slots. Browser walkthrough found and fixed clipped phone art and excessive prominence of ambition/advanced social controls.

## PACT-130 evidence

Both guest browsers discovered each other through People without UUID or handle entry. Local integration additionally creates 100 model-free guests, ten concurrent joins per batch, and checks pagination without duplicates or private fields. This found a real transaction contention failure; bounded whole-join retry now preserves the same guest key and founding state.

Live contact request and recipient acceptance both returned COMMITTED, followed by two COMMITTED messages in opposite directions. Incoming contact changed the recipient's next-action card. Copy game link returned https://safa.dedyn.io/pact/. Discuss a trade populated the editable draft while message/offer/contract counts stayed unchanged.

Final owner views show desktop Farm II complete and both slots free; phone Farm II and Mine II complete and both slots free. This used real production and game time. Final release friends-play-20261004-3 passed operator deployment verification; API, rules, seals, inference, notification, channel and gateway run that image with zero restarts. PACT_GUEST_PLAY=1; hosted live model calls remain disabled.

Final browser sweep: Kingdom, Envoy, People and Chronicle at both 1440x900 and 390x844 had no horizontal overflow or JavaScript errors. Keyboard Enter reveals advanced building details. A third fresh guest used the default nickname and resumed after reload. Simulated player-list outage showed the unavailable message and recovered using Refresh players.

Evidence: reports/evidence/friends-play-{report,agent,connect-result,social-result,states,final-checks}.json; friends-play-{1440,390}-{fresh,final,conversation}.png; friends-play-server-20261004.json. Replay harnesses contain no embedded credentials; private browser/OAuth state stays outside the repository.

Validation: typecheck, lint, build, 281 unit tests and 319 integration/smoke tests pass; one existing optional live-model baseline is skipped. All 26 published schemas remain unchanged. Backlog render/check and git diff --check pass. Existing style and bundle-size warnings remain. No CI, commit, push or PR was claimed.

## Pacing and limits

The existing economy is preserved: founding allowance pays construction, while contact requests cost 2 ordinary Silver. A fresh Market I earns this in twelve game minutes. The UI now explains this and disables an unfunded request; construction can begin immediately. This remains a noticeable social pacing choice for the friend pilot, not an email or account barrier.

Construction resolves through the real world clock, not an optimistic animation or fabricated completion. Browser/agent tests establish functional playability, not independent human enjoyment. The local 100-guest check is not certification of 100 concurrent paid agents. No production, native-device or external notification-channel certification is claimed.

## Reproduce

Run npm run typecheck, npm run lint, npm test, npm run test:integration and npm run build. Start local PostgreSQL with npm run db:up. Backlog validation: python3 docs/implementation/backlog.py render and check. Guest integration uses an isolated migrated schema and is removed by suite teardown.

Set PACT_GUEST_PLAY=1 on a disposable deployment with the normal API origin/cookies. Guest storage is browser-specific; a fresh browser or cleared browser data starts fresh. No cross-device recovery is provided. The agent must authorize in the browser holding the intended kingdom.

Official OAuth reference consulted for the live Codex check: https://developers.openai.com/plugins/build/auth. Observed client behaviour above comes from the actual run.
