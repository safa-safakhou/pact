# Destination invitations

PACT-055 adds contact/Court links using `InvitationService`, `CourtInvitationDestination` and the shared `CommandDispatcher.dispatchSocial`. The original gameplay v1 schema is unchanged; the additive `pact.social-command.v1` input is pinned separately. Later action families require a new versioned export rather than changing this published schema.

## Human flow

Open the web application with `?invite=<opaque token>`. Anyone can preview the destination/status. Opening, signing up, logging in or founding a kingdom does not accept a relationship. An authenticated draft saves the first valid server-resolved invitation; a different browser/query string cannot replace it. The server stores the invitation ID, not the token or a redirect URL. After founding, **Accept contact/invitation** explicitly consumes a use and establishes only that destination. An existing founder opening another link sees that link, not their old signup destination. A saved destination can also be read without the original URL.

Founders can create a contact link and revoke it from the web panel. Court invitation issuance is available through the same human command endpoint for an existing Court owner/moderator; Court creation/management/rosters and their fuller UI are PACT-056. The minimal Court store here is required to implement real Court invitation redemption, not evidence that Court management already exists. Court membership counts include owned Courts; at most three active memberships per kingdom. No resources, army, contracts, contacts or allegiance are created by joining.

Agents may inspect a public link using the HTTP projection, but must hand acceptance to their human. No MCP write scope authenticates human consent. PACT-099 owns unified agent discovery of every social feature; PACT-059 owns real notice/story records. Missing destination handlers fail `DESTINATION_UNAVAILABLE`, never fabricate successful membership/conversation/story.

## HTTP and commands

- `GET /v1/invitations/:token`: public no-store preview; a valid human cookie adds only that account's `accepted` flag. Invalid/stale human sessions fall back to the public preview. Invalid token format is 400; a well-formed unknown token returns `status: unknown`.
- `GET /v1/invitations/remembered`: authenticated no-store `{invitation: view|null}`.
- `POST /v1/social/commands`: existing human cookie, CSRF and origin checks. Body below; no caller identity is accepted. Returns `{receipt, result}`. Standard `/v1/receipts/:commandId` reconciles the same receipt journal.

```json
{
  "schemaVersion": "pact.social-command.v1",
  "commandId": "00000000-0000-4000-8000-000000000001",
  "action": {
    "kind": "invitation.issue",
    "destinationType": "contact",
    "destinationId": "00000000-0000-4000-8000-000000000002",
    "redemptionLimit": 1
  }
}
```

The contact destination must be the authenticated founder's kingdom. Court issuance requires ownership/moderator role. Other actions are `invitation.revoke` with `invitationId`, `invitation.remember` / `invitation.accept` with `token`, and `invitation.accept-remembered` with no selector. A new command ID represents a new deliberate action; transport retries retain the original ID. Cross-account receipt IDs fail. Changed payloads return `IDEMPOTENCY_CONFLICT`. A paused world returns `WORLD_PAUSED` without committing.

Issuance returns `{invitationId, token}` **once**. Only the SHA-256 digest of the random 192-bit token is stored. Retries return the existing receipt with `result:null`; the token cannot be recovered from storage. If the initial response is lost, revoke the invitation ID in the receipt's `recordVersions` and create a fresh link deliberately. Tokens never enter receipts, outbox payloads or request logs. Do not paste real links into source fixtures.

Statuses are `available`, `expired`, `revoked`, `full`, `unavailable`, `unknown`. An old public destination may remain viewable after link expiry/revocation; viewing it is not permission to join. An already accepted account receives its original acceptance even after expiry/revoke; retry never recreates a separately removed contact/membership. A new account fails the corresponding `INVITATION_*` error. Blocks reject contact acceptance reciprocally; they do not grant Court exclusion or military immunity.

## Transactions, clocks and lifecycle

The world-admitted command transaction commits the relationship, redemption count, account redemption, command receipt and outbox event together. Per-link row locking protects last-use races. Court joins lock the recipient kingdom across different Courts so simultaneous links cannot bypass the three-membership cap. Failed destination effects roll back all use/receipt/event changes. No network work occurs inside transactions.

Contact/private Court links last seven real days, maximum 100 uses; public Court/story links last 30 real days, maximum 10,000. Default is one use. Notice links use only their notice's game-time deadline, capped at 24 game hours; a world pause does not consume game time. Both invitation paths share 20 active links / 20 newly issued links per rolling game day. Redemption never refunds an issuance allowance.

Migrations `0036_destination_invitations.sql` and `0037_court_invitation_destinations.sql` are module-owned/additive. Deploy with the normal migration command before starting the changed API; no live migration/deployment is implied by local tests. `PrivacyService.ownedData` invokes injected owner export/erasure/retention hooks without importing PACT types. Exports exclude token hashes and other accounts' redemptions. Closing an issuer removes their links; contacts/memberships are not canceled by ordinary link revocation. Court owner deletion archives that destination for 30 real days; expired invitation records are retained 30 real days for truthful landing explanations, then removed with dependent redemption/destination pointers. These hooks add only lifecycle coverage for the new tables, not PACT-064's postponed social privacy project.
