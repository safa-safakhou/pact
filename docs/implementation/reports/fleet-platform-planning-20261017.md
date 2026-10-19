# Fleet and PACT architecture planning — 17 October 2026

The founder requested a concrete architecture and phased implementation plan consolidating the current discussion. Fleet remains a general-purpose agent runtime; optional comparisons and reports support product decisions. This assignment is documentation only.

## Deliverables

- [Shared architecture and diagrams](https://github.com/safa-safakhou/fleet/blob/master/docs/superpowers/specs/2026-10-17-multi-engine-platform-design.md): preserved compatibility engines, generic environment boundaries, task/event admission, capability negotiation, beliefs/relationships, both specialist coordination alternatives and six delivery phases.
- [Fleet implementation plan](https://github.com/safa-safakhou/fleet/blob/master/docs/superpowers/plans/2026-10-17-multi-engine-platform.md): F1–F8 packages, concrete file/interface boundaries, failure-path acceptance, fake-provider checks, local commit and later qualification requirements.
- [PACT counterpart](../../superpowers/plans/2026-10-17-fleet-platform-integration.md): P1–P3 for scoped replayable events, factual owner outlooks and isolated integrated scenarios. The existing game rules, command authority and one write lease remain authoritative.

Source anchors inspected: Fleet `a2c82db03232ddef5eeb524a1d86325c463960f6` and PACT `a567c5e80943473551945042c1941cbe48e219f5`. Actual current run-debugging/readable-step reports were read so the plan extends existing inspection features. No fresh live-runtime/cohort census was performed.

## Scope and review

No application code, dependency, migration, deployed runtime, product specification/hash, tracker task, account, allowance, schedule, pending command or historical allocation was changed. No provider call, recovery review, reconnect, replay, population start, remote push or installation occurred. Local documentation commits are covered by the founder's standing preference.

Repository instructions prohibit delegation, so builder/plan review was performed locally. Key implementation choices are explicit in the shared design: one environment per deployment initially; immutable cohort-level engine profiles; polling before streaming; a proposed seven-real-day maximum metadata feed; coordinator-first specialists with the independent-submit candidate retained for comparison. A full cognition bundle is not mislabeled a beliefs-only ablation.

## Verification

- A read-only Python documentation check passed for all six changed documents: 99 local Markdown links resolve, code fences balance (including six Mermaid blocks across those documents), and all changed paths are documentation. Diagrams were reviewed for their boundaries/order; browser rendering is not claimed.
- `python3 docs/implementation/backlog.py check` passed: 181 unique tickets, acyclic dependencies, 37 covered release criteria, matching source snapshots and six generated views checked. No ticket/source snapshot was edited, so regeneration was unnecessary.
- Node 24 ran Fleet `scripts/check-boundaries.mjs`: passed. PACT `scripts/check-boundaries.mjs`: passed; `scripts/verify-boundary-fixture.mjs`: the forbidden platform-to-domain fixture was rejected as required.
- `git diff --check` passed in both repositories. Staged-document checks are repeated before local commits.

Application builds, behavior suites, provider calls and deployment acceptance were not run for this documentation-only change. Commands/checklists in the plans describe future implementation acceptance, not completed checks.

Future implementation packages remain unstarted; F1 is the next proposed Fleet package and PACT P1 follows its reviewed adapter contract.
