# Authorized world views and conditional forecasts

`@pact/kingdom` exports `WorldViewService.read(authenticatedAccountId, targetKingdomId, forecastMinutes?)`. `GET /v1/world/kingdoms/:kingdomId?forecastMinutes=1..60` accepts a human session or a Bearer grant with `world:read`; MCP `pact_world_read_v1` uses the same projection and requires that scope. The adapters derive the viewer account from credentials, never from request arguments. A null account is an anonymous public read inside the service, not the current authenticated HTTP/MCP route. Unknown or malformed kingdom IDs return `null` from the service and 404/400 respectively through HTTP. The horizon is 1–60 committed game minutes.

Each read uses one repeatable-read PostgreSQL snapshot. It reports the last committed game minute and tick sequence; owner reads also expose balance row versions and the last committed outbox event ID. Reads after a command in the same game minute therefore see the new committed balances rather than a cached tick projection. No model key, instruction, private message body, approval content, or raw event payload is selected.

The four audiences are server-derived:

| Audience | Projection |
| --- | --- |
| Public | Decorative profile, world clock, bounded public default/battle references. No live stock, building level, troop composition, private agreement, or model data. |
| Contact | Public projection; relationship is established from the accepted contact table. No extra military/economic access. |
| Participant | Public projection and up to 20 shared supply/garrison/raid IDs and statuses. Details must be read through each record's separate authorization service. |
| Owner | Exact ordinary/founding/locked balances and row versions, buildings, builder slots, living troop placement, active training-batch progress/next game-time deadline, upkeep, active supply terms, incoming raids/scouts, bounded private inbox event headers, and a conditional 1–60-minute forecast. |

The forecast starts from committed balances and living troops on every read. It applies production, current/future harvest percentages supplied by the season clock, allowance expiry, owner-before-visitor upkeep, active signed supply flows, and storage caps in the worker's broad phase order. It preserves ordinary and founding allowance amounts separately. Future delivery rows are labeled **assumed**, not promised; funding/reserve defaults, new actions, combat, building completions, and counterparty actions are deliberately not predicted. A closed/defaulted contract disappears from the next read. A battle casualty changes the next read's troop upkeep; a committed loot/stock change alters its starting balance. The current rules worker still uses week-one harvest until PACT-069 installs the configured season clock; its world-view composition must pass that same clock function. Neither a forecast nor a scout report is a live view of another kingdom.

Only event headers are taken from private inbox rows. `occurredAt` is real UTC time; `asOfGameTimeMs` is committed game time. Public event references contain IDs/times, not narrative claims about the cause of a defeat.

Exact scout and raid reports are separate record reads, not fields in a convenience kingdom summary. `GameReportReader` lives in `@pact/kingdom` and delegates to the scout/raid module's authorized read methods; HTTP, MCP, and the inference worker share it. HTTP and MCP require the `world:read` credential scope; an in-app run derives its viewer from its authenticated owner. The scout owner and explicitly shared recipients can read a finished scout report. Raid targets and committed contributors can read participant reports; anyone authenticated with read scope can read a resolved/canceled raid's already-redacted public report. Unknown and unauthorized IDs are indistinguishable to clients. Each request retrieves one report; there is no unrestricted record query or bulk hidden-state export.
