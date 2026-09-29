# PACT-052 — allowed script versus local real model

Ticket: [PACT-052 / MNI-116](https://linear.app/mnim/issue/MNI-116/pact-052-build-and-run-the-allowed-script-baseline)  
Implementation revision: `0b144c5` (local-model comparison harness); the public-tool script was introduced in `57701ac`  
Verification: 29 September 2026, macOS arm64, Node 24.19.0, disposable PostgreSQL 17 schemas, llama.cpp server 9960; no live kingdom, VPS model route, purchased API call, or production credential.

## Result

The bounded script used public MCP tools and completed Farm II plus a mutually signed, naturally expired one-hour supply exchange. Under the same initial game state and partner policy, an actual locally executed Qwen3 4B model built Farm II but used all eight model calls repeating that build command. It never sent the message or made an offer, so the partner had nothing to sign. **The script won this matched trial.** Execution success is not evidence that negotiation is fun; no human enjoyment rating was collected.

## Acceptance evidence

| Criterion | Check/artifact | Actual result |
| --- | --- | --- |
| No hidden state, administrative API, free resources, or privileged rates | `scripts/lib/baseline-player.ts`; `npm run test:integration -- tests/integration/script-baseline.test.ts`; earlier `57701ac` evidence | The script used ten public MCP calls, normal stock/mandate/lease/receipts, and no partner private balances. Two disposable schemas used normal founding, production, upkeep and settlement. |
| Publish actual comparison even when script wins; separate success from fun | Optional loopback-model integration test in `tests/integration/script-baseline.test.ts`, run with `PACT_BASELINE_LOCAL_MODEL_URL=http://127.0.0.1:18181` and the documented model ID | Script: Farm II, one expired contract, 120 installments, ten public calls. Real model: Farm II, zero offers/contracts/installments, eight provider calls, 13,795 reported tokens, one `COMMITTED` build and seven `BUILDING_BUSY` receipts. No fun conclusion. |

Both runs started after 60 normal game minutes with two activated kingdoms and an accepted contact. Each player had ordinary Grain 13,200 and Iron 12,000; the acting player had Silver 4,800 and the partner Silver 6,000. Founding allowances and other category balances were identical. The script discovered the first accepted contact from its guide; the local model's objective named that same contact UUID, an advantage to the model. Both were asked to queue Farm II and exchange 12 Grain/hour for 4 Silver/hour for one hour, no bonds and zero notice. The partner policy sent one acceptance message and signed the publicly inspected exact offer if one existed. The fixture advanced 61 more game minutes after the turn, with a normal rules heartbeat during slower local inference. No stock was injected or outcome forced.

| Ordinary units after settlement | Script player | Script partner | Local-model player | Local-model partner |
| --- | ---: | ---: | ---: | ---: |
| Grain | 27,070 | 33,820 | 34,270 | 26,620 |
| Iron | 24,200 | 24,200 | 24,200 | 24,200 |
| Silver | 13,300 | 9,700 | 10,900 | 12,100 |

The local run had an eight-call ceiling within the ordinary 15-minute/40,000-token run bounds; it consumed eight calls and 13,795 reported tokens, ending normally with no provider error. The script's local call ceiling was 14; it used ten public MCP calls. Public-tool calls and model calls are different units. Measured fixture wall time was about 5.5 seconds for the script and 12.8 seconds for the cached local model; this is not a latency benchmark. External API charge was **USD 0** because inference ran on the operator's own Mac. Electricity/hardware cost and any hosted-provider price were not measured.

Model: [Qwen/Qwen3-4B-GGUF](https://huggingface.co/Qwen/Qwen3-4B-GGUF), `Q4_K_M`, Hugging Face revision `bc640142c66e1fdd12af0bd68f40445458f3869b`, GGUF blob SHA-256 `7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5`. Server was loopback-bound with 16,384-token context, Jinja tool parsing, temperature 0, and at most 600 output tokens/call. Its full generated PACT JSON Schema exceeded llama.cpp's grammar compiler, so the **test-only transport** exposed the same tool names with a compact wire schema and filled command-envelope metadata from the fixture's authenticated account; the unchanged PACT application validated every resulting action, authority, stock, lease and receipt. The transport gave the model the relevant action shapes and instructed one call at a time. This compatibility shim, small model, prompt and single scenario limit generalization; the result does not certify a supported hosted provider or establish that LLM play is generally worse.

## Checks

- `npm run build` — pass.
- `npm run typecheck` — pass.
- `npm run lint` — pass after formatting the test; boundary/build-order/contract guards passed.
- `npm test` — 175/175 unit tests in 53 files passed.
- `npm run test:integration` — 226 passed, one optional local-model trial skipped, in 39 files.
- With the loopback model variables above, `npm run test:integration -- tests/integration/script-baseline.test.ts` — both the fake-provider fixture and actual local-model trial passed their **measurement assertions**, and printed the comparison above. A passing measurement test does not mean the model achieved the objective.

## Documentation and limitations

[Run instructions](../../operations/script-baseline.md) now describe the optional local-model test and its isolated, no-API-cost boundary. The earlier [progress report](script-baseline-progress.md) remains a historical record of the fake-provider phase. No production deployment or live player inference was changed. One trial cannot measure enjoyment, fairness across model tiers, or paid provider economics. Those belong to later playtesting and provider certification, not this R07 baseline.

## Handoff

Review PACT-053's R01–R08 release gate against committed evidence, including this unfavorable R07 comparison, rather than interpreting it as model superiority. Keep paid/native/social-pilot claims separate.
