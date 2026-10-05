# Linear delivery workflow

**Current plan - 4 October 2026:** Four new tickets PACT-127-130 are Todo under **Active - Friends playtest: join, connect and play**. [Agreed scope and acceptance](friends-playtest.md): shared-link nickname-only guest entry and own-agent connection, compact opening, clear builder choices, friend discovery/contact. No PACT signup/password/email/verification. Current counts: **102 Done, 4 Todo, 24 Later Backlog**. Planning complete; implementation not started. Earlier zero-open-ticket and next-production-task statements below are historical.

**Current scope - friends-only testing, 4 October 2026:** Founder parked all 24 remaining original roadmap tickets on 4 October 2026. Current priority is a playable, fun and interesting web game for a couple of friends. These future tickets are not prerequisites for the friends-only testing phase. No automatic selection of PACT-064/065 or other production/pilot/channel work. Original scope/acceptance/dependencies remain preserved for a later phase. **0 existing open playability/experience tickets**; four follow-up candidates in the prior playthrough are not yet ticketed. [Decision/readback](reports/evidence/friends-only-scope-20261004.json). Earlier next-task instructions below are historical.

**Resumed roadmap - 4 October 2026:** PACT-060/063/088/089 are confirmed Done in Linear; milestone Completed - Resumed social and channel batch, 100%. Original acceptance preserved. [Completion report](reports/social-channel-resume-20261004.md), [API](../api/social-channels.md), [operations](../operations/social-channels.md). Testing release social-channel-20261004-2 verified. Current counts: **102 Done, 24 Backlog**, no active Todo/In Progress. PACT-064 is next dependency-ready; PACT-065 follows it. Remaining client/provider/device/pilot gates require their original evidence. Earlier assignment/count paragraphs below are historical and superseded by this snapshot.

**Scope review — 3 October:** Eighteen experience tickets now use the bounded inventory and exact acceptance in [current plan](game-experience.md). Read [whole-backlog review](reports/game-experience-scope-review-20261003.md). Earlier expanded concepts are inspiration, not additional required work. The 28 Later tickets remain parked.

**Current assignment — 3 October 2026:** PACT-109–126, 18 Todo under **Active — Game experience and generated assets**, label **PACT Experience**. All generated media is Codex-owned; no founder assets/accounts required. The 28 Later tasks stay postponed. Start with PACT-109 and the dependency-ready work; implementation has not started. See [current plan](game-experience.md).


## Current planning override — 2 October 2026

The founder assigned **PACT-100–108 / MNI-159–167** as one batch after the fresh playtest. All nine are verified **Done**, labeled PACT Alpha under **Completed — Alpha playtest fixes (2 October)**. [The plan](alpha-playtest-fixes.md), tasks.json and completion reports retain scope/dependency/acceptance evidence; Linear owns execution. The separate `alpha_followup` track preserves the original 13-ticket Alpha. Current totals: 108 issues, 80 Done, no In Progress/Todo, 28 Later Backlog. No Later work is activated.

## Historical scope override — 1 October 2026

Only the founder-approved [Version 1.4 Alpha](../pact/alpha.md) is active: 13 tickets in **Active — Game-only Alpha**, labeled **PACT Alpha**. Twenty-eight remaining unfinished tickets are postponed **PACT Later** / Backlog. Historical four-phase milestones/counts below are import records, not the current assignment. New PACT-099 is substantive missing agent implementation, not an umbrella. Preserve `original_plan` when narrowing scope and never infer full original S/L gate acceptance from Alpha completion.

