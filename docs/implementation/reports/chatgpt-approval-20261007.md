# PACT-131 — understandable human approval, 7 October 2026

The founder reported being unable to understand or approve a blocked action. Read the actual ChatGPT conversation and the open approval link. The blocked building request was inspected with its exact recorded effects. The old deep link selected Envoy but required the human to find a collapsed technical area, read/paste an approval ID and click Preview before any decision buttons appeared. A previous request had expired; ChatGPT's explanation also confused approval with a permit that the agent would execute later. The first-party human POST actually dispatches the exact command.

## Change

Approval links now open a focused review after existing account authentication. The request loads automatically through the same owner-authorized GET. It shows the exact server-recorded effects, a readable Market title and cost derived from that description, real-time expiry, and explicitly labeled Approve/Decline buttons. IDs and raw JSON are absent. No game values are recalculated in the UI. Approval covers one action and leaves future agent authority unchanged. The human POST uses existing cookies/CSRF and the shared dispatcher; opening a link never approves. Duplicate clicks are guarded while a write is pending. An uncertain write re-reads status and never invents success. Expired requests lose decision controls and explain the fresh-proposal recovery. Resolved views distinguish submitted/queued actions from completed buildings.

Envoy also lists existing pending decisions instead of a manual ID form. The ChatGPT play projection includes only the authenticated owner's pending requests and their first-party review URLs. A journal notice uses ui/open-link to open the human review, never exposing human approval as an agent tool. UI resource content hashing publishes the updated template. Existing leases, mandates, account grants, ordinary economy, cold-contact acceptance and the completed population run are unchanged.

## Checks and hosted evidence

- Web build, hosted /pact/ asset build, API and MCP builds and full typecheck pass. Existing bundle-size/informational lint warnings remain nonfatal.
- Four new UI tests pass: correct action and server cost without manual IDs/Preview, exact deadline removes controls, resolved requests cannot approve again and do not claim construction completion, disconnected humans cannot decide.
- Existing MCP/approval integration suite: 12 passed, including authority and human approval/rejection failure paths. Logs: /tmp/pact-approval-tests.log, /tmp/pact-approval-integration.log, /tmp/pact-approval-types.log.
- Release **chatgpt-approval-20261007-3** deployed; API healthy and existing workers/gateway running. Hosted deployment verification passes (/tmp/pact-approval-hosted.log).
- Reloaded the founder's actual approval link in Chrome. The exact Market request loaded automatically with its server cost, pending countdown and labeled buttons; no dashboard, Preview or UUID entry. Left that page open. Screenshot: pact-market-approval-live.jpg in the task visualization directory. Only GET/Preview/read/reload operations were performed; no human approval, rejection, mandate change or game command was submitted by Codex.
- Actual approve/decline on the new browser UI remains the human's decision. ChatGPT pending-notice presentation is deployed, but a new ChatGPT response containing that notice has not been claimed as verified. No additional message was sent into the gameplay conversation.

## Release reproduction and tracking

Server disk headroom was only 1.3 GiB. To avoid duplicating production dependencies during a full build, this release derives images from the pinned, already tested chatgpt-journal-20261007-2 runtime/gateway. Compiled Node 24 API/MCP artifacts replace only their dist directories, and the /pact/ web build replaces only /srv/web. No dependencies or migrations changed. Recipe and artifacts are retained under /srv/pact/state/releases/chatgpt-approval-20261007-3-artifacts/Dockerfile; /tmp/pact-approval-deploy.sh records the activation, and the prior release remains rollback. Source changes are synchronized to /srv/pact/source for the normal full Dockerfile build on later releases. Obsolete -1 intermediate tags/dangling manifests were removed non-forcibly; current/rollback images and all data volumes remain.

PACT-131 was reopened for this founder-authorized usability correction. Linear issue creation previously failed at the free issue limit; the local tracker and report retain the execution record. No deferred roadmap work, population runner, model budget, commit or push is authorized by this repair.

At 17:23 Berlin time, reloaded the actual request: the server reported expired and the focused page removed all decision buttons and explained recovery. The prior expiry was 17:22:30. Screenshot pact-market-approval-expired.jpg records the real expired state. The installed PACT_test Refresh tools operation completed without changing account/scopes. Codex asked the founder for explicit authorization before sending any fresh-proposal prompt into the gameplay conversation; that human reply was pending at this checkpoint.
