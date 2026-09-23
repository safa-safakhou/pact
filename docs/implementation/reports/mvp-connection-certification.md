# MVP connection certification

Tickets: PACT-026 / MNI-90 and PACT-086 / MNI-89
Implementation revision/PR: uncommitted working tree after `b58d7f4`
Verification date/environment: 23 September 2026, Node 24 local workspace and VPS release `mvp-20260923-2`

## Result

The private MVP has a repeatable five-run synthetic certification harness plus a truthful public assistant-client matrix. All five repetitions passed. Each repetition ran 12 provider/compatibility unit checks and 16 signup, OAuth, MCP, approval, revoke/error, OpenRouter, and Telegram integration checks. Recorded durations were 6.869s, 6.634s, 6.584s, 6.546s, and 6.653s.

Unavailable real clients and credentials are not labeled supported. Gemini CLI remains `not_tested`; the Grok-powered external-client route remains `fixture_only`. The real-account, live-key, distribution, and unfamiliar-human study is deferred to PACT-079 and remains mandatory before production advertising.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-086 | Recorded routes have fixture evidence and unsupported clients are not advertised. | `GET /v1/client-compatibility`; capability route tests; provider fixtures | Pass for MVP fixture scope; live certification deferred to PACT-079. |
| PACT-026 | Each synthetic route passes five repeated automated outcomes. | `npm run certify:connections` | Pass: 5/5 repetitions, 28 focused checks per repetition. |
| PACT-026 | Fixtures cover signup, OAuth, reads/writes, approval/results, expiry/revoke/disconnect boundaries and truthful distribution. | Focused unit/integration suite and [connection certification guide](../../operations/connection-certification.md) | Pass for deterministic fixtures; external account and human timing are explicitly excluded and deferred. |

## Documentation

- [MVP connection certification](../../operations/connection-certification.md)
- [Assistant client compatibility](../../api/client-compatibility.md)
- [MCP transport](../../api/mcp.md)

## Decisions and limitations

The Version 1.4 milestone separates a shippable private synthetic MVP from production host certification. Automated timing is reported only as fixture duration and is not mislabeled as human setup time. No fake provider key, subscription entitlement, client version, or tester observation was invented.

## Handoff

PACT-027 can evaluate the Phase 0 connection experiment against the synthetic-MVP criteria. PACT-079 owns real keys, eligible ChatGPT/Claude/Gemini/xAI clients, distribution status, and five unfamiliar people per named route before release support is advertised.
