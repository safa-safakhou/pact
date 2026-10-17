# F8 PACT dependency qualification follow-up — 17 October 2026

Founder assignment: fix the dependency findings blocking F8 and rerun qualification locally, with server Fleet untouched and no new runs. This is source/offline work in the existing `feature/phase2-agent-events-20261017` worktree, based on177ad6c. No deployment, push, provider call or live account/game operation is included. Execution tracking is the [local follow-up register](../dependency-qualification-status-20261017.json); original backlog/deferred assignments remain unchanged and no remote tracker mutation was performed.

## Fixes and provenance

The reproduced audit contained23 entries (16 high,7 moderate), propagated from three advisories in the existing Expo tree. [Backport sources and maintenance](../../../vendor/security/README.md) describe the exact patches and upstream references.

- Xcode's UUID dependency upgrades7.0.3→11.1.1, the published CommonJS-compatible fix. Xcode'sv4 generation and v3/v5 short-buffer rejection are verified.
- braces3.0.3 and node-forge1.4.0 have no published fixed version at the reviewed date. Private distributions `3.0.4-pact.1` and `1.4.1-pact.1` preserve their original package names, full Node runtime source and licenses. They explicitly identify themselves as local backports, not upstream releases. The brace fix bounds parser nesting and iteratively checks child depth/cycles before recursive walkers. The Forge fix backports the nested AlgorithmIdentifier count condition from upstream PR1152. No cryptographic arithmetic or unrelated behavior changes.
- Original tarball SRI and all62 retained upstream-file SHA256 hashes were verified against the registry downloads. `vendor/security/provenance.json` records original/local hashes and exact changed files; adjacent patch files expose the code/metadata changes. Unused browser-minified/Flash distributions and lifecycle/development scripts are excluded from the private Node-only distribution.
- The root pins the same Expo57.0.24 already used by native. This addresses a confirmed npm workspace/file-link override bug, reproduced on installed11.7.0 and project-pinned11.19.0. Actual transitive paths initially retained old copies despite successful installation. The same-version root tooling anchor makes root overrides apply; `check:dependencies`, included in lint, validates every actual consumer identity, hashes/inventory, root/native pin and UUID resolution after clean installation. No Expo/React/React Native version migration occurred. Only four prior lock entries change (root and the three affected packages), plus two local targets.
- Docker build and runtime stages now copy `vendor`. The original recipe could build and report a clean audit while missing local source targets; a network-disabled, read-only container running the provenance/resolution guard reproduced `ENOENT`. The final Docker build now requires that guard after production pruning; the corrected final runtime image passes it and its production audit. No application container was started; only explicit test commands executed in disposable containers.

**Audit interpretation:** local and pruned runtime-image npm audit report0 known registry findings. That is not independent certification of privately maintained code. The reviewed minimal patches, origin hashes, direct vulnerability regressions and clean-install/transitive-resolution checks establish the backport evidence. Future advisories must also be reviewed against original upstream versions because local distributions may lack automatic registry coverage. No waiver/suppression or forced Expo downgrade was used.

## Tests and failures investigated

Sixteen new unit checks exercise installed consumers: balanced brace/parenthesis depth below the original10000-character limit; deep/cyclic child ASTs; ordinary ranges/globs/quoted literals; malformed nested RSA DigestInfo with and without NULL parameters; valid and incorrect SHA256 signatures; CommonJS Xcode UUIDs/buffer bounds; actual Expo certificate, CSR and update-buffer verification. Before patching, ten security checks failed while ordinary compatibility cases passed. The first draft exceeded the original input-length guard; it was corrected to8003 characters and rerun red before implementation. Generated synthetic keys stay in test memory.

The first full integration run exposed five failures in `tests/integration/a2a.test.ts`: authorization/receipt assertions received TICK_PENDING when its shared synthetic world crossed a real wall-clock boundary without a rules worker. A forced-expired-tick regression also demonstrated WORLD_PAUSED. The fixture now postpones only its owned test world's next due tick; its12 tests pass, including the regression. No product clock/rule, production timeout or real schedule changes. The first draft of this regression omitted a required note; after correcting its command input it was rerun red, then green with the fixture correction. The original failed full-suite log remains in protected evidence.

| Local check | Result |
| --- | --- |
| Pinned npm11.19.0 clean `ci --ignore-scripts` | Passed; install uses no dependency lifecycle hooks |
| `npm run check:dependencies` / `npm audit` / `npm ls` selected dependencies | Passed /0 findings /all consumers patched |
| `npm run build` | Passed across packages, API/workers, web/native/Telegram; existing bundle-size warnings remain |
| `npm run typecheck` / `npm run lint` | Passed, including boundaries/build order/contracts/dependency guard; existing style diagnostics remain |
| `npm test` | 405 passed /125 files |
| `npm run test:integration -- --maxWorkers=2` | 466 passed /66 files,1 existing optional real-provider skip; full rerun157.45 seconds |
| `npm run eval:offline`, backlog render/check, diff check | Passed;181 tickets/37 release criteria, source snapshots unchanged |
| Offline Expo CLI/config and Android export | Passed;733 modules bundled to a2.3MB Hermes artifact; no app/device/model started |
| `docker build --target runtime` and read-only network-disabled consumer guard | Passed; local image only, no deployment |
| Runtime-image `npm audit --omit=dev` | 0 findings |
| Fleet counterpart qualification | 185 existing unit +326 integration and12 actual-handler/profile acceptance passed; saved proposal refresh is recorded in the sibling Fleet follow-up report |

Protected logs, red/green reproductions, upstream integrity proof, full suites, native export, local image checks and author review are under `/home/mnim/.local/share/fleet-phase0-validation-20261017/dependency-fix-ledger`. No hosted CI or physical-device certification is claimed. Author review only, under no-delegation instructions, is weaker than independent review.

## Preservation and release eligibility

No installed PACT/Fleet release, account, history, mandate, model/allowance, anchor, terminal cohort, unknown allocation or recovery gate changed. Server Fleet was not contacted. Read-only repeatable-read proof matches all22 installed application-table fingerprints with the prior F8 handoff; installed7093cb8,20 needs_owner agents,10121 retained turns and40 historical40000-token unknown allocations are unchanged. The existing local worker/console/helpers were not restarted.

The Fleet proposal will pin this verified PACT revision and clear only its dependency-audit blocker. It retains no selected run, no deployment/push/run authorization, unresolved owner recovery/target quiescence and target-specific encrypted restore rehearsal. Passing source/offline qualification cannot start a run or authorize installation/provider certification. Future maintenance should replace each local backport with a verified upstream fix while retaining the regression/provenance checks.