**Activation: active.** Verified 16 September 2026, 14:52 UTC in the **mnim** workspace / **Mnim** team. [PACT — Season One](https://linear.app/mnim/project/pact-season-one-7dae7c737a2d) now contains 98 tickets across four milestones. Linear owns execution tracking; the local backlog is its reconciled snapshot. The original import count and relationship audit are recorded in [the import report](reports/linear-import.md); consult live Linear for current execution status.

Open [Start here — agent assignments](https://linear.app/mnim/document/start-here-pact-implementation-62c10c1d2f93) or [Delivery and documentation policy](https://linear.app/mnim/document/delivery-and-documentation-policy-32fa9e76322e). The project also contains eight specification reference documents. Stable IDs/URLs and verification metadata are in [linear-map.json](linear-map.json); read the [import report](reports/linear-import.md) for checks and handoff limits.

## Organization

Create a dedicated **PACT — Season One** project in the selected team, with four milestones: Connections, Rules, Social slice, and Season One release. Preserve every existing ticket, including verification and gates. Keep each PACT ID in its issue title, for example `[PACT-001] Bootstrap the application workspace and continuous integration`; Linear's own issue identifier is a separate ID.

Each issue contains its outcome, scope, acceptance checklist, specification references, dependency links, component ownership, relative size, external prerequisites, and a completion-evidence section. Use actual blocking relations as well as readable links. Do not turn relative sizes into invented dates or effort estimates.

Tickets are checkpoints, not agent runs. Assign coherent batches and keep each constituent issue independently tracked. Start one agent on **001 → 082 → 002 → 003**. After that, independent ready work can run in parallel; later examples include provider adapters after PACT-010 and native/Telegram clients after their shared dependencies. Reuse agents across batches where useful. Never start downstream implementation against an unverified dependency merely because both tickets share an assignment.

Use project documents for **Start here / agent assignments** and **Delivery and documentation policy**. Each batch entry identifies its ticket IDs, order, owner, allowed files/components, integration responsibility, and report path. Do not add umbrella issues that inflate the 97-ticket completion count.

## Tracking ownership

| Information | Authority after activation |
| --- | --- |
| Game behavior and architecture | Versioned `docs/pact/` specification |
| Planned scope, dependency graph, acceptance criteria | Reviewed `tasks.json`; matching issue descriptions in Linear |
| Current assignment, status, blockers, execution evidence | Linear issues |
| Implementation, operational instructions, decisions, completion reports | Repository files linked from Linear |
| Offline status/export views | Reconciled snapshot in `tasks.json` and its generated views |

No background or automatic synchronization is installed. The agent owning an update must reconcile both sides. At assignment start, read Linear and refresh execution fields without overwriting unrelated changes; at completion, save the evidence/report, update Linear, refresh the snapshot, and validate it. Record the synchronization timestamp in the mapping file. If a write fails, report exactly which side is stale. Do not close an issue based on an unverified local status.

During a Linear outage, an already-claimed assignment may continue locally. Record pending tracker changes in its report and replay them after reading the current issue; do not claim competing new work from a stale snapshot. Local edits must never silently overwrite a newer remote owner or status. Changes to scope or dependencies require repository review and an explicit update to the corresponding issue; editing only Linear is insufficient.

Use the team's actual status names. Map backlog/todo to local `todo`, active work/review to `in_progress`, and completed to `done`. A genuine blocker maps to local `blocked`; if the team lacks a blocked status, retain an unfinished status and record the blocker prominently with its dependency/required action. Do not treat canceled or duplicate issues as completed; reconcile them explicitly. Do not assign a human or trigger agent delegation merely by importing a ticket.

## Documentation required to finish

Every ticket must link a [completion report](reports/README.md) containing acceptance-by-acceptance results, reproducible checks, changed documentation, and remaining limitations. One report can cover a batch, with separate sections for its tickets. Keep secrets and personal data out of evidence.

Update the relevant durable documentation: setup commands for tooling, examples and error semantics for APIs, ownership/interfaces for modules, migration/recovery steps for storage, and player instructions for visible behavior. Record consequential architecture decisions separately when needed. Link existing documentation rather than generating an essay for every ticket; explicitly record when no additional documentation category applies.

Code merged or a checklist checked does not establish a real-provider certification, deployment, security review, or player pilot. Those issues need their specified observations. A milestone closes only when its gate issue has complete evidence.

## Import and activation checklist

1. Reauthenticate Linear and identify the correct workspace/team. Inspect existing projects/issues, including archived matches, to avoid duplicates from interrupted imports.
2. Create the dedicated PACT project requested by the founder and its four milestones. Resume that same project if this import was partially completed. Do not invent owners, deadlines, or priorities.
3. Import each ticket's complete content and current verified status. Maintain `docs/implementation/linear-map.json` with workspace/team/project IDs, milestone IDs, each PACT-to-Linear ID/URL mapping, and verification timestamp. Save confirmed mappings as the import proceeds so an interrupted run can resume safely. The existing mapping contains verified remote IDs; never recreate them blindly.
4. Add blocking relations from every `depends_on` edge using the mapping, either during topological creation or once all issues exist. After a timeout, inspect the destination before retrying a creation. Do not send repeated blind create requests.
5. Publish the two project documents. Use verified repository URLs for source/report links when a remote is available; otherwise label repository paths as checkout references rather than making broken remote links.
6. Read back the project, every issue, milestone membership, descriptions, and blocking relations. Check exact PACT ID coverage, no duplicates, acceptance completeness, and graph parity. Preserve existing execution progress rather than resetting it during an import.
7. Only then change this document to **active**, link the project and documents, and record the timestamp. Update `tasks.json`'s ownership note and reconcile execution fields. Render/check the backlog and verify local documentation links.

Import creates planning records only. It does not begin implementation, recruit testers, send direct messages, or automatically dispatch agents.
