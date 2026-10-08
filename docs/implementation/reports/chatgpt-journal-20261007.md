# PACT-131 — ChatGPT kingdom journal, 7 October 2026

## Assignment and observed problem

The founder rejected the live chat presentation: raw JSON under “Full factual snapshot,” UUIDs on correspondence, bare unsearchable public identities, and dashboard-like resource tiles. The existing ChatGPT conversation was read in the human's browser. It showed Farm/Mine II committing after the reconnect correction and subsequently completing, Market II completing, Storehouse II active, four Spearmen training, and two real outgoing introductions still awaiting human acceptance. No reciprocal negotiation had occurred. Hall II was inaccurately described as upgrading by the assistant before a later snapshot showed it waiting. The owner snapshot had Farm II, Barracks I, and Storehouse I; the shared rules require Barracks II before Hall II can start. The displayed 614-minute turn duration is a host display observation, not proof of continuous model execution.

## Changes

- Replace the inline diagnostic panel with a self-contained kingdom journal: illustrated settlement, forge/treasury/granary, whole displayed supplies, separately labeled founding supplies, completed buildings, construction state, training, home troops and approaching threats.
- Surface owner-only missing Hall prerequisites from the shared pure checkUpgrade rules. A waiting instruction stays waiting, without a fabricated completion timer or a claim that permission/resource checks have passed. Builder targets do not depend on the bounded recent-consequence page.
- Remove raw snapshots, UUIDs and raw timestamps from player HTML. Exact structured records remain available to agents; compatibility JSON text is marked for assistant audience.
- Present real introduction notes as letters with named counterpart, direction, expiry and human acceptance requirements. Group actual messages by counterpart with recorded human/agent authorship. Show trade flow, duration, notice, bonds and signature states; troop agreements show units, duration, bonds, signatures and the existing seizure consequence. Do not invent another agent's motives, emotions, replies or online presence.
- Search names and handles across active unmoderated ranked kingdoms, both guests and registered accounts. Eight records per page, previous/next controls, public Hall levels, and authenticated public-record inspection. The explicit visibility correction in docs/pact/chatgpt.md exposes Hall level only; stockpiles, other buildings, armies, notes and private messages stay private. Search is literal and parameterized, including wildcard characters; deterministic ordering avoids repeated page records when the dataset is unchanged.
- Preserve the existing plugin, scopes, leases, command handlers, mandates and economy. No model inference, counterpart commands or permission expansion from UI controls. The illustration is original inline SVG; untrusted prose uses textContent.

## Validation

- Full application build and typecheck passed. Lint, architecture boundaries, build order and 26 published v1 schema checks passed with existing nonfatal informational/chunk-size warnings.
- Full integration suite: 325 passed, one optional live-model comparison skipped, 51 files. Logs: /tmp/pact-journal-integration.log.
- Unit suite: 291 passed, 90 files. /tmp/pact-journal-unit.log.
- Final owner-projection checks after builder-target addition: 14 passed. /tmp/pact-journal-world-final.log.
- New regression checks cover public search, registered-player discovery, eight-record pagination, closed-account and self exclusion, exact public field allowlist, literal wildcard search, invalid offsets/MCP inputs, Hall prerequisite correction and owner queue privacy.
- Chrome visual/interaction review uses a **synthetic local host fixture**, not real diplomatic replies: whole supplies, active/waiting construction, letters, paired Envoy messages, readable trade proposal; next page shows distinct records; searching Orbit resets to page one; public detail opens; 390px layout reviewed and viewport reset. The real ChatGPT conversation remains untouched. Local Playwright frame clicking did not switch the tab; native accessibility clicking did, and final states were verified. No application error was observed.
- Preview screenshots in the task visualization directory: pact-journal-correspondence.jpg and pact-journal-mobile.jpg. The depicted correspondence is synthetic and must not be described as a real exchange.

## Deployment and handoff

Release **chatgpt-journal-20261007-1** is deployed. Hosted deployment verification and the expanded OAuth/MCP smoke pass: searched public Hall records have only the approved fields, the new journal HTML is served, free-form notes persist and reject stale writes, a self-owned Farm queue commits after run.open, and the original receipt replays across reconnects. Synthetic kingdom dde0b256-35e3-4217-92c3-d5610175d665; its lease was closed and OAuth grant revoked. Zero model calls and counterparty writes. /tmp/pact-journal-hosted-final.log. This first release reused the old UI resource URI and therefore did not deliver new HTML to the installed ChatGPT plugin; the correction below supersedes the initial fresh-load guidance. A new plugin or expanded OAuth grant is not required. Actual fresh ChatGPT-host rendering remains a user follow-up; local preview alone is not host certification.

The population experiment remains finished. No runner restarted, new model budget, additional roadmap task or economic change. At release -1, PACT-131 remained in progress pending the final external experience handoff; the 24 Later tasks remain deferred. Changes are uncommitted and no hosted CI result is claimed.

## Shared gateway correction

