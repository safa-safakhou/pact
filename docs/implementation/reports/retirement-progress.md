# PACT-050 retirement — completion report

Ticket: [PACT-050 / MNI-114](https://linear.app/mnim/issue/MNI-114/pact-050-implement-gameplay-retirement-and-account-deletion-settlement) — complete in the local checkout.

Implementation revision/PR: uncommitted local checkout. Verification: 24 Sep 2026, Node 24 and local PostgreSQL 17.

## Result

Account deletion now invokes a product-owned retirement hook before access revocation. The kingdom becomes closing, existing supply/garrison obligations enter default/exit settlement, accepted raids and scouts remain, and a later game tick discards assets only after engagements clear. Migration `0034` preserves a pseudonymous kingdom when the account is erased after 30 real days. The API and rules worker both compose the retirement service; a missing retirement hook fails closed when a kingdom exists.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Deletion cannot cancel an already-declared enemy raid or redirect remaining wealth to a friend | `tests/integration/retirement.test.ts` uses the real raid service to lock and resolve after both owners delete; a transfer targeting a closing kingdom is rejected, and retirement supply default does not gift stock. | Passed locally. |
| Both owners closing, locked visiting troops, long world pause, repeated retirement jobs settle once while personal data meets real-time deadlines | The fixture pauses world time, erases both account identities at day 30, retains accepted engagements, returns a visiting troop after its battle lock, retires once, retries, and prunes retired movement records and kingdom checkpoints after 180 real days. | Passed locally. |

## Documentation and limitations

[Retirement module and operations](../../architecture/retirement.md) records migration order, boundaries, and the erasure/settlement split. After the 180-day audit window, movement history is pruned and retired kingdom checkpoints are deleted only when no retained engagement or contract references them. The real raid-resolver deletion fixture passed. `npm run build`, `npm run typecheck`, `npm test` (104), `npm run test:integration` (128), and `npm run lint` passed on Node 24 with local PostgreSQL 17. No hosted CI, deployment, real account deletion, or player observation is claimed. PACT-049 game tools remains separately in progress.
