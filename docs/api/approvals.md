# Exact-command approvals

Tickets: PACT-020.

`@pact/approvals` stores immutable approval requests keyed by `(product_scope, command_id)` with a canonical command hash, effects summary, preconditions, and a 15-minute expiry (earlier deadlines can be layered later).

## HTTP

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/v1/approvals/:approvalId` | Authenticated status/review; never commits |
| `GET` | `/approvals/:approvalId` | Deep-link review surface; opaque ID only, never a bearer approval secret |
| `POST` | `/v1/approvals/:approvalId/approve` | Human session cookie, exact Origin, and CSRF token required; commits the exact stored command once |
| `POST` | `/v1/approvals/:approvalId/reject` | Human session cookie, exact Origin, and CSRF token required; records a rejected receipt |

Double approve returns the original receipt. Expired or changed terms fail. Chatbot text and host tool confirmations are not approval credentials—only the human POST path commits.

Request creation is idempotent only for the same product, account, command ID, and canonical action terms. Reusing a command ID with changed terms fails `INVALID_TERMS`; a different account cannot retrieve the existing request through that ID. The stored effects summary is server-owned in any production proposal path. As of 25 Sep 2026, the production agent proposal entry point is not yet wired; an unmandated game command is denied rather than returning an approval deep link. Do not represent this as completed approval-inbox behavior for PACT-049.

Private responses set `Cache-Control: no-store`.
