# Season One rules catalog and arithmetic

`@pact/domain` owns the pure, versioned `pact-s1-v1` rules catalog in `packages/domain/src/rules-catalog.ts`. Its Zod schema validates deterministic JSON fixtures through `loadRulesFixture`. The published design in `docs/pact/rules.md` remains authoritative; catalog values are executable inputs for later rules handlers, not a second rulebook.

## Units and wire format

- Costs, balances, grants, storage caps, loot capacity, provisions, and contract rates in the catalog are **whole displayed resources** unless a property says otherwise. `grainPerHour`, `ironPerHour`, and `silverPerHour` are whole resources per game hour. Training/construction durations ending in `Minutes`, duration options ending in `Hours`, and the grant expiry ending in `GameDays` use those exact game-time units. `Percent` fields are integer percentages; combat numerators/denominators are exact fractions.
- Authoritative resource arithmetic uses `bigint` **internal units**, with 600 internal units per displayed resource. `wholeResources` rejects fractional, negative, and unsafe JS numbers. `hourlyRatePerMinute` yields exact internal units. Percent floors use integer division.
- Resource quantities crossing JSON boundaries use canonical unsigned base-10 strings: `serializeInternalUnits` and `parseInternalUnits`. Rational power uses `{ numerator: string, denominator: string }` through `serializeRational` and `parseRational`. Do not send a JS number and assume JSON will preserve a large quantity.
- `constructionAffordability` quotes grant-first Iron/Silver spending, preserving provenance categories. `counterAdjustedPower` computes the published mixed-army bonus and hunger factor as a reduced rational. `compareUuidBytes` orders immutable troop IDs without locale collation.

The catalog currently contains the published building/level/unit tables, harvest schedule, founding grants, Hall unlocks, construction/training/upkeep limits, supply/garrison/scout/raid parameters, combat coefficients, Fortune weights, and action limits. A catalog entry is not proof a game action is already wired: the authoritative clock, ledger, combat, and commands belong to subsequent tickets.

Run `npm exec vitest run -- packages/domain/src/rules-catalog.test.ts` under Node.js 24 for the focused fixture checks. The generic API `AssetAmountSchema` also uses decimal-string units; the tests round-trip a maximum storehouse-sized Grain balance through that schema and JSON.
