// Run on the Windows owner machine. Auth remains here; SSH carries synthetic jobs/results only.

import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { RequestBudget } from "./budget.mjs";

const dir = process.env.PACT_MODEL_STATE ?? "C:/Users/ENDORFY/pact-population-20261004";
const codex =
  process.env.PACT_CODEX_EXE ?? "C:/Users/ENDORFY/AppData/Local/OpenAI/Codex/bin/8aaf1547b825b104/codex.exe";
fs.mkdirSync(dir, { recursive: true });
const budget = new RequestBudget(path.join(dir, "budget.json"), 200);
const events = path.join(dir, "model-events.jsonl");
const log = (type, data = {}) =>
  fs.appendFileSync(events, `${JSON.stringify({ at: new Date().toISOString(), type, ...data })}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let current = null,
  child = null;
async function ssh(mode, input) {
  const args = [
    "-d",
    "Ubuntu",
    "--",
    "ssh",
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=10",
    "-o",
    "ControlMaster=auto",
    "-o",
    "ControlPersist=600",
    "-o",
    "ControlPath=/home/mnim/.ssh/pact-experience-%r@%h:%p",
    "agentic@2.28.57.254",
    `node /srv/pact/state/population-20261004/harness/queue.mjs ${mode}`,
  ];
  return new Promise((resolve, reject) => {
    const p = spawn("wsl.exe", args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"], timeout: 30000 });
    let out = "";
    p.stdout.on("data", (b) => {
      out += b;
      if (out.length > 1000000) p.kill();
    });
    p.stderr.resume();
    p.on("error", reject);
    p.on("close", (code) => {
      if (code !== 0) reject(Error(`SSH_${code}`));
      else
        try {
          resolve(JSON.parse(out));
        } catch {
          reject(Error("SSH_RESULT_INVALID"));
        }
    });
    p.stdin.end(input ? JSON.stringify(input) : "");
  });
}
const proxy = http.createServer(async (req, res) => {
  if (req.method !== "POST" || !current || req.url !== "/responses") {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const sequence = budget.take(Date.now(), current.deadline);
    current.requests++;
    log("provider_request", { sequence, jobId: current.id, actor: current.actor, phase: current.phase });
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > 1000000) throw Error("BODY_LIMIT");
      chunks.push(c);
    }
    const headers = { ...req.headers };
    for (const k of ["host", "connection", "content-length", "accept-encoding"]) delete headers[k];
    const upstream = await fetch("https://chatgpt.com/backend-api/codex/responses", {
      method: "POST",
      headers,
      body: Buffer.concat(chunks),
      signal: AbortSignal.timeout(Math.max(1, Math.min(120000, current.deadline - Date.now()))),
    });
    log("provider_status", { jobId: current.id, status: upstream.status });
    const out = {};
    for (const [k, v] of upstream.headers)
      if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(k)) out[k] = v;
    res.writeHead(upstream.status, out);
    if (upstream.body) Readable.fromWeb(upstream.body).pipe(res);
    else res.end();
  } catch (e) {
    log("provider_blocked", { reason: e.message });
    if (!res.headersSent) res.writeHead(429, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { message: "Bounded experiment request stopped", type: "budget_or_deadline" } }));
  }
});
async function execute(job) {
  const home = path.join(dir, "codex-home");
  fs.mkdirSync(home, { recursive: true });
  fs.copyFileSync("C:/Users/ENDORFY/.codex/auth.json", path.join(home, "auth.json"));
  const work = path.join(dir, "empty");
  fs.mkdirSync(work, { recursive: true });
  const schemaFile = path.join(dir, "schema.json"),
    outFile = path.join(dir, `${job.id}.output.json`);
  fs.writeFileSync(schemaFile, JSON.stringify(job.schema));
  current = { ...job, requests: 0 };
  const args = [
    "exec",
    "--ignore-user-config",
    "--skip-git-repo-check",
    "--ephemeral",
    "--disable",
    "shell_tool",
    "--disable",
    "multi_agent",
    "--sandbox",
    "read-only",
    "-C",
    work,
    "-m",
    "gpt-6-luna",
    "-c",
    'model_reasoning_effort="low"',
    "-c",
    'model_provider="population"',
    "-c",
    'model_providers.population.name="PACT bounded population"',
    "-c",
    "model_providers.population.requires_openai_auth=true",
    "-c",
    'model_providers.population.wire_api="responses"',
    "-c",
    `model_providers.population.base_url="http://127.0.0.1:${proxy.address().port}"`,
    "-c",
    "model_providers.population.request_max_retries=0",
    "-c",
    "model_providers.population.stream_max_retries=0",
    "-c",
    "model_providers.population.supports_websockets=false",
    "--json",
    "--output-schema",
    schemaFile,
    "-o",
    outFile,
    "-",
  ];
  let output = "",
    usage = null,
    unexpectedTool = false;
  const code = await new Promise((resolve, reject) => {
    child = spawn(codex, args, {
      windowsHide: true,
      env: { ...process.env, CODEX_HOME: home },
      stdio: ["pipe", "pipe", "pipe"],
      timeout: Math.max(1000, Math.min(140000, job.deadline - Date.now() - 5000)),
    });
    child.stderr.resume();
    child.stdout.on("data", (b) => {
      output += b;
      if (output.length > 2000000) child.kill();
    });
    child.on("error", reject);
    child.on("close", resolve);
    child.stdin.end(
      `Do not use any tools. This is a structured simulation decision from provided facts only.\n${job.prompt}`,
    );
  });
  for (const line of output.split("\n"))
    try {
      const e = JSON.parse(line);
      if (e.type === "turn.completed") usage = e.usage;
      if (e.type === "item.completed" && ["command_execution", "mcp_tool_call", "web_search"].includes(e.item?.type))
        unexpectedTool = true;
    } catch {}
  const requests = current.requests;
  current = null;
  child = null;
  let parsed = null;
  if (fs.existsSync(outFile))
    try {
      parsed = JSON.parse(fs.readFileSync(outFile, "utf8"));
    } catch {}
  const result = {
    id: job.id,
    runId: job.runId,
    ok: code === 0 && !!parsed && !unexpectedTool,
    output: parsed,
    usage,
    requests,
    totalRequests: budget.value.requests,
    error: code === 0 ? (parsed ? "" : "INVALID_JSON") : `CLI_EXIT_${code}`,
  };
  log("job_completed", { id: job.id, actor: job.actor, phase: job.phase, ...result });
  return result;
}
await new Promise((r) => proxy.listen(0, "127.0.0.1", r));
log("worker_started", { cap: 200 });
let idleSince = Date.now();
const workerDeadline = Date.now() + 3 * 60 * 60 * 1000;
while (Date.now() < workerDeadline && !fs.existsSync(path.join(dir, "STOP"))) {
  try {
    const job = await ssh("claim");
    if (!job) {
      if (Date.now() - idleSince > 25 * 60000) break;
      await sleep(2000);
      continue;
    }
    idleSince = Date.now();
    let result;
    if (
      job.model !== "gpt-6-luna" ||
      job.prompt.length > 60000 ||
      job.deadline < Date.now() ||
      budget.value.requests >= 200
    )
      result = { id: job.id, runId: job.runId, ok: false, error: "MODEL_BUDGET_DEADLINE_OR_INPUT_LIMIT" };
    else
      try {
        result = await execute(job);
      } catch (_e) {
        current = null;
        child?.kill();
        child = null;
        result = { id: job.id, runId: job.runId, ok: false, error: "WORKER_FAILURE" };
        log("execution_failed", { id: job.id });
      }
    fs.writeFileSync(path.join(dir, `${job.id}.result.json`), JSON.stringify(result));
    for (let attempt = 0; attempt < 3; attempt++)
      try {
        await ssh("result", result);
        break;
      } catch {
        log("result_delivery_failed", { id: job.id, attempt });
        await sleep(3000);
      }
  } catch {
    log("queue_unavailable");
    await sleep(10000);
  }
}
log("worker_stopped", { requests: budget.value.requests });
proxy.close();
