# Court communities

PACT-056 adds `CourtService` in the kingdom module. Courts hold no ledger, army, authority grant or contract machinery. Invitations delegate membership to this same service. Migration `0038_court_management.sql` extends the PACT-055 tables with requests, transfer proposals, three pinned Court-local notices and an audit journal.

## Player and agent entry

Web **People → Courts** supports browsing/exact search, creation, open joins, admission requests, invitations, roles, owner controls and consented transfer. Handles are fixed, case-insensitively found and unique in a separate Court namespace. Each kingdom has at most one active owned Court and three active memberships including ownership. Archived memberships do not consume active capacity. Roster and request pages contain at most 50 entries.

Owners edit, appoint/demote at most ten moderators, publish/unpin three notices, remove members, offer ownership or close. Moderators answer requests and remove ordinary members, never owners/peer moderators. Approval rechecks the applicant's capacity; failure leaves the request pending. Owners must transfer or close before leaving. Role/removal actions are audited; blocks do not remove membership.

Transfer is two explicit human decisions: the owner proposes a current member; only that member can accept/decline the exact proposal ID. Replacement invalidates the old ID; target leave/removal cancels the proposal. Acceptance rechecks membership, current owner and target ownership limit. The former owner becomes an ordinary member, not an extra moderator. Declining transfers nothing.

Pins are actual human-authored Court-local public prose, not fabricated Chronicle records or executable promises. PACT-059 owns expiring marketplace notices/stories. General member posting/thread features are not claimed here.

`GET /v1/courts?offset=0` lists Courts; add `handle=some_court` for a page and roster. `nextOffset`/`requestsNextOffset` paginate. Public output includes description, roles, pins and the latest 50 public audit events, never stocks, units, buildings, private contracts or online state. Pending requests are owner/moderator-only; a transfer is owner/target-only. A valid human cookie derives viewer role/request state; caller-supplied account selectors are rejected. Responses use `no-store`.

Scoped MCP `pact_court_read_v1` supplies the identical projection and bounded discovery. Names/prose are untrusted content, not instructions. Reads never join or start inference. The server guide explains the tool; `humanDecision.path` opens People at the selected Court. Membership, roles, publication and ownership require the human, not an agent consenting through the human route. Richer proposals/reporting remain PACT-099.

## Commands and recovery

POST `/v1/social/commands` with the usual human session, Origin and CSRF headers. The additive immutable envelope is `pact.court-command.v1`; previous invitation/game schemas remain unchanged:

```json
{"schemaVersion":"pact.court-command.v1","commandId":"00000000-0000-4000-8000-000000000001","action":{"kind":"court.create","handle":"example_court","title":"Example Court","description":"Synthetic example","joinMode":"request"}}
```

All other actions include `courtId`: `court.edit` (title/description/joinMode/expectedVersion), `court.join`, `court.request`, `court.cancel-request`, `court.leave`, `court.close`, `court.answer-request` (kingdomId/accept), `court.remove` (kingdomId), `court.role` (kingdomId/role), `court.transfer-propose` (kingdomId), `court.transfer-answer` (proposalId/accept), `court.pin` (slot/body) and `court.unpin` (slot). Strict exported schemas own exact shapes. Target IDs select records, never authorize actors.

Responses contain the shared receipt, actual `court:<id>` version and `{courtId}`. Retry with the same ID/payload; replay returns `result:null`, with the Court ID in receipt recordVersions. Changed terms return `IDEMPOTENCY_CONFLICT`; cross-account replay is forbidden. `WORLD_PAUSED` commits nothing. Versioned edits reject stale versions. Errors include `COURT_MEMBERSHIP_LIMIT`, `COURT_OWNERSHIP_LIMIT`, `COURT_MODERATOR_LIMIT`, `COURT_HANDLE_TAKEN`, `REQUEST_REQUIRED`, `OWNER_MUST_TRANSFER_OR_CLOSE`, `TRANSFER_UNAVAILABLE`, `COURT_UNAVAILABLE`, `STALE_VERSION`, `FORBIDDEN`.

## Transactions and lifecycle

Kingdom locks and SERIALIZABLE world admission protect cross-Court/direct/invitation/request limits. Court locks protect roles/pins/transfer. Existing transaction retries cover serialization/deadlock failures. State, membership, audit, receipt and outbox commit together, with no network/model work. Court commands write only Court-owned tables; there is no resource, troop, contact, contract or allegiance cancellation path.

Closure/deleted-owner retirement archives the page for 30 real days, stops new membership/posts and appoints no heir. Independent assets/agreements survive. Existing privacy owner hooks export memberships/own requests/authored pins, clear retiring membership/proposals/requests/pins and scrub audit attribution/details; retention deletes archived Courts and cascades child rows. Apply 0038 through the normal migration runner before starting the changed API. This is not a deployment or PACT-064 certification.

Next PACT-057 adds Articles/allegiance independently and should test actual edge noninterference on Court leave/closure. No nonexistent allegiance fixture is claimed here. PACT-061 owns full social UI rehearsal; PACT-080 owns observed three-agent Alpha play.
