# PACT-048 — rules UI progress

Ticket: [PACT-048 / MNI-112](https://linear.app/mnim/issue/MNI-112/pact-048-build-the-plain-rules-prototype-interface). In Progress, 26 September 2026. Implementation revision: pending commit at this writing.

## Implemented increment

Replaced the synthetic setup demo at the web root with account login/verification/founding and four text-first game areas. Owner/public world reads, inbox/approval/report reads, and manual game writes use the existing scoped API and generated SDK. The UI offers construction, training, contact, messages, transfer, supply offers/signing, scout, garrison offers/signing, and raid declarations/participation; it displays receipts and refreshes from committed state. Telegram account-link confirmation and account export/closure remain reachable. See [Alpha web controls](../../operations/alpha-web.md).

## Acceptance state

| Criterion | Evidence | Result |
| --- | --- | --- |
| Two test players found, develop, negotiate, trade, scout, lend, raid, inspect losses, and rebuild through UI | Browser and deployed two-account walkthrough still required; pending offers/reports currently use explicit IDs | **Not yet passed.** Static build and API integration tests alone do not prove this sequence. |
| Manual actions usable without providers; cannot bypass stock, charge, lock, or limits | UI calls shared human command SDK; server integration suite covers authorization and transactional rules; disconnected-provider browser walkthrough pending | **Partially evidenced.** No independent client authority was added; actual browser flow not yet observed. |

Local checks: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (119 passing), and `npm run test:integration` (174 passing) on PostgreSQL 17 passed on 26 September. Release `alpha-20260926-2` is live on the single VPS with the privacy-export URL/CSRF correction; `verify.sh` passed, browser inspection showed the real sign-in and synthetic registration forms, and `scripts/smoke-alpha-api.mjs` passed authenticated owner-view, harmless command/receipt, and inbox checks against the public origin. None of these is a two-player UI certification or hosted CI. PACT-048 remains In Progress in Linear and the local snapshot.

## Next verification

Deploy a pinned Alpha revision to the single VPS, create two distinct synthetic test accounts through the captured-email flow, run the exact two-player sequence in the browser, and capture receipt/report IDs and a failed overspend/locked-action result without sensitive content. Fill any UI gaps found, rerun tests, then mark Done only if both acceptance items pass. Do not contact external testers or enable paid model calls as part of this check.
