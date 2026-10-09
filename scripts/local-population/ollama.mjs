import { performance } from "node:perf_hooks";
import { localEndpoint } from "./config.mjs";

export class LocalModel {
  constructor(config, fetchImpl = fetch) {
    this.config = config;
    this.endpoint = localEndpoint(config.endpoint);
    this.fetch = fetchImpl;
  }
  async preflight() {
    const r = await this.fetch(`${this.endpoint}/api/tags`, {
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (!r.ok) throw Error("LOCAL_MODEL_UNAVAILABLE");
    const model = (await r.json()).models.find((m) => m.name === this.config.model);
    // Reject cloud/offloaded entries even on a loopback Ollama server.
    if (!model || model.remote_host || model.remote_model || !model.size || !model.digest)
      throw Error("LOCAL_WEIGHTS_REQUIRED");
    return { name: model.name, digest: model.digest, size: model.size, details: model.details };
  }
  async invoke(prompt, schema, deadline) {
    if (prompt.length > 48000) throw Error("PROMPT_LIMIT");
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw Error("DEADLINE");
    const began = performance.now();
    const r = await this.fetch(`${this.endpoint}/api/chat`, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(Math.max(1, Math.min(this.config.timeoutMs, remaining))),
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        think: false,
        format: schema,
        keep_alive: "10m",
        options: { num_ctx: this.config.context, num_predict: this.config.outputTokens, temperature: 0 },
      }),
    });
    if (!r.ok) throw Error(`LOCAL_HTTP_${r.status}`);
    const text = await r.text();
    if (text.length > 250000) throw Error("MODEL_RESPONSE_LIMIT");
    const result = JSON.parse(text);
    if (!result.done || result.done_reason === "length")
      throw Object.assign(Error("MODEL_OUTPUT_TRUNCATED"), {
        modelUsage: {
          inputTokens: result.prompt_eval_count ?? null,
          outputTokens: result.eval_count ?? null,
          doneReason: result.done_reason ?? null,
          responseCharacters: result.message?.content?.length ?? 0,
          wallMs: performance.now() - began,
        },
      });
    if (!result.message?.content || result.message.content.length > 16000) throw Error("MODEL_OUTPUT_INVALID");
    return {
      output: JSON.parse(result.message.content),
      wallMs: performance.now() - began,
      inputTokens: result.prompt_eval_count ?? null,
      outputTokens: result.eval_count ?? null,
      promptEvalMs: (result.prompt_eval_duration ?? 0) / 1e6,
      generationMs: (result.eval_duration ?? 0) / 1e6,
      loadMs: (result.load_duration ?? 0) / 1e6,
    };
  }
}
