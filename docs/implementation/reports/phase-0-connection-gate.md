# Phase 0 connection experiment gate

Ticket: PACT-027 / MNI-91
Implementation revision/PR: uncommitted gate record after `4b17005`
Verification date/environment: 23 September 2026, local Node 24/PostgreSQL fixtures and single VPS release `mvp-20260923-2`

## Result

Phase 0 passes the Version 1.4 private synthetic-MVP gate. All 30 non-gate Phase 0 tickets are done with durable evidence. The environment provides synthetic signup, identity/recovery/privacy lifecycle, encrypted model credentials, five recorded provider adapters, OAuth/MCP/authority/approval/inbox/run contracts, shared clients, the real Telegram test bot, fail-closed operator configuration, and a truthful public compatibility matrix. No live economy or public production-support claim is exposed.

## Acceptance evidence

| Criterion | Result and primary evidence |
| --- | --- |
| A01 Identity | Pass: identity/onboarding reports plus repeated connection harness. |
| A02 Provider matrix | Pass for recorded fixtures: provider contract/adapter reports and five repeated harness runs; live keys remain PACT-079. |
| A03 MCP matrix | Pass for shared OAuth/MCP fixtures and both protocol versions; unavailable real hosts are labeled `not_tested`/`fixture_only`. |
| A04 Closed browser/process | Pass: bounded durable run and inbox/outbox reports; no notification-started inference. |
| A05 Approval integrity | Pass: OAuth/authority, dispatcher, approvals, replay/expiry, and malicious-message fixtures. |
| A06 Data | Pass: single-VPS/privacy/operator reports, deletion-registry restore replay, synthetic public notices, export/deletion and redaction. |
| A07 Setup usability | Pass for Version 1.4 automated scope: 5/5 repeated runs; human study is explicitly PACT-079. |
| A08 Channel authentication | Pass: real Telegram test-bot evidence plus local native PKCE fixtures; signed native devices remain release work. |
| A09 Module contracts | Pass: boundary enforcement, generated contracts/SDK, and truthful client matrix. |

## Documentation

- [MVP connection certification](../../operations/connection-certification.md)
- [Single-VPS deployment](../../operations/vps-deployment.md)
- [Assistant compatibility](../../api/client-compatibility.md)
- Linked completion reports for every Phase 0 task in `docs/implementation/tasks.json`

## Decisions and limitations

This gate accepts deterministic synthetic fixtures for the private MVP only. It does not convert unavailable third-party hosts into supported routes. PACT-079 retains real provider keys, eligible ChatGPT/Claude/Gemini/xAI clients, client versions/plans/distribution, and the five-unfamiliar-person study. PACT-098 retains production operator/legal facts.

## Handoff

Phase 1 may begin at PACT-028. No real economic world is activated by this gate; PACT-031 owns exactly-once activation after the rules/clock/ledger foundation exists.
