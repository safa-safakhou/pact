import path from "node:path";
import { fileURLToPath } from "node:url";

function integer(value, fallback, min, max) {
  const n = Number(value ?? fallback);
  if (!Number.isInteger(n) || n < min || n > max) throw Error("INVALID_CONFIG_NUMBER");
  return n;
}

export function localEndpoint(value) {
  const u = new URL(value);
  if (
    u.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname) ||
    u.username ||
    u.password ||
    u.pathname !== "/" ||
    u.search ||
    u.hash
  )
    throw Error("LOCAL_ENDPOINT_REQUIRED");
  return u.origin;
}

export function readConfig(env = process.env, platform = process.platform) {
  if (!env.PACT_LOCAL_STATE) throw Error("PACT_LOCAL_STATE_REQUIRED");
  if (platform === "win32" && /^(?:\\\\|\/\/)/.test(env.PACT_LOCAL_STATE))
    throw Error("WINDOWS_STATE_LOCAL_DISK_REQUIRED");
  const dir = path.resolve(env.PACT_LOCAL_STATE);
  const root = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
  const relative = path.relative(root, dir);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)))
    throw Error("STATE_MUST_BE_OUTSIDE_REPOSITORY");
  const base = new URL(env.PACT_LOCAL_BASE ?? "https://pact.tinyagenttools.com");
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash)
    throw Error("HTTPS_GAME_BASE_REQUIRED");
  const model = env.PACT_LOCAL_MODEL ?? "qwen3.5:4b";
  const ownerApprovals = env.PACT_LOCAL_OWNER_APPROVALS ?? "bounded";
  if (!["bounded", "off"].includes(ownerApprovals)) throw Error("INVALID_OWNER_POLICY");
  if (!/^[a-zA-Z0-9_.:-]+$/.test(model) || model.endsWith(":cloud")) throw Error("LOCAL_MODEL_REQUIRED");
  return {
    dir,
    config: {
      base: base.href.replace(/\/$/, ""),
      endpoint: localEndpoint(env.PACT_LOCAL_OLLAMA ?? "http://127.0.0.1:11434"),
      model,
      accounts: integer(env.PACT_LOCAL_ACCOUNTS, 4, 1, 100),
      durationMinutes: integer(env.PACT_LOCAL_MINUTES, 20, 1, 120),
      intervalSeconds: integer(env.PACT_LOCAL_INTERVAL_SECONDS, 300, 300, 3600),
      requestCap: integer(env.PACT_LOCAL_REQUEST_CAP, 100, 1, 2000),
      context: integer(env.PACT_LOCAL_CONTEXT, 16384, 4096, 32768),
      outputTokens: integer(env.PACT_LOCAL_OUTPUT_TOKENS, 1000, 128, 1200),
      timeoutMs: integer(env.PACT_LOCAL_TIMEOUT_MS, 90000, 1000, 120000),
      ownerApprovals,
      ownerApprovalCap: integer(env.PACT_LOCAL_OWNER_APPROVAL_CAP, 20, 0, 100),
      ownerResourceLimit: integer(env.PACT_LOCAL_OWNER_RESOURCE_LIMIT, 500, 0, 1000),
    },
  };
}
