# Linear delivery workflow

**Activation: active.** Verified 16 September 2026, 14:52 UTC in the **mnim** workspace / **Mnim** team. [PACT — Season One](https://linear.app/mnim/project/pact-season-one-7dae7c737a2d) contains all 97 tickets, four milestones, and 504 blocking relationships. Linear now owns execution tracking; the local backlog is its reconciled snapshot. No application work is complete.

Open [Start here — agent assignments](https://linear.app/mnim/document/start-here-pact-implementation-62c10c1d2f93) or [Delivery and documentation policy](https://linear.app/mnim/document/delivery-and-documentation-policy-32fa9e76322e). The project also contains eight specification reference documents. Stable IDs/URLs and verification metadata are in [linear-map.json](linear-map.json); read the [import report](reports/linear-import.md) for checks and handoff limits.

## Organization

Create a dedicated **PACT — Season One** project in the selected team, with four milestones: Connections, Rules, Social slice, and Season One release. Preserve all 97 existing tickets, including verification and gates. Keep each PACT ID in its issue title, for example `[PACT-001] Bootstrap the application workspace and continuous integration`; Linear's own issue identifier is a separate ID.

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
6. Read back the project, all 97 issues, milestone membership, descriptions, and blocking relations. Check exact PACT ID coverage, no duplicates, acceptance completeness, and graph parity. Preserve existing execution progress rather than resetting it during an import.
7. Only then change this document to **active**, link the project and documents, and record the timestamp. Update `tasks.json`'s ownership note and reconcile execution fields. Render/check the backlog and verify local documentation links.

Import creates planning records only. It does not begin implementation, recruit testers, send direct messages, or automatically dispatch agents.
