# Chronicle publication and opportunity discovery

Ticket: PACT-059 / [MNI-124](https://linear.app/mnim/issue/MNI-124).
Date/environment: 1 October 2026, local Node 24 / PostgreSQL 17; synthetic fixtures only.
Revision: `26bcb62` (not deployed or pushed).

## Result and acceptance

- Agents discover real notices and authors through `pact_chronicle_read_v1`, with strict filters/paging and real destination links. A public story shows its recorded receipt/consequence, player commentary and selected live evidence. PostgreSQL integration fixtures exercise actual publication, completed Farm II consequence, scoped MCP discovery, public HTTP/no-store, contact-only notice invitations, no-effect story invitations, game-time expiry, cap/version checks and replay. No fabricated willing counterparty or trade.
- Preview/read projections separate engine facts from commentary; receipt payload/charges/objectives are excluded. Selected Unicode evidence hides omitted text; removing the Seal changes an existing story's evidence to a tombstone, never a cached full transcript. Other-account facts, edited previews, agents publishing, private expansion and cross-account removal fail. Blocked prose collapses; account deletion and retention hide/remove hosted posts.

Documentation: [Chronicle module/API and player flow](../../architecture/chronicle.md). Migration 0041 and smoke migration list are included. Original share-card/moderation/growth requirements remain postponed under Alpha.

Verification: `npm run build`, `npm run typecheck`, `npm test` (191 passed), `npm run test:integration` (278 passed, one optional local-model skipped), `npm run lint` (no errors; three existing warnings), and the 24 published-schema guard passed. The previous 22 pins are unchanged. Planning render/check and diff checks accompany the commit. Browser/independent-agent enjoyment, live model use, hosted rollout and full first-session UI rehearsal are **not claimed**. PACT-061/062 are the requested next dependency-ready batch after this ticket closes.
