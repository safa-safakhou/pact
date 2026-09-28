# Database-free platform reuse

PACT-096 adds explicit `./portable` package exports for a small non-game application. Import these entry points, not a package root that loads its PostgreSQL adapter:

| Package export | Responsibility / injected port |
| --- | --- |
| `@pact/identity/portable` | Existing token digester and AES-GCM secret box; scoped, expiring opaque sessions through `SessionStore` and a clock. Account verification and transport authentication remain adapter responsibilities. |
| `@pact/runs/portable` | Explicit human start, owner-bound exclusive `LeasePort`, original deadline, single in-flight call, token reservation/reconciliation and call limits. The invocation callback returns data, not committed domain effects. |
| `@pact/approvals/portable` | Schema-normalized exact-command hash, immutable stored proposal, human/owner/product/expiry checks and serialized `ApprovalStore` effect-plus-receipt commit. The application supplies action validation and current-state preconditions. |
| `@pact/inbox/portable` | Payload-free, owner/product-filtered notification publication/read via `NotificationStore`. The adapter must deduplicate `(productScope, accountId, eventId)`. It receives no inference or gameplay capability. |
| `@pact/model-provider` | Existing provider router, typed tool parsing and deterministic fake provider. No game or database import is needed. |

This is a narrow extraction proof, not a replacement for PACT's durable PostgreSQL run, identity, inbox and approval services. Those services retain their public roots and transaction paths. They share the existing crypto, exact-command hashing and run-default/limit helpers with the portable entry points. Game clients still use the common application dispatcher; they cannot select these kernels to bypass authority. No production sessions, passwords, grants or receipts are migrated.

## Reproduce the proof

Use Node 24, install the pinned workspace dependencies, and run:

```sh
npm run build
npm run check:non-game
npm test -- tests/unit/non-game-reuse.test.ts tests/unit/contract-guard.test.ts
```

`tests/fixtures/non-game/` is a synthetic notice-board app. Its separate TypeScript configuration compiles against public package exports, not workspace source-path aliases. The check rejects domain/database types in the compiler's dependency list and runs the emitted app with database environment variables unset. A Node import hook checks the **transitive runtime closure** and rejects all PACT domain/database adapters, external runtime libraries and deployment dependencies. A deliberate forbidden application import must fail too. Generated output goes to ignored `.tmp/non-game/`.

The cycle is verified identity → explicitly started bounded fake inference → normalized note proposal → human exact approval → versioned note/receipt → deduplicated notification → credential revocation. Fixture identity bootstrap stands in for a verified account adapter; it is not a signup/authentication shortcut for PACT. The fixture uses synthetic encrypted credential bytes and fake inference only.

Memory adapters serialize synchronous commits, snapshot/restore the synthetic document on a failed effect, copy stored records, preserve command-ID conflicts, scope every session/credential/lease/approval/event, and deduplicate receipts/events. These are test-only adapters: restarting loses them. A durable host must implement equivalent storage/transaction semantics and retention, authenticate principals before calling kernels, ensure revoked credentials prevent future steps, and avoid side effects inside a model-invocation callback. Notifications are post-commit; duplicate approval can repair a missed notification without another effect or model call.

## CI guards and evolution

`npm run lint` includes the import-direction guard and `npm run check:contracts`. The latter compares fourteen published v1 JSON schemas against `published-contracts.json`; deletion, narrowing, or accidental in-place changes fail. It is intentionally stricter than a full semantic compatibility solver. Compatible additions need explicit compatibility review before changing their baseline. Breaking evolution must retain the published v1 contract and add a versioned contract with documented migration/compatibility handling; do not refresh hashes merely to hide a breaking change. Unit tests exercise removed/narrowed/changed-schema rejection and a separate v2 addition.

Hosted CI is configured to run the independent compile/runtime proof after the workspace build, and the existing full PostgreSQL suite still verifies PACT's atomic stock, authority, receipts and outbox. A local pass does not claim a hosted CI run or external certification.
