# Faithful owner intent source acceptance

Tasks: AR-P01 / PACT-171 and Fleet AR-F01. Date: 15 October 2026 Europe/Berlin. Source-only implementation; no deployment or real provider execution.

PACT now publishes additive `pact.world.owner.v1` metadata on its owner view and exports `OwnedWorldIntentSchema`. Current intent remains root `world.ambition`; empty string means absent. Profile is identity/portrait, and public/other-player views retain their privacy boundary. Compatible unversioned responses are accepted; declared unknown versions and the misleading profile-intent fixture are rejected.

Fleet reads the root field, retains intent in protected compact facts and uses fresh intent for neutral account-autonomy instructions and automatic cognition recall. Missing intent is explicit, without substitution of historical generated strategy. An explicit in-turn memory question remains possible. The strategy mode and all stored strategies/notes/plans remain preserved history.

| Acceptance | Actual evidence | Result |
| --- | --- | --- |
| Faithful layout and absence/version behavior | Shared contract tests include real-layout, empty, wrong-profile, public and unsupported-version controls | Pass |
| Owner guidance changes reach every downstream input | Fleet unit tests and actual fake-provider turns in both memory modes, including changed owner intent and recall-query spy | Pass |
| Scoped view/private history compatibility | Kingdom-ambition integration covers repeated owner changes, public/private separation, account scoping/export and unchanged economics; Fleet preserves consumed strategy/settings/anchor/ledger | Pass |
| Documented contract and generic boundary | [Owner intent API](../../api/owner-intent.md), [Fleet guidance](https://github.com/safa-safakhou/fleet/blob/master/docs/owner-guidance.md); both architecture checks | Pass |

PACT: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (364), `npm run test:integration -- --maxWorkers=2` (410 pass, one existing optional live-provider test skipped). Published v1 schema freeze remains 26/26 unchanged. Fleet: `npm run check`, `npm test` (111), `npm run test:integration` (166), `npm run build`, `npm run check:boundaries`, `npm audit --omit=dev` (zero vulnerabilities). Existing lint/bundle warnings remain. Backlog render/check and scoped whitespace check pass.

Tests use isolated named disposable PostgreSQL containers: `pact_test` on loopback 55437 and `fleet_test` on 5437, distinct from the live local database on 5439. Fake model/game/helper providers only; no live Ollama/Codex/Laya, game-host command or database migration. Local systemd resolves to a protected release directory, not these checkouts; the unrelated local app container has no checkout bind mount.

Current task claims are local because Linear read returned UNAUTHORIZED/reauthentication required. PACT-170's separate assignee/deployed acceptance remains untouched. AR-P02/AR-F02 are next after these verified intent contracts. Model behavior and live acceptance remain unclaimed.
