# Fleet local Nemotron output fix —18 October2026

Founder authorized local investigation/fix with offline tests first, retaining qualification usage and server/game/population boundaries. Founder then explicitly selected both thinking modes qualified separately, with existing Fleet settings unchanged. No PACT implementation ticket or deferred work is activated; source changes are in companion Fleet only. Codex owns this work without delegation; local commits, no push/deployment.

## Cause and correction

The identical failed calibration input reproduced thinking-only completions: done=true/stop, nonempty thinking and no final answer, without reaching the2000-token limit. The original historical response discarded channel metadata, so its identical mechanism is a strong inference; its two original call records remain unchanged. Adding the schema to the prompt alone did not solve it (both original/grounded prompts3/4 valid with thinking=true).

Fleet source401a39d added safe provider metadata (channel sizes/completion reason, no reasoning text), specific thinking-only errors and append-only capped diagnostics under the original parent. Source5beccbd supports explicit thinking=true/false in immutable qualification configuration, separate per-mode caps/evidence and rejection before dispatch when Nemotron's inline toggles conflict with an explicit mode. It never turns thinking off automatically or executes reasoning as a decision. The original engines/model limits remain; installed Fleet settings are unchanged.

Final non-thinking control:8/8 schema-valid final outputs,0 thinking characters/unknown calls. Thinking-enabled control:6/8 valid,2 thinking-only failures. These are small provider controls, not completed Q1/Q2, four-engine certification, strategic-quality comparison or production release. Thinking-enabled structured output remains unreliable in this evidence; no passing label is fabricated.

## Accounting and preservation

Original Q1:2 executions/80000 reservation/402 reported tokens, remains blocked with its original plan and call rows/ciphertexts byte-for-byte. Two distinct closed diagnostic approvals add8 calls/mode from the same104/4160000 parent. Aggregate18 executions/720000 reserved,3288 tokens reported (1576 input/1712 output),0 unknown; unused86 executions/3440000 reservation, no automatic restart. Q2 trials0/helper calls0. No new game accounts or population.

Offline:192 Fleet unit/340 integration tests passed;12 paired PACT handler/profile checks during this investigation, type/style/build/boundary checks passed, audit0. New mode/toggle/ledger guards have red/green tests; original engine/baseline unchanged. PACT application source/runtime unchanged, so full PACT suites were not repeated; canonical backlog/diff checks validate this documentation-only handoff. No hosted CI or independent review claim.

All38 retained installed-table fingerprints match: same953034e release,20 blocked agents,10121 turns,40 historical unknown allocations/1600000 tokens. Primary/persistent service live0 retained; health200/liveEnabled=false, readiness503/LIVE_DISABLED. Existing identities/history/permissions/model/budget/anchors/recovery gates remain; installed worker/console/helper were not restarted. Server Fleet/game host were never contacted, no reset or population. Owned Windows provider was stopped after unloading; owned5436/5438 fixtures stopped with volumes/evidence retained. No registry/autostart/power/model download change.

Original encrypted backup/key retained. A new authenticated14,032,801-byte post-diagnosis encrypted archive preserves both controls/mappings (268 readable TOC entries), with key outside artifacts; this is archive readability/authentication, not another full restore rehearsal. Raw provider thinking is not retained or exposed. Companion Fleet `docs/nemotron-empty-output-fix-20261018.md` and status own exact source/approval/budget evidence; private root `/home/mnim/.local/share/fleet-phase0-validation-20261017/nemotron-empty-fix-20261018/`.

No provider/deployment/release gate is cleared. Further full qualification needs a concrete mode/source plan and remaining aggregate allowance; no old failure/unknown is erased or rerun automatically.


Subsequent founder-requested retry/resilience repair: [Fleet model recovery](fleet-model-recovery-20261018.md). Original control evidence and usage above remain unchanged.
