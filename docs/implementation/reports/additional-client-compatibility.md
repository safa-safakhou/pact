# Additional assistant client compatibility

Ticket: PACT-086 / MNI-89
Implementation revision/PR: `b58d7f4`
Verification date/environment: 23 September 2026, Node 24 local workspace and VPS release `mvp-20260923-2`

## Result

PACT now publishes a typed additional-client compatibility document at `GET /v1/client-compatibility`. It records model API support independently from real client certification, consumer-app installation, authentication/billing, proven capabilities, readable/writable surfaces, client version/date, evidence, and limitations.

The MVP result is intentionally not a live-client certification claim: Gemini CLI is `not_tested`; the Grok-powered external tool-client route is `fixture_only`. Version 1.4 defers unavailable real-host certification to PACT-079, and the deployed endpoint publishes those exact limitations.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-086 | Named supported routes have real fixture evidence; unsupported consumer-app connections are not advertised as working. | `services/api/src/capability-routes.test.ts`; `packages/model-provider/src/provider-adapters.test.ts` | Partial pass: typed matrix prevents unsupported claims and links recorded xAI model fixture. Real client routes remain uncertified. |
| PACT-086 | Grok/Gemini fixture routes keep receipts/authority and scoped game credentials separate from subscription login. | Matrix authentication/capability fields and shared fixture suite | Pass for MVP fixture scope; live OAuth/read/write/approval/revoke host certification is mandatory in PACT-079. |

## Documentation

- [Assistant client compatibility](../../api/client-compatibility.md)
- [MCP transport](../../api/mcp.md)

## Decisions and limitations

No test value can substitute for evidence from the named third-party client. Recorded provider adapter fixtures remain useful implementation evidence but do not become host certification. Empty capabilities are published for Gemini CLI; the Grok fixture lists only the recorded read/write behavior and explicitly withholds OAuth, approval, and revoke claims.

## Handoff

PACT-026 consumes the truthful matrix and repeated fixtures. PACT-079 must later use eligible real clients and credentials, record versions/date, run the live standard OAuth/MCP fixture, and update a row to `certified` only for capabilities that actually pass.
