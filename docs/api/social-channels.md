# Social/channel HTTP additions

PACT-060/063/088/089 add the following authenticated endpoints under the deployment's /pact/ base. These supplement, rather than change, the 26 published v1 command schemas. Responses are no-store. Ordinary human writes require the same-origin cookie session and CSRF header; ownership derives from that session, never a body account ID. Model/MCP principals cannot administer human preferences or moderation.

| Route | Purpose |
| --- | --- |
| GET /v1/notifications/preferences | Own opt-ins, subscriptions and public VAPID key |
| POST /v1/notifications/preferences | Set one category/channel opt-in |
| POST /v1/notifications/subscriptions | Enroll a valid permission-granted browser endpoint |
| POST /v1/notifications/subscriptions/:id/revoke | Revoke an owned endpoint |
| POST /v1/moderation/reports | Report an already-visible target with idempotency key and bounded details |
| GET /v1/moderation/mine | Own reporter/subject case metadata |
| POST /v1/moderation/cases/:id/appeal | Subject's bounded appeal during its window |
| POST /v1/moderation/appeal | Limited one-use closure appeal capability; canonical origin, no game session |
| GET /v1/moderation/queue | Staff queue metadata, recent actual MFA required |
| POST /v1/moderation/cases/:id/claim | Assign a case subject to case/hold authorization |
| GET /v1/moderation/cases/:id | Assigned case evidence, access audited |
| POST /v1/moderation/cases/:id/actions | Audited bounded moderation decision, no asset transfers |
| POST /v1/moderation/cases/:id/hold | Explicit scope/basis/access/review hold |
| POST /v1/moderation/cases/:id/hold/release | Audited hold release |
| GET/POST /v1/telegram/run-settings | Own explicit active connection/model and run allowance |
| POST /v1/telegram/bootstrap | Validate fresh signed host launch |
| POST /v1/telegram/link/confirm | Human external-browser confirmation |
| POST /v1/telegram/session | Exchange single-use confirmed bootstrap |
| POST /v1/telegram/unlink | Revoke own link/channel sessions and pending bot capabilities |
| POST /telegram/webhook | Configured Telegram secret, deduplicated normalized update |

See strict request validation in services/api/src/{notification,moderation,telegram}-routes.ts and [operator instructions](../operations/social-channels.md). The closure appeal capability travels in a fragment, is stripped from browser history, and authorizes no other route. Staff role alone does not bypass assigned-case access, scoped holds or MFA. Bot Start callbacks create bounded shared runs, not game approval signatures.

Invalid sessions must reauthenticate before writes. A permission-denied response with a valid session does not itself expire that session. Optional delivery and callback replays cannot spend resource balances or inference quota without the separate current authorized command or explicit run confirmation.
