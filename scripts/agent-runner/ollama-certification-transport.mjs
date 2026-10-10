// Operator-launched, decision-only bounded native transport. No credentials or game tools.
import { readFileSync, writeFileSync } from "node:fs";

const [inputFile, outputFile] = process.argv.slice(2);
if (!inputFile || !outputFile) throw Error("OPERATOR_INPUT_OUTPUT_REQUIRED");
const input = JSON.parse(readFileSync(inputFile, "utf8"));
if (input.model !== "qwen3.5:9b" || JSON.stringify(input.facts).length > 30_000) throw Error("CERTIFICATION_BOUNDS");
const endpoint = "http://127.0.0.1:11434";
const tags = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(3000), redirect: "error" }).then((r) =>
  r.json(),
);
const weights = tags.models.find((m) => m.name === input.model);
if (
  weights?.digest !== "56671c2ab9385f9cfcb404638e32cd62d88e3501d44822208363c010179a3c90" ||
  weights.remote_host ||
  weights.remote_model
)
  throw Error("PINNED_LOCAL_WEIGHTS_REQUIRED");
let gpu = null;
const timer = setInterval(async () => {
  try {
    const ps = await fetch(`${endpoint}/api/ps`, { signal: AbortSignal.timeout(2000) }).then((r) => r.json());
    const m = ps.models.find((m) => m.name === input.model);
    if (m) gpu = { loadedSizeBytes: m.size, sizeVramBytes: m.size_vram, contextLength: m.context_length };
  } catch {
    /* Metadata never changes model work. */
  }
}, 5000);
const started = Date.now();
try {
  const r = await fetch(`${endpoint}/api/chat`, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(55_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: input.model,
      messages: [{ role: "user", content: JSON.stringify(input.facts) }],
      stream: false,
      think: false,
      format: input.schema,
      keep_alive: 0,
      options: { num_ctx: 16384, num_predict: 1000, temperature: 0 },
    }),
  });
  if (!r.ok) throw Error(`LOCAL_HTTP_${r.status}`);
  const text = await r.text();
  if (text.length > 100_000) throw Error("RESPONSE_TOO_LARGE");
  const result = JSON.parse(text);
  if (!result.done || result.done_reason === "length") throw Error("OUTPUT_TRUNCATED");
  writeFileSync(
    outputFile,
    JSON.stringify({
      plan: JSON.parse(result.message.content),
      inputTokens: result.prompt_eval_count ?? null,
      outputTokens: result.eval_count ?? null,
      wallMs: Date.now() - started,
      loadMs: (result.load_duration ?? 0) / 1e6,
      promptMs: (result.prompt_eval_duration ?? 0) / 1e6,
      generationMs: (result.eval_duration ?? 0) / 1e6,
      gpu,
    }),
    { mode: 0o600 },
  );
} finally {
  clearInterval(timer);
  // Explicit zero-token unload even on a failed/truncated request; never starts generation.
  await fetch(`${endpoint}/api/generate`, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: input.model, keep_alive: 0 }),
  }).catch(() => {});
}
