# PACT-080 — final game-only Alpha rehearsal

Ticket: [MNI-155](https://linear.app/mnim/issue/MNI-155/pact-080-rehearse-season-one-end-to-end). Verified 1 October 2026 after all 13 dependencies were freshly read Done in Linear. Existing VPS release `alpha-20261001-1` / `88c273f`; local Node 24, PostgreSQL 17. This is the narrowed Version 1.4 private Alpha gate, not original production L/S certification.

## Decision and acceptance

**Pass for the private Alpha.** The final release's reproducible scenario suite passed, three independent connected Luna accounts made real unaided moves, and the matching deployment/browser/owner-record observations passed. No gameplay-blocking defect was found in the exercised paths. Public/player success is not inferred from unit tests: actual live moves, model use and mixed feedback are separately recorded in [agent completion](agent-first-completion.md).

1. **Preceding tickets and gameplay sequence:** pass. Fresh Linear reads confirmed PACT-053, 054–059, 061, 062, 069, 070, 073 and 099 Done before claiming 080. The whole 45-file integration suite reran at 19:42 UTC: **284 passed, one optional live-model skip**, 46.50 seconds. The evidence mapping below covers real command/state/receipt consequences, not placeholder/scaffold features.
2. **Three unaided accounts and report truth:** pass. Aster, Briar and Cinder used separate temporary Codex processes with only their own MCP, empty working directories and ordinary objectives. They independently learned/read/discovered actual contacts; five actions committed. Cinder reread its receipts/state; all owner HTTP activity agreed after closure. Briar's written terms stayed pending negotiation; no offer/contract/Grain gain was invented. Two invalid reads were harmless, reported and recovered/continued. Earlier expired cached OAuth was fixed through normal account authorization and rerun; no privileged stock, authority or live-clock edit enabled play. No gameplay mutation failed in these fresh sessions. Model assessments and usage are in the linked report, never relabeled human enjoyment or free inference.
3. **Isolated conclusion and handoff:** pass. The season fixture below accelerated only its disposable localhost schema. Correct harvest, immutable seven-day newcomer comparison, pre-boundary closing wealth, next baseline, persistent assets/terms, actual installment and truthful provisional honors all passed, including injected rollback/retry. [Friend instructions](../../operations/alpha-start.md) identify the live revision, manual captured-email verification, one-account OAuth, ordinary objective, watching/responding and remaining limits. Chrome reloaded the hosted client and read Kingdom/season, Envoy activity and People/contracts without the earlier transient deployment 502.

## Reproducible gameplay evidence

Run `npm run test:integration` using the documented localhost PostgreSQL 17 test database. Every file below passed in the final full run. These are linked coherent scenarios in independent disposable worlds, **not one six-week human pilot, not a claim that the three live agents performed every action**, and not a live-world time edit.

| Gameplay checkpoint | Actual executable evidence |
| --- | --- |
| Signup, verified draft, founding, owned initial state | `tests/integration/identity-onboarding.test.ts`; actual prior fresh browser founding in [web usability](alpha-web-usability.md) |
| Development, negotiation, exact supply agreement, settled resources | `game-command-social.test.ts`, `script-baseline.test.ts`; the script/fake-provider fixture completes Farm II and one one-hour contract with 120 installments under real rules |
| Garrison admission/signature/exit, authority/food/stock consequences | `game-command-social.test.ts` (active garrison and visiting return), `game-command-faults.test.ts` (exact receipt/replay/rollback matrix and capacity) |
| Scouts, raids, battle, completion/production/delivery ordering | `rules-runtime.test.ts` combines real domains, nine phase fault rollbacks and one atomic committed minute; `world-domain-order.test.ts`, `raids.test.ts`, `scouting.test.ts` verify participant results and boundaries |
| Real public discovery, invitations, Court membership/lifecycle | `chronicle.test.ts` real notice discovery through MCP; `invitations.test.ts`, `courts.test.ts` preserve actual contact/contract/resource/troop ownership through human membership changes |
| Articles, bilateral allegiance, preserved agreements | `politics.test.ts` publishes exact declarations and verifies actual stock/troops/real supply across publication and termination; human second signature and bounded/private projections |
| Selected signed evidence and factual consequence publication | `seals.test.ts` actual selective bytes and signer retry/signature verification; `chronicle.test.ts` publishes actual completed-build consequence, exact facts and live selected evidence without private expansion |
| Six-week harvest, closure, carryover, ranks/participation | `seasons.test.ts` accelerates all six weeks, captures equal-age newcomer score, retries injected rollover fault, preserves buildings/troops/ongoing raid/contract and records one actual installment; next baseline and provisional reward rules verified |
| Independent agent entry and observable recovery | `mcp-approval-inbox.test.ts`, `game-command-social.test.ts` plus [three fresh live observations](agent-first-completion.md), not fake-model performance claims |

Existing browser responsive/keyboard/outage evidence is [PACT-073](alpha-web-usability.md), against the same code now deployed. It includes 390×844, 320×740 and desktop reflow and disconnect recovery without replay. This continuation observed desktop hosted reads; it does not pretend to rerun physical phone/screen-reader certification. The deploy verifier passed; backup `537793fe` predates rollout. That backup was not freshly physically restored during this final gate; earlier prototype restore evidence remains historical, not newly certified.

## Remaining limits and closure

No incoming Grain was actually secured in this live negotiation; test mandates require human offer creation. Existing accounts had accumulated resources/contacts and public posts were empty, so there is no claim of a lively populated world or fresh-account balance/enjoyment. Email stays captured, in-app paid inference stays default-off, same-VPS backup is not disaster recovery, honors remain provisional, and native/payments/load/security/production work stays postponed. No paid infrastructure, production naming, push or testers contacted.

All **13/13 game-only Alpha tickets** can now close with this evidence; the other **28 Later** tickets remain postponed and retain `original_plan`. Next is founder/friends playing and giving feedback, not automatically starting Later tickets. Durable docs contain the operating/connection/evidence knowledge; host-only passwords/tokens are intentionally excluded.
