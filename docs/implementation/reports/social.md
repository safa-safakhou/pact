# PACT-036 — Contacts, bounded messages, and transfers

Ticket: [PACT-036 / MNI-100](https://linear.app/mnim/issue/MNI-100/pact-036-implement-contacts-bounded-messages-and-direct-transfers)
Implementation revision/PR: uncommitted local checkout at verification time
Verification date/environment: 23 September 2026, Node 24, PostgreSQL 17 synthetic schemas

## Result

Authenticated-account social ports now provide accepted contacts, paid cold requests, expiring direct invitations, bounded private threads, unread/read state, minimal block/mute state, and one-off ordinary-resource transfers. They are internal server commands awaiting the later public gameplay API/MCP handlers.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| Full queues reject before charging; blocked pairs cannot send text, new offers, or gifts in either direction. | `tests/integration/social.test.ts` | A ninth cold request leaves both Silver and quota intact. The reciprocal block rejects messages and transfers; the offer guard is shared with PACT-037. |
| A transfer charges once and never guarantees a return payment; notification traffic does not consume player-message allowance. | Same integration test | A replay returns the original transfer/overflow, sender stock falls once, transfer quota increments once, and message quota stays zero. Outbox events carry no player-message debit. |

## Documentation

[Social module and operations](../../architecture/social.md), [module map](../../architecture/modules.md), [world-clock phase order](../../architecture/world-clock.md). Migration `0024_social_contacts.sql` is additive. Privacy retention/export is updated for private messages, requests, and transfer history.

## Decisions and limitations

Direct-contact invitations are scoped to controlled tests; they do not bypass authenticated account ownership. Message text is never copied into outbox payloads. Later command handlers must connect these internal ports through the shared dispatcher and enforce human/agent authority; no hosted CI, deployment, or player test was run. Existing supply/garrison settlements continue despite a block.

## Handoff

PACT-037 can use the reciprocal block guard for new offers and the existing offer-action counter. Its signatures, bonds, and contracts remain separate from contact establishment and direct gifts.
