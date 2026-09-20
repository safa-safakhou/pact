# Implementation completion reports

Create one concise Markdown report per ticket or coherent batch in this directory. Use a stable filename such as `foundation.md`. Link it from each covered ticket's evidence and its Linear issue when active. Update product/module instructions in their normal location; the report connects those changes to acceptance evidence.

Copy this template and replace every placeholder with facts. Do not report unrun checks as passes.

```markdown
# <Batch or ticket name>

Tickets: <PACT IDs and Linear links if active>
Implementation revision/PR: <reference, or explicitly uncommitted>
Verification date/environment: <actual date, relevant versions>

## Result
<What now works, its boundary, and any incomplete scope.>

## Acceptance evidence
| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| <ID> | <exact criterion> | <command or evidence link> | <pass/fail/not run and reason> |

## Documentation
<Links to changed setup, interface, module, migration, recovery, or player instructions.>

## Decisions and limitations
<Consequential implementation choices, external checks still needed, and real blockers.>

## Handoff
<Next ready tickets, integration considerations, and pending tracker synchronization, if any.>
```

For long-running verification or pilot tickets, link the actual observation records and measured results instead of substituting unit tests. Avoid copying raw sensitive logs or repeating the complete design.
