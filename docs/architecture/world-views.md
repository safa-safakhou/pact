# Authorized world views and conditional forecasts

## Public player discovery — PACT-054 Alpha

`WorldViewService.publicProfile(handle)` resolves an exact case-insensitive handle in one repeatable-read snapshot and always calls the public projection, even if the caller owns that kingdom. Only active founded (`ranked`) identities resolve. Missing, unfounded, closing, retired or erased identities return no profile; retained transaction tombstones are not a public account directory. Alpha handles are fixed; rename/history/redirects remain preserved later scope under [Version 1.4](../pact/alpha.md).

Public `GET /v1/people/:handle` and authenticated MCP `pact_player_find_v1({handle})` both return `{found, kingdom, untrustedContent:true}`. A valid missing handle returns HTTP 200 / successful tool result with `found:false, kingdom:null`; malformed handles return HTTP 400 / `INVALID_REQUEST`. Handles are 3–24 ASCII letters/digits/underscores, starting with a letter. Exact means no substring/fuzzy directory. HTTP can be used without a session and is `no-store`; MCP requires `world:read` but no run/write lease. Caller identity selectors are not in the tool schema.

`kingdom` is the existing public profile/world-clock/bounded public-event projection: no stocks, troops, building levels, private contracts, online state or account ID. Player-controlled display names remain untrusted content. The reader lives in the PACT kingdom module; MCP receives an injected product-neutral read port, not database access or a second visibility policy. No schema migration or new retention category is needed: this reads existing records only. New social profile fields arrive with their owning Alpha tickets.

`@pact/kingdom` exports `WorldViewService.read(authenticatedAccountId, targetKingdomId, forecastMinutes?)`. `GET /v1/world/kingdoms/:kingdomId?forecastMinutes=1..60` accepts a human session or a Bearer grant with `world:read`; MCP `pact_world_read_v1` uses the same projection and requires that scope. The adapters derive the viewer account from credentials, never from request arguments. A null account is an anonymous public read inside the service, not the current authenticated HTTP/MCP route. Unknown or malformed kingdom IDs return `null` from the service and 404/400 respectively through HTTP. The horizon is 1–60 committed game minutes.

Each read uses one repeatable-read PostgreSQL snapshot. It reports the last committed game minute and tick sequence; owner reads also expose balance row versions and the last committed outbox event ID. Reads after a command in the same game minute therefore see the new committed balances rather than a cached tick projection. No model key, instruction, private message body, approval content, or raw event payload is selected.

The four audiences are server-derived:

| Audience | Projection |
| --- | --- |
| Public | Decorative profile, world clock, bounded public default/battle references. No live stock, building level, troop composition, private agreement, or model data. |
| Contact | Public projection; relationship is established from the accepted contact table. No extra military/economic access. |
| Participant | Public projection and up to 20 shared supply/garrison/raid IDs and statuses. Details must be read through each record's separate authorization service. |
| Owner | Exact ordinary/founding/locked balances and row versions, buildings, builder slots, living troop placement split by defensive-only Home Guard versus ordinary troops, active training-batch progress/next game-time deadline, upkeep, active supply terms, up to 20 recent own/participating raid IDs, sides, statuses, and deadlines, incoming raids/scouts, bounded private inbox event headers, and a conditional 1–60-minute forecast. |

The forecast starts from committed balances and living troops on every read. It applies production, current/future harvest percentages supplied by the season clock, allowance expiry, owner-before-visitor upkeep, active signed supply flows, and storage caps in the worker's broad phase order. It preserves ordinary and founding allowance amounts separately. Future delivery rows are labeled **assumed**, not promised; funding/reserve defaults, new actions, combat, building completions, and counterparty actions are deliberately not predicted. A closed/defaulted contract disappears from the next read. A battle casualty changes the next read's troop upkeep; a committed loot/stock change alters its starting balance. The current rules worker still uses week-one harvest until PACT-069 installs the configured season clock; its world-view composition must pass that same clock function. Neither a forecast nor a scout report is a live view of another kingdom.

Only event headers are taken from private inbox rows. `occurredAt` is real UTC time; `asOfGameTimeMs` is committed game time. Public event references contain IDs/times, not narrative claims about the cause of a defeat.

