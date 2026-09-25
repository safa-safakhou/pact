# Exact-command approvals

Tickets: PACT-020; PACT-049 in progress.

`@pact/approvals` stores immutable approval requests keyed by `(product_scope, command_id)` with a canonical command hash, effects summary, preconditions, and a 15-minute expiry (earlier deadlines can be layered later).

## HTTP

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/v1/approvals/:approvalId` | Authenticated status/review; never commits |
| `GET` | `/approvals/:approvalId` | Deep-link review surface; opaque ID only, never a bearer approval secret |
| `POST` | `/v1/approvals/:approvalId/approve` | Human session cookie, exact Origin, and CSRF token required; commits the exact stored command once |
| `POST` | `/v1/approvals/:approvalId/reject` | Human session cookie, exact Origin, and CSRF token required; records a rejected receipt |

Double approve returns the original receipt. Expired or changed terms fail. Chatbot text and host tool confirmations are not approval credentials—only the human POST path commits.

Request creation is idempotent only for the same product, account, command ID, and canonical action terms. Reusing a command ID with changed terms fails `INVALID_TERMS`; a different account cannot retrieve the existing request through that ID. Hashing normalizes the versioned action schema before comparing a submitted proposal with PostgreSQL's reordered JSONB action.

`pact_approval_propose_v1` is the first production proposal route, currently limited to `game.contact.request`. It accepts `{commandId, action}` with no account or actor field. An active `game:act` MCP session or in-app Envoy run can request review; the server derives ownership, checks the exact write lease in the insert transaction, and renders the two-Silver/one-action conditional effect summary. A proposal writes the pending approval, one owner inbox event, and an outbox event atomically; it does **not** debit stock or create the contact request. MCP returns `APPROVAL_REQUIRED` with an absolute PACT deep link. The model gets a bounded review-path result. Exact replay returns the same request, while changed terms fail. Read-only grants and human-only contact answers cannot use this tool. Other game actions still need proposal-specific effect and deadline validation; a denied ordinary command does not automatically become a proposal.

Only the first-party human POST may commit the stored action. On successful commit the owner inbox and outbox record resolution. If admission produces a noncommitting receipt such as `WORLD_PAUSED`, approval remains pending and the HTTP route returns `NOT_COMMITTED` (409); it does not claim an approved outcome. Expiry and current gameplay state are rechecked on each attempt. This is a local synthetic path, not live-host certification or a claim that every approval group is complete.

Private responses set `Cache-Control: no-store`.
