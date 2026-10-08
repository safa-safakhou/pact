# Direct PACT subdomain — 8 October 2026

Founder requested direct routing to the new server, suggesting `pact.tinyagenttools.com` instead of forwarding `/pact` through the old host. This covers domain and deployment work, not deferred gameplay tasks or another population run.

## Result

PACT is live at **https://pact.tinyagenttools.com/**, directly on `2.31.62.91`. Cloudflare's DNS-only A record points to that address; Caddy on the new host issued a valid Let's Encrypt certificate and redirects HTTP to HTTPS. The apex and `www` remain on the old host for Tiny Agent Tools. DNS operates on hostnames, so it cannot move only the `/pact` path.

Canonical origin, public base and OAuth issuer now use the subdomain. MCP is **https://pact.tinyagenttools.com/mcp**. Release `subdomain-20261008-1` contains root-path web and Telegram assets plus existing-only guest recovery. Runtime image is `sha256:0352fdc55d4f2fe83e0a19da072d389a68127b6c121c1d9454755996bbc14771`; gateway image is `sha256:d15b133045a08a8715bdaf7893382f2c27ee90a9ad19da2bba10647912d62df8`. Previous `chatgpt-approval-20261007-3` images remain available; obsolete earlier journal image tags and dangling intermediate images were removed without removing volumes or backups.

The old browser entry offers **Continue with my kingdom**. Its source page and a hidden new-origin destination page use exact-origin/window checks; the remembered entry key goes directly to the new origin and never enters a URL. The API's `existingOnly` mode looks up an active guest account and refuses to found a new account/kingdom. The destination compares the returned identity with the existing browser account before storing the key and redirecting. Normal nickname joining retains its existing behavior. No guest cookie domain, origin allowance, mandate or human approval rule was relaxed.

The actual playing browser completed this handoff and loaded the existing kingdom at the new hostname, with the existing buildings and construction. No game command, approval, new user kingdom, model call or allowance change was submitted during verification.

The previously configured Telegram webhook still used the retired `safa.dedyn.io` hostname. It now uses `https://pact.tinyagenttools.com/telegram/webhook`; the existing Mini App menu URL also moved to the direct hostname. The existing allowed update types and maximum connections were preserved, pending updates were not dropped, and final webhook readback confirmed the new URL with zero pending updates. No Telegram message or BotFather conversation was sent. The named Mini App entry configured separately through BotFather still needs its URL updated before retiring all historical links; the old Tiny Agent Tools Mini App entry redirects to the new hostname. Telegram configuration uses the existing host secret files, never copied to this report.

Temporary legacy API/MCP routes still forward over WireGuard for existing clients. They depend on the old host; the new browser/API/MCP domain does not. Existing ChatGPT installations retain their configured old MCP address and should be reconnected at the new endpoint after the same-browser guest handoff. This deployment does not establish a fresh consumer ChatGPT installation or end-to-end Telegram gameplay certification.

## Verification

- Node 24 builds passed for `@pact/identity`, `@pact/api`, `@pact/web` with `PACT_WEB_BASE_PATH=/`, and `@pact/telegram-app` with `PACT_TELEGRAM_BASE_PATH=/telegram/`. Browser builds retained the existing bundle-size warning.
- `npx vitest run --config vitest.integration.config.ts tests/integration/guest-play.test.ts`: six tests passed, including existing-account recovery with unchanged account/kingdom counts and rejection of unknown recovery keys with no cookie or account/kingdom creation.
- `npx biome check packages/identity/src/service.ts services/api/src/guest-routes.ts tests/integration/guest-play.test.ts`, shell syntax checks for changed deployment/verification scripts, and `git diff --check` passed.
- New and old Caddy configurations validated; their only warning was formatting. New-host `verify.sh /srv/pact/config/production.env https://pact.tinyagenttools.com` passed, covering readiness, public legal/API routes, root Telegram assets/framing, private PostgreSQL/Mailpit listeners and secret-mount isolation.
- Public HTTPS returned 200 with actual remote address **2.31.62.91** and certificate verification result **0**, without ignoring certificate checks. HTTP returned 308 to the matching HTTPS origin.
- OAuth authorization metadata advertises only the new issuer/authorization/token/registration/revocation URLs. Root protected-resource metadata advertises the new `/mcp` resource. Anonymous MCP returns expected 401 with the new root metadata challenge; the resource-specific `/mcp` metadata suffix is not served and is not advertised.
- Privacy replay completed with one closed entry and zero purged. World clock remained active and advanced from tick **16051** to **16054**, preserving the normal economy and schedule.
- Browser readback at the new domain showed the same kingdom and active clock; source and destination handoff worked without a new account. Public DNS evidence: `artifacts/subdomain-20261008/cloudflare-direct-dns.png`. The private owner screenshot `kingdom-new-domain.png` is retained locally and excluded from Git.
- Tiny Agent Tools root returned successfully. Old PACT containers remained stopped and its backup timer disabled. New backup timer remained active; the encrypted migration snapshot/restore evidence is in the preceding server report. New disk had approximately **65 GB free** after the cutover.

## Operations and handoff

See [dedicated-host runbook](../../operations/dedicated-pact-host.md) and [ChatGPT connection instructions](../../operations/chatgpt-play.md). Dedicated Compose override now includes the local HTTPS edge; deployment scripts start it when `PACT_PUBLIC_EDGE=1`. Source and protected configuration use root asset paths for future deployments. Configuration before cutover is saved root-only, and old-edge configuration backups remain available. Application rollback preserves live data; host rollback requires a fresh state copy after any new writes. Historical old-host production data must never be started as a parallel testing world.

No tracker task was claimed for this founder-authorized hosting assignment. All 24 Later roadmap tasks remain deferred.
