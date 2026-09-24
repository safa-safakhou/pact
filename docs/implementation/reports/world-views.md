# PACT-045 — Authorized world views and factual forecasts

Ticket: [PACT-045 / MNI-109](https://linear.app/mnim/issue/MNI-109/pact-045-build-authorized-world-views-and-factual-forecasts)
Implementation revision/PR: uncommitted local checkout at verification time
Verification date/environment: 24 September 2026, Node 24, PostgreSQL 17 synthetic schemas

## Result

An exported, read-only kingdom projection now derives four audiences from the authenticated account and contact/shared-record relationships. Owner reads take one repeatable-read snapshot of balances, buildings/builders, living troops, active supply agreements, threats, private event headers, and a bounded conditional forecast. Public, contact, and participant reads never query or return private state. PACT-049 remains responsible for an HTTP/MCP `world.read` adapter and authenticated account derivation.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Unauthorized IDs and public profiles never expose live stocks, building levels, commitments, or model instructions. | `tests/integration/world-views.test.ts` | Passed locally for anonymous, unrelated account, accepted contact, shared-record participant, unknown ID, and owner projections. Participant gets shared IDs/statuses only. |
| Forecasts label assumed future deliveries, preserve founding-versus-ordinary amounts, and change correctly after default, harvest shift, and overlapping combat. | `packages/kingdom/src/world-views.test.ts`, `tests/integration/world-views.test.ts` | Passed locally for conditional delivery labels, harvest boundary, allowance expiry/ordinary-first upkeep, contract default removal, and recomputation after a committed troop casualty. Overlapping combat itself is verified by PACT-044's raid integration tests; this projection reads its resulting committed troops and balances. |

`npm run build`, `npm run typecheck`, `npm test` (102), `npm run test:integration` (114), and `npm run lint` passed locally. After the final public-event summary change, the kingdom build, targeted world-view integration tests (3), and lint passed. These are local checks, not hosted CI or deployed validation.

## Documentation

[World-view interface and forecast assumptions](../../architecture/world-views.md) and [module map](../../architecture/modules.md).

## Decisions and limitations

Forecast amounts are scenarios, not settlement guarantees; they do not predict defaults, counterparty funding, reserve floors, pending construction/training, or future battles. The test-world rules worker remains on week-one harvest until PACT-069 installs the season clock. No transport route, hosted CI, VPS deployment, or player validation is claimed by this ticket.

## Handoff

PACT-046 is dependency-ready. PACT-049 should compose the read service behind authenticated `world.read`, read-rate limits, and one shared season-clock function; do not accept a claimed audience or account ID in transport payloads.
