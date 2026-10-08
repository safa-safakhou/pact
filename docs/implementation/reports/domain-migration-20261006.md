# Owned domain migration — 6 October 2026

## Assignment and outcome

The founder authorized replacing safa.dedyn.io with the newly purchased tinyagenttools.com, then explicitly included Agentic World so the old hostname could be retired. This extends the PACT-131 hosted integration assignment; the 24 Later roadmap tasks remain deferred. Source changes are uncommitted.

Agentic World is at https://tinyagenttools.com/; PACT is at https://tinyagenttools.com/pact/; PACT MCP is at https://tinyagenttools.com/pact/mcp. The old hostname is removed from the shared edge's active site configuration. Historical playtest reports retain their original URLs as evidence.

## Changes

Cloudflare DNS now has DNS-only A records for the apex and www, both pointing to 2.28.57.254. Caddy acquired valid Let's Encrypt certificates and manages renewal; HTTP redirects to HTTPS and www redirects to the apex. The apex certificate expires 4 January 2027. No Cloudflare HTTP proxy or flexible TLS is used.

PACT's protected deployment environment now uses the new browser origin and public base URL, preserving guest entry and all existing secrets. Active installation/operations instructions, operator notice URLs and the default synthetic mail sender use the new domain. Web asset paths remain /pact/ and /pact/telegram/.

Agentic World's protected deployment.env PUBLIC_HOSTNAME and encrypted product.humanWorkspacePublicOrigin now use the new domain. Its runtime secret files were regenerated without displaying credentials. Case host, human workspace and edge were recreated from the existing images. The shared edge's pact-edge network attachment is now declared in Compose so recreating it does not lose PACT connectivity. Databases and application data volumes were preserved. Root-readable rollback configurations are in /srv/pact/state/pre-tinyagenttools-* on the VPS; they are not repository artifacts.

## Actual checks

- Cloudflare UI: two saved A records; authoritative Cloudflare and 1.1.1.1 return 2.28.57.254.
- Caddy configuration validation passes; certificate verification succeeds from the VPS. HTTPS PACT responds 200; Agentic World root responds 303 to its existing sign-in flow; /health and /pact/ready respond healthy/ready. HTTP and www redirects return 308.
- Agentic World's case host and human workspace are healthy; PACT API and database are healthy and its workers run.
- Hosted infra/production/bin/verify.sh passes on the new PACT URL.
- scripts/chatgpt-smoke.mjs on the new origin passes nickname entry, DCR/PKCE OAuth, 26 MCP tools, UI resource, arbitrary private notes with stale-write rejection, one synthetic self-owned farm and replay receipt. The lease is closed and OAuth grant revoked. No models or counterparty writes were used. Synthetic kingdom: a2218489-cacb-4128-9761-469c451208ab.
- Local network resolver initially retained an empty DNS answer from before record creation (old SOA serial, remaining TTL 537 seconds). Authoritative/public resolution and server-side checks succeeded; local browser initially displayed DNS_PROBE_FINISHED_NXDOMAIN. Browser availability must be reported separately from server verification.

## Account effects and remaining checks

Browser sessions/storage are origin-bound: users must sign in again. Nickname guest recovery data in browser storage does not automatically transfer between domains; do not silently create a replacement kingdom when an existing player wants their old one. Agentic World WebAuthn RP ID changes with the domain; existing passkeys are bound to the old RP and may require the application's normal recovery/enrollment flow. No credential was changed or re-enrolled by this migration.

The already-created personal PACT ChatGPT app still records its original server URL and has not finished connecting. Its settings expose name/description edits but no server URL editor. It needs a new connection configuration for the new MCP URL; actual ChatGPT gameplay remains unverified. Do not call the personal installation certified based only on the hosted smoke.

Signed in to the existing deSEC account using browser autofill. Its record inventory already contained only NS records, with no A/AAAA addresses. A direct authoritative query from the VPS confirms no A or AAAA answer; a direct TLS request to the server with the old hostname is rejected. Local queries for the old domain still return Fortinet's synthetic block addresses, even when targeting deSEC nameservers, so they do not prove the provider's DNS state. No domain registration was deleted; the old domain is retained without a server endpoint.