The first hosted verification stopped at a public 404 before the synthetic probe ran: the domain had been cut over to Tiny Agent Tools' Caddy at /srv/tiny-agent-tools/current/deploy/Caddyfile, while the old Agentic World Caddy configuration already contained PACT routing but was inactive. The PACT loopback readiness endpoint was 200 and all new-release processes were healthy. Restored only /pact/* and PACT-specific OAuth/signing metadata routes in the active gateway, preserving the root app, Cloudflare proxy/IP handling, certificate volumes and domain settings. A second check found the missing Telegram frame exception; restored the previous scoped /pact/telegram/* header behavior. Final verification passes. Root and PACT pages both return 200; the merged Tiny Agent Tools compose configuration validates.

The active Caddy was attached to the existing pact-edge network, which contains the PACT gateway rather than private game services. Its existing compose.server.yaml now preserves that association on restart. Pre-change nonsecret configurations are retained in /srv/tiny-agent-tools/ops/pact-routing-pre-20261007. Repository reference files: infra/production/tinyagenttools-toolbox.caddy and infra/production/tinyagenttools-toolbox.server.yaml. Future Tiny Agent Tools release cutovers must retain these PACT routes/network association; this repository's old Agentic World gateway file is not the active edge.

Opening the existing card's viewer in the actual ChatGPT conversation retained the archived diagnostic HTML. The viewer was closed and no chat message/game command was submitted through the browser. This was insufficient verification: the next actual 12:14 ChatGPT tool call also rendered old HTML while receiving new paginated kingdom data. New ChatGPT-host rendering was not achieved by release -1.

Docker build/export temporarily reduced disk headroom. Disposable build cache was pruned without touching data volumes. Obsolete intermediate PACT image tags were removed non-forcibly, retaining all container-referenced images, current and previous ChatGPT releases and final Alpha/experience/social/friends/population milestone images. Other applications' images and backups were not removed.

Post-cleanup disk headroom: 2.7 GiB free (93% used); 41 obsolete intermediate PACT image tags removed. Current release and rollback image references remain available.

## Embedded-view cache correction

The founder reported that a new ChatGPT response still displayed the old interface. Read that actual response in Chrome: it contained updated resources, eight alphabetically sorted kingdoms and the new Barracks prerequisite in assistant prose, but retained UUIDs and “Full factual snapshot” in the iframe. The plugin Manage page confirmed the correct tinyagenttools.com/pact/mcp endpoint. This isolates the failure to presentation delivery rather than stale server game data.

OpenAI’s UI documentation explicitly treats the resource URI as the cache key: https://developers.openai.com/plugins/build/chatgpt-ui. The previous change incorrectly retained ui://pact/play-v1.html. The adapter now generates its resource URI from the SHA-256 hash of its HTML; tools/list, both template metadata aliases and resources/list agree on that URI. The old v1 URI remains readable under the same owner-bound session/scopes for compatibility. Unknown resources are rejected. No tools, accounts or authority grants are replaced. Regression coverage checks the published URI and both descriptors, current/legacy reads and invalid-resource rejection.

Local MCP build/typecheck and the focused MCP integration suite pass (12 tests). Logs: /tmp/pact-cache-test.log and /tmp/pact-cache-types.log. Release **chatgpt-journal-20261007-2** is deployed; /tmp/pact-cache-deploy.log records the healthy API and running workers/gateway. Hosted deployment verification passes (/tmp/pact-cache-hosted.log). Disposable build cache reclaimed 888.5 MB; final disk headroom 1.5 GiB (96% used), with current and rollback images retained.

### Actual ChatGPT host verification

The founder explicitly authorized sending “Load PACT and show my kingdom; do not take any game actions” in the existing Play Kingdom Strategy conversation. After deployment, selected Refresh tools on the installed PACT_test Manage page, retaining the same account, endpoint and permissions. Sent precisely the authorized request. The new tool response rendered the kingdom journal in that actual conversation: the existing kingdom illustration, readable supplies, completed levels and a queued building with its missing prerequisite, and no raw factual snapshot or UUIDs in the new card. ChatGPT’s response explicitly reported no game actions. No gameplay tool was invoked through the UI.

Opened that new card in the host’s app viewer. Correspondence displays actual outgoing requests with their recorded acceptance state, without invented replies. The Discover kingdoms tab lists eight public Hall-level cards; Next fetched a distinct page 2 through the authenticated host bridge. Actual screenshots are pact-chatgpt-live-kingdom.jpg and pact-chatgpt-live-correspondence.jpg in the task visualization directory; these private local images depict the user’s kingdom and requests and are excluded from Git, superseding the earlier synthetic-only preview evidence.

Searching an existing public handle fetched its matching public result and reset pagination to page 1; View kingdom loaded its public profile. Saved pact-chatgpt-live-discovery.jpg and left the actual correspondence viewer open. The approved read-only request and UI reads did not open a write lease or commit game commands.

PACT-131 is now **done** in the local execution record: its dependencies are done and its acceptance items have deployed MCP/OAuth, regression and actual consumer-host evidence across the linked reports. Linear issue creation previously failed at the workspace’s free issue limit; no new Linear issue/status is claimed. The 24 Later tasks remain deferred and no next implementation queue is authorized. No commit or push was made.
