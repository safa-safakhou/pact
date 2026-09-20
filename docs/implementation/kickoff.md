# Foundation implementation assignment

Give this prompt to one implementation agent. It covers four related tickets in one run, with verification between tickets. Linear's activation state is recorded in [the workflow](linear-workflow.md).

```text
Implement the PACT foundation batch, in this order:
PACT-001 → PACT-082 → PACT-002 → PACT-003.

Read root AGENTS.md, docs/implementation/README.md, docs/implementation/linear-workflow.md, each assigned ticket in tasks.json, and all its source documents. Inspect existing code and working-tree changes first.

Deliver the reproducible workspace and CI, reusable package boundaries, shared command/event/tool schemas, and transactional persistence/outbox infrastructure described by those four tickets. Use their full acceptance criteria; this summary does not replace them. Make routine engineering choices yourself within the specification.

Use the active tracker to claim work and record progress. If Linear is activated, read the mapped issues and current dependencies before starting; keep the local snapshot reconciled. If activation is still pending, use tasks.json. Never fabricate Linear IDs, completion, or test results.

Complete and verify each ticket before starting its dependent ticket. Continue through the assigned batch without asking permission between tickets. Keep changes reviewable and stay within the batch's scope. Do not launch additional agents unless explicitly authorized.

Update setup, package/API, and migration/operations documentation where relevant. Write docs/implementation/reports/foundation.md using the report template, with separate acceptance evidence for every ticket. Link documentation, actual check results, and any PR/revision from the tracker. State any external checks you could not run. Mark done only when the ticket's acceptance criteria actually pass.

Regenerate planning views and run the backlog validator and git diff --check, plus the application checks required by the tickets. Finish with completed IDs, evidence, blockers, and the next independent work available. Leave changes ready for review; do not commit, push, or deploy under this assignment.
```
