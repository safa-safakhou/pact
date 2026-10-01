// Operator-only synthetic-account playtest. Never give this script or its secrets to a playing agent.

import { execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const accounts = {
  aster: ["pact-mvp-owner@example.test", "operator_test_password"],
  briar: ["pact-codex-briar@example.test", "codex_briar_password"],
  cinder: ["pact-codex-cinder@example.test", "codex_cinder_password"],
};
const [profile, goal] = process.argv.slice(2);
if (!Object.hasOwn(accounts, profile ?? "") || !goal) {
  throw new Error("Usage: node scripts/codex-alpha-player.mjs aster|briar|cinder 'ordinary player goal'");
}
const [email, passwordFile] = accounts[profile];
const base = "https://safa.dedyn.io/pact";
const origin = "https://safa.dedyn.io";
const resource = `${base}/mcp`;
const redirect = "http://127.0.0.1:47981/callback";
async function post(path, body, headers = {}) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`PACT ${path} failed with HTTP ${response.status}`);
  return { body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
// Fixed file names only; stdout stays in this process, not the agent prompt or terminal.
const password = execFileSync(
  "ssh",
  ["-o", "BatchMode=yes", "agentic@2.28.57.254", `cat /srv/pact/secrets/connection-test/${passwordFile}`],
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
).trim();
const login = await post("/v1/auth/login", { email, password, label: "Synthetic Alpha operator rehearsal" });
if (goal === "--report") {
  const response = await fetch(`${base}/v1/runs/external-activity`, {
    headers: { cookie: login.cookie },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Owner activity failed with HTTP ${response.status}`);
  console.log(JSON.stringify({ profile, activity: await response.json() }));
  process.exit(0);
}
const registration = await post("/oauth/register", {
  client_name: `Synthetic Alpha ${profile}`,
  audience: "mcp",
  redirect_uris: [redirect],
});
const verifier = randomBytes(32).toString("base64url");
const authorization = await post(
  "/oauth/authorize",
  {
    client_id: registration.body.client_id,
    redirect_uri: redirect,
    scope: "world:read messages:write game:act",
    resource,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    subject_label: `Synthetic ${profile}`,
    audience: "mcp",
  },
  { cookie: login.cookie, "x-csrf-token": login.body.csrfToken },
);
const tokens = (
  await post("/oauth/token", {
    grant_type: "authorization_code",
    client_id: registration.body.client_id,
    code: authorization.body.code,
    redirect_uri: redirect,
    code_verifier: verifier,
    resource,
  })
).body;
const directory = await mkdtemp(join(tmpdir(), `pact-${profile}-`));
const name = `pact_${profile}_rehearsal`;
const args = [
  "exec",
  "--ignore-user-config",
  "--skip-git-repo-check",
  "--ephemeral",
  "--disable",
  "shell_tool",
  "--disable",
  "multi_agent",
  "-C",
  directory,
  "-m",
  "gpt-6-luna",
  "-c",
  `mcp_servers.${name}.url=${JSON.stringify(`${resource}?profile=${profile}-rehearsal`)}`,
  "-c",
  `mcp_servers.${name}.bearer_token_env_var="PACT_ALPHA_PLAYER_TOKEN"`,
  "-c",
  `mcp_servers.${name}.default_tools_approval_mode="approve"`,
  "-c",
  `mcp_servers.${name}.required=true`,
  "--json",
  `Use only ${name} for PACT. ${goal} Make permitted moves within my existing authority; bring human-only decisions back to me. Show what actually committed, what failed, and whether it felt fun or confusing. Stop within this one bounded game session. Do not use files, shell, or other services.`,
];
console.log(JSON.stringify({ profile, startedAt: new Date().toISOString(), model: "gpt-6-luna" }));
try {
  const child = spawn(process.env.PACT_CODEX_BIN ?? "codex", args, {
    env: { ...process.env, PACT_ALPHA_PLAYER_TOKEN: tokens.access_token },
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 20 * 60_000,
  });
  child.stderr.resume();
  const completion = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  // No hidden reasoning, credentials, arguments, or raw private tool results in the transcript.
  const lines = createInterface({ input: child.stdout });
  for await (const line of lines) {
    try {
      const event = JSON.parse(line);
      if (event.type === "turn.completed") console.log(JSON.stringify(event));
      if (event.type === "turn.failed" || event.type === "error")
        console.log(JSON.stringify({ type: event.type, failure: true }));
      if (event.type === "item.completed" && event.item?.type === "agent_message")
        console.log(JSON.stringify({ type: "player_report", text: event.item.text }));
      if (event.type === "item.completed" && event.item?.type === "mcp_tool_call")
        console.log(JSON.stringify({ type: "tool_completed", tool: event.item.tool, status: event.item.status }));
    } catch {
      /* Ignore non-JSON diagnostics; never print raw authentication data. */
    }
  }
  const code = await completion;
  if (code !== 0) throw new Error(`Codex player exited with ${code}`);
} finally {
  // Revoke the grant's refresh family too; no reusable credentials are saved.
  await post("/oauth/revoke", { token: tokens.refresh_token });
  console.log(JSON.stringify({ profile, grantRevoked: true, endedAt: new Date().toISOString() }));
}
