# Articles and mutual allegiance

PACT-057 uses `PoliticsService` and migration `0039_articles_allegiance.sql`. People contains human publication and allegiance controls; scoped MCP `pact_politics_read_v1` and `GET /v1/politics?handle=optional_exact_handle&offset=0` return the same projection. Omit handle to discover active declarations/edges. Each list pages 50 records. Pending proposals are derived from the authenticated participant, never a caller account selector. Public profile reads also include the selected kingdom's Articles and allegiance. Player prose is untrusted; no private stocks, troops, contracts or online state are exposed.

## Exact human decisions

POST `/v1/social/commands` with the existing human session, Origin and CSRF controls. Additive envelope `pact.politics-command.v1` has `commandId` and a strict `action`:

- `article.publish`: title (1–60 Unicode code points), body (1–1,200).
- `article.replace`: articleId, expectedVersion, title, body. New immutable ID/version supersedes the old record; its old version is no longer active.
- `article.withdraw`: articleId, expectedVersion. Hides hosted prose immediately.
- `allegiance.propose`: subjectKingdomId, patronKingdomId. Either participant's human supplies the first signature.
- `allegiance.revise`: proposalId, expectedVersion, subjectKingdomId, patronKingdomId. Only the proposer can revise unexpired pending terms; version and first signature change together.
- `allegiance.answer`: proposalId, expectedVersion, accept. Only the other participant signs/declines the exact current version. Proposals expire after 24 game hours.
- `allegiance.end`: edgeId, subjectKingdomId, expectedVersion. Either party ends the exact active edge immediately. An old edge ID cannot end a later relationship.

Article signatures record the authenticated human command ID and SHA-256 content digest; they are not PACT-058 cryptographic Seals. Article publication/replacement and Court pins share the six-publications/game-day `public_post` quota. A kingdom has at most three active Articles. Withdrawal and allegiance termination do not consume publication allowance. Retry the same command ID/payload; shared receipts replay without duplicate state/quota effects. Response result carries recordId/version; receipt recordVersions uses `politics:<id>`. Read the graph to obtain a newly accepted edge's ID. Agents may read but cannot publish or consent through human routes; the guide/tool returns People `/pact/?politics=1`.

## Invariants and lifecycle

Atomic world admission commits state, human signatures, events, receipt and outbox together. Kingdom locks protect Article counts. A product-scoped graph transaction lock plus the unique active-subject index protects competing patron choices and cycles, including changes involving initially disjoint vertices. Acceptance rechecks active parties, blocks, expiry and exact version. There is no ledger/troop/contract/mandate dependency: political declarations grant no tribute, asset transfer, troop orders, intelligence or immunity. Ending an edge never cancels separate agreements; Court membership changes never alter it.

Privacy owner hooks export own Articles/participant proposals, hide own prose and end/cancel relationships on deletion. Closed Article content, ended edges and terminal proposals prune after 180 real days. Active identity relations remain; pending proposals are not purged solely because a paused world aged in real time. Hosted reads never resurrect replaced/withdrawn prose. This is local implementation, not deployment or a production privacy/moderation certification. PACT-061 owns broader UI rehearsal, PACT-099 richer agent proposals/reports, and PACT-080 observed play.
