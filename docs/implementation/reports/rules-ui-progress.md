# PACT-048 — rules UI progress

Ticket: [PACT-048 / MNI-112](https://linear.app/mnim/issue/MNI-112/pact-048-build-the-plain-rules-prototype-interface). In Progress, 26 September 2026. Implementation revision: see repository history.

## Implemented increment

Replaced the synthetic setup demo at the web root with account login/verification/founding and four text-first game areas. Owner/public world reads, inbox/approval/report reads, and manual game writes use the existing scoped API and generated SDK. The UI offers construction, training, contact, messages, transfer, supply offers/signing, scout, garrison offers/signing, and raid declarations/participation; it displays receipts and refreshes from committed state. Telegram account-link confirmation and account export/closure remain reachable. See [Alpha web controls](../../operations/alpha-web.md).

## Acceptance state

| Criterion | Evidence | Result |
| --- | --- | --- |
| Two test players found, develop, negotiate, trade, scout, lend, raid, inspect losses, and rebuild through UI | Browser and deployed two-account walkthrough still required; pending offers/reports currently use explicit IDs | **Not yet passed.** Static build and API integration tests alone do not prove this sequence. |
| Manual actions usable without providers; cannot bypass stock, charge, lock, or limits | UI calls shared human command SDK; server integration suite covers authorization and transactional rules; disconnected-provider browser walkthrough pending | **Partially evidenced.** No independent client authority was added; actual browser flow not yet observed. |

Local checks: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (120 passing), and `npm run test:integration` (174 passing) on PostgreSQL 17 passed on 26 September. Release `alpha-20260926-3` is live on the single VPS and `verify.sh` passed. PACT-048 remains In Progress in Linear and the local snapshot.

## Live playtest, 26 September

Two synthetic accounts were created and verified through the deployed captured-email flow without recording a token. Aster Vale was founded in the in-app browser; Briar Keep was founded through the public API as the second player. The browser committed a Farm II construction order and showed the allowance decrease and occupied builder slot. Immediate training and contact attempts were rejected because ordinary resources started at zero; the client had incorrectly displayed both as `INVALID_RESPONSE`. The SDK now reads the top-level code from non-2xx game receipts, so `INSUFFICIENT_STOCK` is visible. A kingdom ID is now displayed in the header, and the UI offers re-sign-in for a new tab's CSRF token.

After ordinary Silver accrued, Aster Vale's contact request committed with a 1.2 Silver charge; Briar Keep accepted it, then sent a message, all through the public API. Both `/v1/inbox` reads returned no social item. Graph tracing found no application caller of `SocialService.listMessages`; the existing inbox is an Envoy event stream, not the social read path. This means the web UI cannot discover a pending contact, read the received message, or share offer IDs in-game. Switching away from People also clears the manually entered target ID. A browser `window.confirm` during a supply-offer attempt stalled the in-app browser automation; no offer result is claimed. This playtest does **not** satisfy the two-player UI acceptance or establish that raids/trade/report flow is playable.

Qualitative verdict: founding and the first build provide a brief sense of progress, but the current Alpha is not yet fun to play with a friend. The first-session resource wait, UUID entry, raw JSON profile, and invisible social loop turn play into an operator exercise. The next work should expose authorized contact/message/offer reads and exact IDs in the UI, then repeat the complete two-player browser sequence before marking PACT-048 done.

## Next verification

Deploy a pinned Alpha revision to the single VPS, create two distinct synthetic test accounts through the captured-email flow, run the exact two-player sequence in the browser, and capture receipt/report IDs and a failed overspend/locked-action result without sensitive content. Fill any UI gaps found, rerun tests, then mark Done only if both acceptance items pass. Do not contact external testers or enable paid model calls as part of this check.
