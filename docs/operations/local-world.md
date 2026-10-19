# Prepared local one-hour PACT world

19 October 2026. The founder authorized preparing a fresh local world and four fleet architectures, with launch explicitly deferred until requested. One elapsed hour is the experiment budget. There is no total model/helper-call or token quota and no equal-compute limiter. Ordinary game authority, model context/transport bounds and the existing engine turn structure remain.

## This prepared instance

- Private state: `~/Library/Application Support/PACT Local Worlds/local-four-20261019-ef5d29eb/` (0700, configuration/keys 0600). Never commit its contents.
- PACT source: `/Users/safa.safakhou/repos/mine/.codex-local-world/pact`, branch `codex/local-world-preparation`.
- Fleet source: `/Users/safa.safakhou/repos/mine/.codex-local-world/fleet`, same branch name in its separate repository.
- Browser game: `http://127.0.0.1:3400`; Fleet console: `http://127.0.0.1:8830`.
- Independent PostgreSQL17 containers/volumes on loopback5451/5452; native game processes and native Fleet console. Existing ports5432/5439/8820 and other installations are untouched.
- Twelve new ordinary kingdoms, three per `legacy-loop/1`, `legacy-cognition/1`, `reactive-basic/1`, `reactive-cognition/1`; matched guardian/merchant/diplomat owner goals.
- All use the installed Nemotron4B/Q4_K_M digest recorded in private configuration, thinking=true, native Ollama0.40.3. Legacy cognition uses the existing certified local Laya0.4.6 helper on8832; modern cognition uses its own continuity path.
- Same 15-minute periodic review; reactive profiles additionally consume existing eligible events. Initial review phases match actor periodic phases. No added free-disk reserve threshold. One shared inference slot for this deployment, with actual queue/usage reported rather than equalized.

Preparation creates identities, mandates, OAuth grants, owner objectives and bindings through normal game APIs. It does not invoke models, run a Fleet worker or begin the observation hour. The new game's clock is paused after enrollment, all groups are draft and the window has null start/end. No actor/counter is reset during later launch.

Fresh synthetic mandates delegate ordinary supported gameplay, including supply/garrison exit permissions; resource envelopes use the maximum supported wire value, no experiment reserve floor, and a nonbinding-in-practice supported troop envelope. These do not create resources or change economy/stock/quota/human-only rules. No synthetic-owner exception policy is selected. Models do not receive human sessions or entry keys.

## Local controls

Use Node24.21. Each command takes the explicit private state directory; it never defaults to a hosted world or the repository .env. The operator console secret is in the protected config.json, not in this document/chat.

```sh
/opt/homebrew/opt/node@24/bin/node scripts/local-world/control.mjs status '<private-state-directory>'
/opt/homebrew/opt/node@24/bin/node scripts/local-world/verify-prepared.mjs '<private-state-directory>'
```

From the isolated PACT source directory, **only after the founder says launch**:

```sh
/opt/homebrew/opt/node@24/bin/node scripts/local-world/control.mjs launch '<private-state-directory>'
```

Launch verifies exact source/artifact pins and all twelve accounts, resumes only this world, atomically starts four groups, records a common T0/T1=T0+3600000ms, seeds initial reactive review and starts the observer and new Fleet worker. There is no 32-call preflight. No window is armed by preparation or ordinary console start. A registered run cannot be silently restarted with a new deadline.

Fleet's optional `FLEET_RUN_WINDOW_FILE` wraps the shared model path used by both legacy and modern engines, game lease/open/submission and Laya selection. Missing/malformed/prepared/closed/expired files deny new work. No request counter is consulted. Actual dispatch is rechecked; an already-dispatched response is accounted without forced cancellation. Existing deployments without this variable retain their original behavior.

The observer writes private aggregate snapshots every30s: per-group development/resources, messages/relationships/contracts/delivered supplies, compute and continuity-update/helper counts. Full consented encrypted turn evidence stays in Fleet. Counters do not claim memory quality or material fulfilment without the corresponding source/outcome. Shared-world groups and queue exposure are not independent replicas.

At T1 new model/helper/command admissions close. Original requests/receipts drain within their existing bounds; cutoff and post-drain observations are saved separately, with original receipt/commit timestamps needed to classify effects near the boundary. The observer pauses only this game's clock, pauses groups once no turn is active, and makes encrypted final snapshots. Any uncertainty remains explicit; it is not reviewed automatically. A later continuation needs a new explicit window while preserving the same identities/history.

## Recovery and archives

`boot` starts only owned API/rules/seals/notification/gateway/console processes; it starts no Fleet worker. `park` pauses only the not-yet-launched world. PID files and logs are private; do not stop an unrelated service using a port or restore an old dump over newer gameplay.

Encrypted pg_dump archives use independent AES256-GCM keys in a separate keys directory. `restore-check.mjs` authenticates/decrypts in memory, restores into a temporary network-disabled PostgreSQL clone and compares complete rows. Prepared acceptance matched10 core game tables and39 Fleet tables. This is local recoverability evidence, not off-host disaster recovery.

Source verification and actual prepared-state evidence are in the dated completion report. Preparation is not live-agent performance acceptance. The original Mac Fleet/helper and all server/historical worlds retain their own state; shared local GPU demand must be included in observed queue/latency results.
