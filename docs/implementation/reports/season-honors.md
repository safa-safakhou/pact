# Alpha seasonal honors

Ticket: PACT-070 / [MNI-141](https://linear.app/mnim/issue/MNI-141).
Dependency: PACT-069 / `f0763b7`, freshly read Done before claiming this ticket; PACT-053 also freshly Done.
Implementation revision: this report's implementation commit.
Environment: local Node 24, PostgreSQL 17 disposable schemas, 1 October 2026.

## Result and acceptance

1. Rulebook-correct signed Fortune competition ranks, highest-Hall bands, three meaningful-day eligibility, exact percentile ceilings/expanded ties and minimum 100 eligible band members. `tests/unit/season-honors.test.ts` covers tied zero/negative scores, tie display ordering, five shared top-three recipients, 99 versus 100 eligible members, highest tier only and closing exclusion. Friends see ranks without unsupported percentile honors.
2. `tests/integration/seasons.test.ts` proves real repeated transfers to the same partner count once per UTC day; training/messages/logins and a completion without a matching record do not. Different activation ages receive separate immutable age-seven-day samples. Eligible arrivals receive one medal and season participants one dated banner. Repeated activity/closure/arrival processing leaves cosmetics, balances, troops and score baselines unchanged. Neither borders nor plaques are issued as final entitlements. Closing results and eligibility flow through the same authorized HTTP/MCP/in-app overview; web tests verify clear provisional and small-population labels. The combined rules-runtime fixture exercises completed build, two-way supply, scouting and resolved-raid activity under transaction rollback/recovery; one-way supply also counts only its actual delivered installment.

`npm run build`, `npm run typecheck`, `npm run lint` pass. Final full unit suite passes 205 tests; PostgreSQL integration passes 282 tests with one pre-existing optional live-model skip. Planning render/check and diff check pass. The final exact-BigInt percentile/UI-label cleanup is rebuilt and rechecked with the targeted season, honors, web and combined-runtime fixtures. No hosted CI, real provider inference or new browser/player enjoyment evidence is claimed.

## Documentation and scope

[Season module and honors](../../architecture/seasons.md) owns the shared reader, exact boundary order, activity proof, compact cosmetics and 180-real-day retention/export/deletion. `.env.example` and production compose expose the optional persisted season-opening setting; no deployment or live-clock edits occurred. Default opening remains the first rules tick's prior committed minute.

Competitive output is permanently **provisional for Alpha**, with `finalized: false`; there is no finalization endpoint or delayed final entitlement job. Formal abuse review, competitive disqualification/appeals and seven-real-day final-award issuance are postponed, not silently completed. Participation and arrival cosmetics are noncompetitive display-only records, no Gem or economic bonus.

Next Alpha work: PACT-073, then substantive agent-first learning/observable play PACT-099 and rehearsal PACT-080. The 28 Later tickets remain postponed. Hosted release remains `alpha-20260929-4` / `2143d92`; all changes here are local and committed only.
