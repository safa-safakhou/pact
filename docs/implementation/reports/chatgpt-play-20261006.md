# PACT-131 — ChatGPT play, 6 October 2026

Founder authorized implementation and deployment. Source changes are uncommitted. Hosted release: `chatgpt-play-20261006-3`. Linear issue creation failed at the workspace free issue limit; the local ticket and this report record execution. The 24 Later tasks remain deferred.

## Result

Personal ChatGPT MCP connection uses discovered OAuth/DCR, PKCE, audience-bound grants, issuer responses and nickname entry during account linking. Private notes accept arbitrary text (8,000-character storage limit), are editable by authenticated agents, and reject stale version writes. The old `ambition` field is retained as a compatibility name, with its enum removed. Strategic development recommendations and ambition-based upgrade sorting were removed. Mechanical rules and human permissions retain their existing handlers.

`pact_play_view_v1` loads an inline MCP App and useful structured results without the widget. It shows the owner's actual correspondence, contact requests, offers, signatures, contracts and public players. Human/agent authorship comes from stored authenticated sender audience (`agent_originated`); the adapter never guesses from writing style. Displayed messages acknowledge delivery through the existing domain reader. The iframe has no external network/resource permissions or bearer credentials and renders untrusted strings with `textContent`. Refresh reads game state through the standard host bridge and does not launch inference.

## Acceptance evidence

| Check | Actual result |
| --- | --- |
| Node 24 `npm run build` | Passed; existing large web chunk warning remains |
| `npm run typecheck`; `npm run lint` | Passed; existing non-fatal style diagnostics remain; 26 published v1 schemas unchanged |
| `npm test` | 291 passed |
| Final `npm run test:integration` | 322 passed, 1 optional model comparison skipped; 51 suites passed |
| Notes integration | Arbitrary Unicode/markup persisted privately; stale write saved nothing; other owner untouched; export/forget preserved economics |
| MCP integration | Owner-bound session, read/write scopes, injected ownership rejection, resource delivery and OAuth metadata covered |
| Message provenance integration | Authenticated agent messages projected as agent authorship; existing message delivery/read behavior passed |
| Browser MCP App fixture | Synthetic host initialized; actual component rendered exchanges and signature status; refresh worked; script-like message displayed literally |
| Hosted deployment verification | `infra/production/bin/verify.sh` passed against HTTPS site |
| Hosted compatibility probe | `node scripts/chatgpt-smoke.mjs https://safa.dedyn.io/pact --create-synthetic-player` passed: 26 tools, HTML resource, OAuth, notes persistence/stale rejection, one self-owned farm queue and duplicate replay. Lease closed; grant revoked. Zero model calls and zero counterpart writes. Synthetic kingdom `82313fbd-1a00-4d97-9eaa-8c68e6f09fca`. A preceding failed join while paused left one unactivated synthetic guest draft. |
| ChatGPT web discovery | Actual personal MCP creation form discovered auth/token/registration/resource URLs and selected DCR; prepared scopes world:read and game:act |
| Actual ChatGPT installation/play | Pending human confirmation for the final account access grant; not yet certified as installed or played in ChatGPT |
| Planning/whitespace | `backlog.py render`, `backlog.py check`, `git diff --check` passed |

Two initial integration failures were fixture expectations for additive OAuth tool metadata and migration 0052; both were corrected and the final full suite passed. The hosted probe first caught disabled nickname entry (HTTP 404), then the paused world (HTTP 409). The protected deployment environment now persistently sets `PACT_GUEST_PLAY=1`; the normal world recovery resolved the pause. No failed check is represented as successful.

## Operational recovery

The VPS root disk was full, preventing PostgreSQL and game processes from starting. Disposable Docker build-cache pruning reclaimed 3.393 GB. Old unused PACT MVP/September Alpha release images were removed without forcing removal of active containers; current and recent rollback images were preserved. No game volume, original player or backup snapshot was removed.

A 10,878,976-byte partial archived WAL segment was preserved under `.incomplete-20261006-*`; PostgreSQL re-archived the complete 16,777,216-byte segment. PostgreSQL recovered and API health returned. The archive command now copies to a temporary file and renames only after completion, accepts an identical already-archived segment on retry, and refuses a mismatching existing final archive. Pre-change encrypted base/WAL backup succeeded: snapshot `b8b81aff`. Post-change encrypted base/WAL backup succeeded: snapshot `f168fbd2`. Final cache cleanup reclaimed another 3.549 GB; root had 7.8 GB free (79% used). The resumed clock advanced normally to ticks 13986 and 13987, with one game minute per wall minute.

The world had paused at committed game time 1791221040000, tick 13985, with TICK_DELAYED. Its last tick's timestamp and rules ID matched the clock. After migrated services were healthy, `pact-entrypoint node workers/rules/dist/control.js resume` resumed through the existing service, preserving committed game time and scheduling the next tick one wall minute later. No missed production, starvation or other game ticks were backfilled. The documented development `npm run clock` command first failed in the pruned runtime because tsx is a dev dependency; the built control CLI succeeded. The population runner and its finished 200-request budget were not restarted or altered.

## Documentation and handoff

[Product extension](../../pact/chatgpt.md) explicitly supersedes fixed ambition choices. [Installation and play instructions](../../operations/chatgpt-play.md) describe OAuth entry, notes, actual interactions, permissions and the current Work-chat route. The public plugin directory and Later production certification gates are outside this personal installation assignment. PACT-131 remains in progress until final user account linking and an actual ChatGPT call are verified.