Exact scout and raid reports are separate record reads, not fields in a convenience kingdom summary. `GameReportReader` lives in `@pact/kingdom` and delegates to the scout/raid module's authorized read methods; HTTP, MCP, and the inference worker share it. HTTP and MCP require the `world:read` credential scope; an in-app run derives its viewer from its authenticated owner. The scout owner and explicitly shared recipients can read a finished scout report. Raid targets and committed contributors can read participant reports; anyone authenticated with read scope can read a resolved/canceled raid's already-redacted public report. Unknown and unauthorized IDs are indistinguishable to clients. Each request retrieves one report; there is no unrestricted record query or bulk hidden-state export.

The owner raid list is only a navigation/status index, not a private report. It excludes unrelated raids and does not include losses, loot, seed, or another kingdom's current troop/stock state. The web Chronicle uses its IDs to request the separately authorized participant report.

Each owner raid entry also supplies `role` (`leader`, `contributor`, or `defender`) derived from committed identities and `lockGameTimeMs` from the stored declaration, alongside the scheduled resolution deadline. These fields are absent from non-owner projections. Only committed contributors enter this index; withdrawing removes their contribution's navigation entry, while a leader's canceled raid remains visible as history. The UI compares the committed snapshot time to the supplied lock time for guidance, not client wall time or a second authority check. The server still rechecks the withdrawal boundary at commit.

Owner reads include `charges`: scout/raid kind, available/capacity, regeneration interval, next regeneration game time, and retry time when empty. `ActionLimitService.readCharges` projects serial regeneration using the same pure calculation as command admission, at the snapshot's committed game time. It neither locks nor updates charge rows; a read cannot consume/refill a pool. Missing rows produce no fabricated allowance. Public, contact, and participant views exclude charges. Pauses stop game-time regeneration; human and agent surfaces share the same pools.

The owner projection also includes `scouts`, the 20 most recently started operations belonging to that kingdom: `operationId`, `status` (`active` or `completed`), `targetKingdomId`, and `dueGameTimeMs`. This is a navigation index, not an observation report, and is absent from other-account/public projections. Chronicle offers a direct report button for completed operations; the existing report reader still authorizes the read independently. Reloading the page no longer requires retaining a scout receipt ID outside the game.

## Alpha consequence projection (PACT-104)

`WorldViewService.readSelf(accountId)` derives the kingdom from authenticated ownership. Owner projections include `consequences` in the same repeatable-read snapshot: latest 20 build instructions and their terminal state/game times, accepted named contacts, and latest 20 participant supply contracts with exact offer-version signatures, closure/notice state, and per-direction/resource settled installment totals. Sums of due/delivered/overflow are exact marked decimal strings; installment/failure counts and last settlement game time are explicit. Delivered includes overflow: overflow was not credited to the recipient. Pending future flow is never reported as delivery. Unsigned proposals have no contract or installment rows.

Public/contact/other-player projections exclude these private consequences. Web People and Chronicle render the same owner projection; agents read it through self/world and start lessons. Bounded in-app responses mark truncation and retain only the first few records; omitted records are unknown. No additional view data is persisted: existing building/contact/supply records retain their module erasure/export/cascade policies, and reads never mutate totals or create inference.

### External activity reconciliation

`OwnerRecordStates` reads only selected owned builds and party-authorized contact,
offer and contract statuses in a repeatable-read transaction. The world clock is
an injected transaction port. API composition combines these with owner-bound
approval status; the reusable run package only accepts a generic fact resolver.
Original result codes/versions remain historical. Unsupported record kinds are
unknown, not presumed completed. Failed reconciliation marks the view stale and
retains original metadata. No new retained private projection is created.

Owner builders and build/supply consequences include `remainingGameMinutes`,
derived from the same committed snapshot clock. Waiting work without a deadline
returns null; completed/past deadlines clamp to zero. Inactive contracts return
zero. These are display hints, not completion evidence: inspect state and actual
settlement. Agents should report this game duration instead of inventing calendar
conversions; original game timestamps remain available for provenance.

Owned supply offers/contracts also expose `youSend` and `youReceive`, preserving
the signed flow exactly and orienting it to the authenticated kingdom. Raw A/B
terms remain available. Social contact requests label `humanAcceptance` as
`your_owner` for incoming or `counterparty_owner` for outgoing. These labels do
not confer authority; human-only command admission still enforces the decision.

## Targeted discovery — PACT-167

`KingdomDiscoveryReader` owns a single-statement authenticated snapshot over existing public identity/Hall, current notice and public Court records, with relationship facts scoped to the viewer. HTTP/MCP/in-app consumers share this read port. This additive shortlist has no persistence or writes; see [its API/visibility contract](../api/kingdom-discovery.md) and [completion evidence](../implementation/reports/kingdom-discovery-20261013.md). Legacy public profiles and exact-handle views remain unchanged.
