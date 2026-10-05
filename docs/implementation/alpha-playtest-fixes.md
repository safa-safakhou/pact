# Alpha playtest follow-ups — 2 October 2026

The founder assigned all nine as one batch to Mohammad Safakhou / Codex. **PACT-100–108 are verified Done** in **Completed — Alpha playtest fixes (2 October)**. See [batch acceptance evidence](reports/alpha-playtest-fixes.md) and [final fresh journey](reports/alpha-three-player-retest-20261002.md). No further assigned Alpha follow-up remains.

## Original findings that prompted the batch

Three fresh accounts, four Luna turns each. Cedar and Marsh activated a one-hour Grain/Iron exchange; initial deliveries matched database records. All three farms and Flint's wall completed. Setup needed Mailpit assistance/newer Codex; approval links opened the other app; current-state reads failed repeatedly; normal player surfaces hid delivered amounts and retained stale action prompts. This was an assisted simulation, not human enjoyment research.

Full checkout evidence: `docs/implementation/reports/fresh-three-player-playtest-20261002.md`, `docs/implementation/reports/evidence/fresh-alpha-20261002.json` and the report screenshots. They are local and not yet committed/pushed; no broken remote report URL is implied.

## Completed tickets and dependency order

- [[PACT-100] Fix exact approval links under the hosted PACT path](https://linear.app/mnim/issue/MNI-159/pact-100-fix-exact-approval-links-under-the-hosted-pact-path)
- [[PACT-101] Make private Alpha signup and Codex connection setup actionable](https://linear.app/mnim/issue/MNI-160/pact-101-make-private-alpha-signup-and-codex-connection-setup)
- [[PACT-102] Make current kingdom reads and validation errors reliable for small agents](https://linear.app/mnim/issue/MNI-161/pact-102-make-current-kingdom-reads-and-validation-errors-reliable-for)
- [[PACT-103] Clarify founding resources, affordability and trade authority for agents](https://linear.app/mnim/issue/MNI-162/pact-103-clarify-founding-resources-affordability-and-trade-authority)
- [[PACT-104] Expose completed builds and actual trade deliveries to owners and agents](https://linear.app/mnim/issue/MNI-163/pact-104-expose-completed-builds-and-actual-trade-deliveries-to-owners)
- [[PACT-105] Keep external-agent activity ordered, refreshed and reconciled with current state](https://linear.app/mnim/issue/MNI-164/pact-105-keep-external-agent-activity-ordered-refreshed-and-reconciled)
- [[PACT-106] Show remaining game time for builds and contracts](https://linear.app/mnim/issue/MNI-165/pact-106-show-remaining-game-time-for-builds-and-contracts)
- [[PACT-107] Put connection, progress and next decisions first on desktop and phone](https://linear.app/mnim/issue/MNI-166/pact-107-put-connection-progress-and-next-decisions-first-on-desktop)
- [[PACT-108] Repeat the fresh three-player journey and document remaining friction](https://linear.app/mnim/issue/MNI-167/pact-108-repeat-the-fresh-three-player-journey-and-document-remaining)

The completed batch started with **PACT-100 / MNI-159**. Initially dependency-ready: 100, 101, 102, 103 and 106 (053 and 099 freshly Done). Then 104 after 102; 105 after 100/104; 107 after 101/105/106; 108 after every fix. The batch followed this dependency order.

High priority: 100–105. Medium: 106–108. Relative sizes and component boundaries live in each issue, without invented deadlines or time estimates.

## Scope and boundaries

Preserve game economics, exact arithmetic, authority, privacy and human-only decisions. Improve the existing web/agent Alpha on the existing VPS. Captured email stays explicit and operator-assisted; real outbound email remains [PACT-078](https://linear.app/mnim/issue/MNI-151/pact-078-provision-and-rehearse-production-operations) / [PACT-060](https://linear.app/mnim/issue/MNI-125/pact-060-deliver-opt-in-critical-email-and-web-push) in Later, rather than silently provisioning a mail service or bypassing verification. Supply-proposal versus signature-authority documentation must be reconciled against its owning specs.

Original Alpha: 13/13 completed historically. Current project totals: 108 issues, 80 Done, zero In Progress/Todo, 28 Later/Backlog. No original issues were reopened or closed. Implementation evidence is recorded separately before closure.

Local authoritative scope: `docs/implementation/tasks.json`; mapping: `docs/implementation/linear-map.json`; organized plan: `docs/implementation/alpha-playtest-fixes.md`. Original game behavior remains [Version 1.4 Alpha](https://linear.app/mnim/document/approved-game-only-alpha-version-14-b91b27bec011).

## Evidence required for completion

Every ticket needs per-acceptance results, relevant setup/API/module/operations documentation and a durable completion report, suggested batch path `docs/implementation/reports/alpha-playtest-fixes.md`. Local checks do not prove hosted CI or deployment. The final repeat test must report actual hosted revision, versions/model, assistance, failures, usage and cleanup. Contacting human testers, production certification, paid infrastructure and deployment require a covering assignment. No claim of real human enjoyment from model feedback.


## Historical planning verification

All nine Linear issues were read back: acceptance complete, exact blocking relations, correct milestone/PACT Alpha label, Todo and no assignee. A fresh full project read confirmed 108 issues: 71 Done, nine Todo, 28 Backlog. Project overview, Start here guide and new plan document were also read back.

`python3 docs/implementation/backlog.py render`, `python3 docs/implementation/backlog.py check` and `git diff --check` passed. The planning validator accepted the valid 108-ticket graph and rejected a missing follow-up checkpoint dependency, a postponed dependency and an untracked follow-up ID. The original 99 ticket records and specification hashes remain intact. No application build/behavior tests were run for ticket creation; that planning check does not certify the implementation now underway.

## Final execution verification

All nine Done in Linear with per-acceptance evidence. Full readback: 108 issues, 80 Done, no active/Todo, 28 Later Backlog. Final snapshot alpha-20261002-7 deployed/verified; 222 unit/288 integration passed, one optional skipped, build/types/lint passed. Three fresh Luna players completed upgrades and activated actual delivering trade. Phone/keyboard/offline/revocation checks passed; all six batch test accounts cleaned. Local changes remain uncommitted. No Later/production/human enjoyment claim.
