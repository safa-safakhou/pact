# Allowed script baseline (PACT-052)

This is a deterministic, player-started comparison client, not an autonomous scheduler or a model. It uses the same public MCP tools, authority checks, stock, rates and shared kingdom write lease as an Envoy. It cannot found a kingdom, approve its own exception, grant funds or inspect another player's balances.

## Run one turn

Use Node 24 and the repository's installed dependencies. Authenticate a **synthetic** player through the normal OAuth flow described in [Codex playtest operations](codex-playtest.md). The script does not create a grant or extract Codex's stored credentials. Supply a valid access token through a secret process environment, never a command argument, committed file, chat prompt or report. Access tokens expire after 15 minutes; this client does not refresh them automatically.

Required environment names:

- `PACT_BASELINE_MCP_URL`: `https://safa.dedyn.io/pact/mcp` (HTTPS; plaintext only allowed on localhost).
- `PACT_BASELINE_ACCESS_TOKEN`: synthetic account's normal OAuth access token with `world:read` and `game:act`.
- Optional `PACT_BASELINE_PARTNER_ID`: an already accepted contact's kingdom UUID. Otherwise the script selects the first contact in the server guide.

After those environment variables are supplied by the operator's secret mechanism, run:

```sh
npm run play:baseline
```

The policy discovers its owner and contacts from `pact_agent_guide_v1`, reads authorized projections and the development/diplomacy lessons, then opens a normal lease. If Farm I has a free builder and no Farm instruction, it queues Farm II. It sends one message, offers **12 Grain/hour for 4 Silver/hour for one hour**, no bonds and zero notice, and signs the exact returned offer version. The partner must independently inspect and sign. It never signs on behalf of the partner. This simple policy is not a promise of good strategy or sufficient stock.

The successful first turn uses ten public tool calls including four writes. The default local ceiling is fourteen calls, at most twenty when invoked programmatically. All server limits still apply. The client closes its own MCP session in `finally`; if closure fails or the process dies, the server's bounded lease expiry remains authoritative. Requests have a ten-second transport timeout and reject redirects rather than forwarding credentials.

Possible summary statuses include `human_activation_required`, `world_not_active`, `accepted_contact_required`, `agreement_active`, `awaiting_existing_offer` and `awaiting_partner_signature`. An existing offer/agreement prevents duplicate proposals on re-entry. The baseline does not automatically recover partially signed negotiations or launch another turn. Inspect them through normal player tools.

For an uncertain write it reads **that exact command ID's receipt once**, never resubmits under a fresh ID. `BASELINE_STOPPED` may include `uncertainCommandId`: reconcile it through the owner receipt tool before attempting further writes. Any committed earlier actions remain committed. Outputs contain receipt IDs/counters, not tokens or raw correspondence. A denied action or expired token is not permission to bypass a prerequisite.

## Isolated comparison

```sh
npm run build
npm run test:integration -- tests/integration/script-baseline.test.ts
npm test -- tests/unit/script-baseline.test.ts
```

The integration harness creates and drops separate disposable PostgreSQL schemas for script and fake-provider policy trials. It uses normal founding, eight Home Guard, normal production/upkeep, human-authorized contact acceptance, player mandates, shared commands and real rules settlement. It advances the test world clock for speed; the player receives no worker/database port. No production schema or live kingdom is changed.

The partner sends one acceptance message and signs the publicly inspected exact terms. The model route uses four deterministic fake provider steps, not an LLM. Its server-recorded receipts supply the offer reference; it never queries test tables for an action target. Initial/final category balances for **both** kingdoms, call counts and completed installments are printed as synthetic JSON. Owner-only reads used by assertions are test observers, not input to either player's policy.

The [progress report](../implementation/reports/script-baseline-progress.md) records the earlier fake-provider fixture. The [completion report](../implementation/reports/script-baseline-completion.md) records a matched **actual local-model** comparison: the script won, completing the exchange while the model repeated Farm II until its run limit. Neither a successful script nor a failed model measures whether negotiation is fun.

### Optional, no-API-cost local-model rerun

Run the model on the development machine, not the production VPS. The recorded trial used the official `Qwen/Qwen3-4B-GGUF:Q4_K_M` model with `llama-server` 9960, bound to loopback. Its full generated tool schema is beyond this backend's grammar compiler, so the test-only transport sends compact wire schemas; PACT's command dispatcher still validates and authorizes every returned action. This does **not** enable a production model provider or use real account data.

```sh
llama-server -hf Qwen/Qwen3-4B-GGUF:Q4_K_M --jinja --host 127.0.0.1 --port 18181 -c 16384
PACT_BASELINE_LOCAL_MODEL_URL=http://127.0.0.1:18181 PACT_BASELINE_LOCAL_MODEL_ID=Qwen/Qwen3-4B-GGUF:Q4_K_M npm run test:integration -- tests/integration/script-baseline.test.ts
```

Use Node 24 and a disposable PostgreSQL 17 test database as above. The optional trial is skipped when the loopback URL is absent; never point it at a remote URL or live database. The test's result JSON gives initial/final ordinary and allowance category balances for both players, completed installments, script/tool/model calls, token use, receipt codes and wall time. API charge is zero for this local setup; hardware/electricity costs are unmeasured. If it fails or another model wins, publish that result without adjusting stock, partner behavior or quotas to make either side look better.
