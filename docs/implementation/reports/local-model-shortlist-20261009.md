# Local game-model shortlist — 9 October 2026

Founder-requested research following the [continuous-run quality audit](full-game-health-20261009.md). Recommendations below are judgments from official model/runtime descriptions and current hardware, **not measured PACT performance**. No model was downloaded, loaded, switched or tested by this research; the authorized fifty-player run remains unchanged.

## Practical candidates

Host: RTX 5070 Ti, 16 GB VRAM; Windows Ollama 0.35.1. Current controller uses 32,768 context, schema-constrained JSON and one serial worker. Local inventory additionally contains `qwen3:14b` (9.3 GB download), which is a useful already-installed comparison, though not a newly released model. Sizes below are published package/download sizes, not runtime VRAM: KV cache, context, backend, quantization and other resident models require additional memory. Full GPU residence at our actual context must be measured.

| Candidate | Published package | Reason to evaluate |
| --- | --- | --- |
| [Gemma 4 12B](https://ollama.com/library/gemma4:12b) | 7.7–8.0 GB across listed backends | First independent-family quality candidate. Google released it June 3, 2026 and explicitly targets 16 GB local hardware, advanced reasoning and agentic tasks. [Google announcement](https://blog.google/innovation-and-ai/technology/developers-tools/introducing-gemma-4-12b/). |
| [Qwen 3.5 9B](https://ollama.com/library/qwen3.5:9b) | 6.6–7.6 GB across listed backends | First direct upgrade/control against the current 4B. Existing family integration lowers migration uncertainty; tool/thinking support is listed. Improvement in PACT must still be demonstrated. |
| [Granite 4.2 8B](https://ollama.com/library/granite4.2) | 5.3 GB | Recent addition listed approximately one month ago. Explicit structured JSON, tool use and configurable thinking suit our interface. Attractive independent-family candidate for decision discipline. |
| [Ornith 1.5 9B](https://ollama.com/library/ornith-1.5) | 6.6 GB | Recent addition listed approximately one month ago; training emphasizes task/scaffold/rollout self-improvement. Experimental candidate for adapting to feedback. Its listing does not establish our exact structured-output or tool-route compatibility; verify those first. |
| [LFM2.5 8B-A1B](https://ollama.com/library/lfm2.5) | 5.2 GB | Throughput candidate: designed for consumer hardware and chaining tool calls. Only about 1B active parameters affects compute, while all model weights still require storage/memory. No measured game-speed or quality claim. |
| [Ministral 3 14B / 8B](https://ollama.com/library/ministral-3) | 9.1 / 6.0 GB | Older alternative with explicit function calling and JSON output. Start with 8B if 14B plus our context cannot remain fully GPU resident. |

The priority order is **Gemma 4 12B and Qwen 3.5 9B**, followed by Granite 4.2 8B. Ornith is an experimental comparison; LFM is useful if throughput becomes the constraint. This is a test priority, not a claim that one candidate already wins.

## Newest does not necessarily fit

[Qwen 3.8 27B](https://ollama.com/library/qwen3.8) is newer and advertises improved environment-feedback handling, but its default listed package is 18 GB, already above this GPU's 16 GB before runtime overhead. [Qwen 3.6](https://ollama.com/library/qwen3.6) defaults likewise list 18–24 GB. Those default packages would require offload or other deployment/quantization choices; they are poor first choices for preserving fifty-player throughput.

Very recent [Clef Flash](https://ollama.com/library/clef-flash) is a specialized 9B decision model using `/v1/systemone` to score typed questions/options, rather than our free-form planning/chat route. It could be investigated as a classifier alongside a player model, but is not a replacement for generating negotiation text and action plans through the current adapter. Its published listing contains inconsistent maximum-context descriptions, so do not assume the catalog's larger context applies to decision-state requests.

## Configuration and evaluation before a switch

Source inspection found `scripts/local-population/ollama.mjs` sends **`think: false`**, `temperature: 0`, schema-constrained `format`, 32K context and a finite output allowance. Thus the current observation tests non-thinking Qwen. Reasoning-enabled comparison needs separate timeout/token accounting and reliable final-JSON extraction; do not assume enabling thinking alone fixes stale actions. Model-specific recommended settings should be evaluated instead of applying the current defaults blindly.

Use the same bounded local decision cases for candidates: cancel/free a blocked builder slot and construct the prerequisite; abandon an expired offer; size bonds within six-hour flow-value limits; complete both sides of a supply agreement; respond to actual messages; and join/act in a Court using real IDs. Score rule-valid actions, useful recoveries, truthful communication, bilateral activation, response latency and GPU residence. Keep snapshots identical and distinguish inference-only replay from commands committed in the real game.

A fifty-player five-minute revisit requires approximately **six seconds average total turn service time** with one serial worker and no spare capacity. This arithmetic includes HTTP/read/write work, not merely token generation. A larger or thinking-enabled model may extend the revisit interval; measure full turns before changing the live population. Compact current facts and improved error feedback remain necessary regardless of model choice.

Read-only verification: official Ollama catalog/model pages, Google release announcement, local `ollama list`, current transport source and clean Git state. No application code changed or application tests required. This research does not authorize additional live experiments or resume deferred production work.
