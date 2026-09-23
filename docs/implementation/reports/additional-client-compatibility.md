# Additional assistant client compatibility

Ticket: PACT-086 / MNI-89
Implementation revision/PR: `b58d7f4`
Verification date/environment: 23 September 2026, Node 24 local workspace and VPS release `mvp-20260923-2`

## Result

PACT now publishes a typed additional-client compatibility document at `GET /v1/client-compatibility`. It records model API support independently from real client certification, consumer-app installation, authentication/billing, proven capabilities, readable/writable surfaces, client version/date, evidence, and limitations.

The current result is intentionally not a certification claim: Gemini CLI is `not_tested`; the Grok-powered external tool-client route is `fixture_only`. The environment has no Gemini CLI binary and no Gemini/xAI test credentials. The deployed endpoint publishes those exact limitations.

## Acceptance evidence

| Ticket | Acceptance criterion | Check/artifact | Actual result |
| --- | --- | --- | --- |
| PACT-086 | Named supported routes have real fixture evidence; unsupported consumer-app connections are not advertised as working. | `services/api/src/capability-routes.test.ts`; `packages/model-provider/src/provider-adapters.test.ts` | Partial pass: typed matrix prevents unsupported claims and links recorded xAI model fixture. Real client routes remain uncertified. |
| PACT-086 | Grok/Gemini routes share receipts/authority and scoped game credentials without treating subscription login as API credentials. | Matrix authentication/capability fields; live host fixture | Blocked: contract is explicit, but no eligible Gemini CLI or xAI client/key is installed to run the live OAuth/read/write/approval/revoke fixture. |

## Documentation

- [Assistant client compatibility](../../api/client-compatibility.md)
- [MCP transport](../../api/mcp.md)

## Decisions and limitations

No test value can substitute for evidence from the named third-party client. Recorded provider adapter fixtures remain useful implementation evidence but do not become host certification. Empty capabilities are published for Gemini CLI; the Grok fixture lists only the recorded read/write behavior and explicitly withholds OAuth, approval, and revoke claims.

## Handoff

Install an eligible Gemini CLI and provide test-only Gemini and xAI API access/quota. Then run the live standard OAuth/MCP fixture, record client versions and date, and update the matrix to `certified` only for capabilities that actually pass. PACT-026 remains blocked on this ticket.
