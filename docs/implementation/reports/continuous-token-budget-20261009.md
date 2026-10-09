# Fifty-player token and Luna cost estimate — 9 October 2026

The founder requested daily token consumption and an estimate for replacing local inference with Luna. This is a read-only measurement and pricing projection. No provider, model, cadence, authorization or budget changed; no paid inference was invoked.

## Measurement

At **18:44:01.931 UTC**, the Qwen3.5 9B journal contained **412 measured successful model calls** since the 17:31:40.460 switch, spanning 72.358 minutes. Every successful call had input/output usage, and no failed turn appeared in that sample. Inputs totaled **11,082,789 tokens**; outputs totaled **138,673**. Mean per call was **26,899.973 input and 336.585 output tokens**. Input/output p95 was 30,639/547. These are Ollama/Qwen token counts, not a measured OpenAI bill or proof that another tokenizer counts the same text identically.

Extrapolating this interval to an uninterrupted twenty-four hours gives **8,199 calls, 220.560 million input and 2.760 million output tokens per day**. The most recent fifteen minutes separately projects **8,448 calls, 228.406 million input and 2.639 million output tokens**. These are short-window estimates, not a completed day. They assume similar context sizes, activity and uptime; adaptive context, retries, latency and future gameplay can change consumption.

The current full-game controller makes one model plan per turn, supplying fresh guides/world/social context and tool schemas. Up to three selected actions/read requests are then dispatched without separate model calls. A Codex agent that instead iterates through individual tools or retains longer conversations can have materially higher token usage. Most measured volume is repeated input context; current Qwen generation uses non-thinking mode.

## Official pricing checked 9 October 2026

For **GPT-6 Luna Standard API**, the fetched official model page quotes **$0.10 per million uncached input tokens and $0.50 per million output tokens**; cached reads are $0.01/million. Cache writes have a separate published rate. [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [API pricing](https://developers.openai.com/api/docs/pricing).

The baseline below uses all input as uncached, one equivalent model call per turn and the observed average visible output, with no additional reasoning, cache-write, built-in-tool, regional or tax charges. It is a comparable-workload estimate, not a guaranteed Luna request shape or invoice.

| All fifty owners' cadence | Calls/day | Input/day | Output/day | Luna API/day | Thirty days |
| --- | ---: | ---: | ---: | ---: | ---: |
| Current observed throughput | 8,199–8,448 | 220.6–228.4M | 2.64–2.76M | $23.44–24.16 | $703–725 |
| Every five minutes | 14,400 | 387.36M | 4.85M | $41.16 | $1,235 |
| Every ten minutes | 7,200 | 193.68M | 2.42M | $20.58 | $617 |
| Every fifteen minutes | 4,800 | 129.12M | 1.62M | $13.72 | $412 |
| Every thirty minutes | 2,400 | 64.56M | 0.81M | $6.86 | $206 |
| Every hour | 1,200 | 32.28M | 0.40M | $3.43 | $103 |

Formula: daily cost = input/1,000,000 × $0.10 + output/1,000,000 × $0.50. Fixed cadence rows are theoretical planning frequencies; a serial worker does not guarantee those intervals. Faster hosted calls could increase throughput toward the five-minute configuration and increase the daily bill accordingly.

At current throughput, the estimate is about **$0.47–0.48 per owner/day**. The same uncached token volume on **GPT-6 Sol**, whose official rates are $2/million input and $10/million output, would be about **$469–483/day**, before behavioral/token-count differences. [GPT-6 Sol rates](https://developers.openai.com/api/docs/models/gpt-6-sol).

## Important billing differences

OpenAI reasoning tokens are billed as output even when not shown. An illustrative extra **1,000 reasoning tokens per turn** adds about **$4.10/day** at the observed 8,199 turns; 5,000 adds $20.50/day. Actual reasoning usage is unknown until a separately authorized Luna probe records usage. The current local output ceiling is not proof of an API reasoning ceiling. [Reasoning and costs](https://developers.openai.com/api/docs/guides/reasoning).

Codex with an API key follows API pricing. ChatGPT-authenticated Codex instead has included plan limits and credit rules; these dollars cannot determine how long a Plus/Pro subscription will last. The fetched Standard credit card lists GPT-6 Luna at 2.5 input and 12.5 output credits per million: this workload would be roughly **586–604 credits/day** before caching/reasoning. Credit purchase prices and included usage depend on the plan; this is not a dollar conversion. [Codex and plan pricing](https://learn.chatgpt.com/docs/pricing).

Prompt trimming and deliberately arranging reusable static prefixes could reduce input cost, but no OpenAI cache hit rate has been measured. The estimate assumes no cache discount; cached reads and writes must be accounted for using actual API usage. The natural first cost-control choices would be a slower cadence, smaller relevant state per decision, and bounded hosted reasoning/tool iteration. No such implementation or paid test was performed for this estimation request.

[Sanitized usage and calculations](evidence/continuous-token-budget-20261009.json). Provider credentials, private messages and checkpoint contents were not published. Standing founder preference covers committing this report; the continuing fifty-player run remains unchanged.
