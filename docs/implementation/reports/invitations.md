# PACT-055 — Contact and Court invitation destinations

Ticket: [PACT-055 / MNI-120](https://linear.app/mnim/issue/MNI-120/pact-055-implement-every-invitation-destination-and-redemption-rule).
Implementation revision: `796446e`; Linear completion comment `f23b886e-9b0f-4a7c-bd47-96e0b3cae837`. Both current Alpha acceptance checks and Done were read back; original postponed checks remain unchecked. Tracker overview and assignment guide were reconciled to 60 Done, 11 remaining Alpha Todo and 28 postponed Backlog.
Verified 1 October 2026 with Node 24.19.0, npm 11.19.0 and local PostgreSQL 17 on disposable schemas.

## Result

The Alpha invitation scope is implemented: public previews, contact/Court explicit human acceptance, first-draft destination preservation, truthful expired/revoked/full/unavailable states, shared issuance limits and retry-safe atomic redemptions. The web application has an anonymous invitation landing panel, an acceptance button and founder contact-link creation/revocation controls. The agent's diplomacy guide explains the human handoff and correctly advertises existing exact-handle lookup.

Court invitation acceptance uses real `courts` / `court_memberships` tables and the application command path, not a successful fake membership. Court fixtures are seeded explicitly in integration tests because Court creation, requests, role management, ownership transfer, rosters and the fuller Court UI belong to the next PACT-056. The minimal destination store is required scaffolding for this ticket, not completion evidence for PACT-056. Real notice/story records remain PACT-059; their absent adapters fail truthfully. A separate notice-adapter fixture proves deadline semantics only.

## Acceptance evidence

| Current Alpha acceptance | Evidence | Result |
| --- | --- | --- |
| Opening changes no contact/membership; explicit acceptance grants only its destination; duplicate consumes no extra use. | `tests/integration/invitations.test.ts`: anonymous public GET leaves contacts/membership unchanged; contact commits once; real Court HTTP acceptance creates only an ordinary membership, no contact; repeat command returns identical receipt; new acceptance retry after relationship removal/revoke does not recreate it. | Pass. |
| Expired/revoked/full show real status; signup/login retains destination; concurrent last-use accepts one new account. | Same suite: distinct landing statuses and failures; verified unfounded account/draft remembers the first server-resolved destination and refuses a replacement; owner-derived account reads recover it without a token; last-use race yields one acceptance and one `INVITATION_FULL`; distinct Courts racing for a kingdom's third membership yield one acceptance and one `COURT_MEMBERSHIP_LIMIT` without consuming the losing use. | Pass. |

Additional checks cover strict identity-free inputs, other-account receipt/issuance/revoke denial, agent acceptance denial, human cookie/CSRF/origin route handoff, product isolation, reciprocal blocks/self contact rollback, shared legacy/new quotas, hashing/no raw-token receipts/events, genuine version metadata, owner cleanup and future notice game deadlines during a real-clock pause. The Court HTTP test uses a synthetic identity adapter to test transport wiring; existing full-suite identity tests own real session validation. No real credential/session certification is inferred from that fixture.

## Verification

- `npm run build` — pass across existing workspaces.
- `npm run typecheck` — pass.
- `npm run lint` — pass: boundaries, build order, 16 protected schemas. Fifteen existing fingerprints unchanged; additive social-command schema pinned separately.
- `npm test` — 179 passed in 55 files.
- `npm run test:integration -- tests/integration/invitations.test.ts` — 13 passed.
- `npm run test:integration` — 240 passed, one optional local-model skipped, 40 files.
- Backlog render/check and `git diff --check` are recorded in the closing tracker comment after snapshot reconciliation.

The first full integration run caught the smoke test's explicit migration list missing the two new migrations; the list was updated and the full suite rerun. An initial quota query inferred a 32-bit SQL subtraction parameter and failed at epoch-sized game timestamps; explicit bigint arithmetic fixed it. Updating the agent guide also required replacing its stale unit assertion that handle lookup was unavailable. Final passing runs include these fixes. Early runs used the existing npm 10 shim; the final build, typecheck, unit, lint and integration runs used the repository-pinned npm 11.19.0 with Node 24.

## Documentation and limits

[Invitation module/API/operations instructions](../../architecture/invitations.md) document actions, errors, retry/revoke recovery, authority boundaries, owner hooks, migrations and sequencing. No new external dependency, server, model call, paid infrastructure or production-hardening work was introduced. New module export/erasure/retention hooks cover its own tables only; the postponed social privacy project is not certified.

No new VPS deployment, Chrome gameplay observation, hosted CI run, provider certification or enjoyment claim. Hosted release remains `alpha-20260929-4` / `2143d92`. UI tests verify markup/control boundaries, not visual or full browser acceptance; PACT-061/073/080 retain those observations. Link tokens are returned only once and are not recoverable from storage; use receipt IDs to revoke an issuance whose response was lost.

## Handoff

Next backlog-order dependency-ready work: PACT-056 / MNI-121. Reuse `courts`, `court_memberships` and `CourtInvitationDestination`; do not create a parallel membership table or permission path. Extend with separately versioned human command schemas rather than changing published social-command v1. Actual Court creation must insert its owner's membership and enforce both one owned Court and three total memberships. Notice/story adapters later implement `InvitationDestinationPort` in the same transaction and must not fabricate counterpart consent. Final Alpha rehearsal remains open.
