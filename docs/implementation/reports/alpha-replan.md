# Game-only Alpha replan

Founder approval: 1 October 2026. Planning change, not gameplay completion or deployment.

## Result

The existing Linear project now has 99 tickets: 58 historical Done, 13 active game-only Alpha and 28 postponed. PACT-099 / MNI-158 is the new substantive agent-first learning/access/observable-play ticket. PACT-054 / MNI-119 is claimed In Progress; the other 12 Alpha tickets are Todo. All 28 deferred tickets remain Backlog, labeled PACT Later, with scope preserved rather than canceled or marked done.

The Active — Game-only Alpha milestone, PACT Alpha label, project overview, Start here guide and delivery policy identify the same scope. Old remaining social/production milestones are explicitly labeled Later. No active dependency points at a postponed ticket. Original full scopes/acceptance/dependencies/coverage survive in `original_plan` for narrowed tickets and in their Linear descriptions; later gates cannot treat Alpha completion as that original evidence.

## Checks

- Fresh Linear inventory/readback: 99 issues; 13 PACT Alpha; 28 PACT Later; statuses 58 Done / 1 In Progress / 12 Todo / 28 Backlog. Full blocking-relation and active-milestone readback for all 13 Alpha tickets matched the reviewed repository graph.
- `python3 docs/implementation/backlog.py render` and `check`: pass; 99 unique tickets, acyclic graph, all 37 original-plus-Alpha criteria mapped, source snapshots match.
- `git diff --check`: pass at planning checkpoint.

## Specification review

[Version 1.4 Alpha](../../pact/alpha.md) explicitly overrides broader release/channel/pilot gates, not economic formulas or existing account ownership/human decision rules. Only its new source snapshot was added; existing source hashes were not refreshed to hide drift. Completed historical evidence is unchanged. The scope and coverage generator distinguish current G01–G06 acceptance from deferred original S/L criteria.

## Handoff

Select only Alpha, dependency-ready, unclaimed tickets in backlog order. Start PACT-054; PACT-069 is also ready under the reviewed graph, but not the next backlog-order assignment. PACT-080 is the private Alpha rehearsal, not production release. See [scope](../../pact/alpha.md), [backlog](../README.md), [handoff](../HANDOFF.md) and [Linear workflow](../linear-workflow.md). No application deployment, paid service, model call, tester contact or gameplay completion occurred as part of this replan.
