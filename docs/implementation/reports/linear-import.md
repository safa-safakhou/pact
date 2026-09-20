# Linear backlog import

Verified: **16 September 2026, 14:52 UTC**.

Project: [PACT — Season One](https://linear.app/mnim/project/pact-season-one-7dae7c737a2d), in the mnim workspace / Mnim team.

## Result

Imported the existing Version 1.1 implementation backlog into a dedicated project. Linear is now the execution tracker. This report documents planning setup; it does not complete an application ticket.

| Check | Result |
| --- | --- |
| Issue coverage | Exactly 97 issues, each mapped to one existing PACT ID; no missing or duplicate IDs |
| Milestone membership | Connections 32; Rules 27; Social slice 21; Release 17 |
| Blocking relations | All 504 `depends_on` edges read back and matched |
| Issue content | Scope, acceptance criteria, source links, external prerequisites, and completion-evidence section verified on every issue |
| Assignment/status | PACT-001 is Todo; 96 others are Backlog; all unassigned; no tickets marked Done |
| Project documents | Eight complete specification copies, the agent guide, and the documentation policy read back; Markdown-only formatting differences normalized |
| Local backlog checks | 97 unique tickets, acyclic dependencies, 31 criteria covered, source snapshots and six generated views validated |

All issue/document/project IDs and source hashes are saved in [linear-map.json](../linear-map.json). No automatic synchronization has been installed.

## Foundation handoff

Assign one agent the following ordered batch:

| Stable ID | Linear issue |
| --- | --- |
| PACT-001 | [MNI-60 — Workspace and CI](https://linear.app/mnim/issue/MNI-60) |
| PACT-082 | [MNI-61 — Reusable boundaries](https://linear.app/mnim/issue/MNI-61) |
| PACT-002 | [MNI-62 — Shared schemas](https://linear.app/mnim/issue/MNI-62) |
| PACT-003 | [MNI-63 — Persistence and outbox](https://linear.app/mnim/issue/MNI-63) |

Use [the kickoff prompt](../kickoff.md) or the [Linear agent guide](https://linear.app/mnim/document/start-here-pact-implementation-62c10c1d2f93). Each ticket must pass its own acceptance criteria before its dependent work starts. No implementation agent was launched by this import.

## Repository handoff limitation

The specification source is local commit `626802c53a4dd246fce4c799f12a1614e1889689`. At verification, `git ls-remote origin HEAD` returned `765bbfb3bd4e9af93a86e110b64016a94f5240e0`; the current design commit was not on the remote HEAD. The tracking and foundation changes are included in the subsequent local foundation commit. No push was performed. Use the current local checkout for implementation, or explicitly publish/transfer it before assigning remote agents. Linear reference copies do not install the repository files.
