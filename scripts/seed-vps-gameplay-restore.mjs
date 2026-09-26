import { readFileSync } from "node:fs";

const apiBase = process.env.PACT_FIXTURE_API_BASE ?? "http://127.0.0.1:8088";
const origin = process.env.PACT_FIXTURE_ORIGIN ?? "https://safa.dedyn.io";
const email = process.env.PACT_FIXTURE_EMAIL ?? "pact-mvp-owner@example.test";
const passwordFile = process.env.PACT_FIXTURE_PASSWORD_FILE;
if (!passwordFile) throw new Error("PACT_FIXTURE_PASSWORD_FILE is required");
const password = readFileSync(passwordFile, "utf8").trim();
if (!password) throw new Error("Fixture password file is empty");

async function request(path, body, credentials) {
  const response = await fetch(new URL(path, apiBase), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(credentials ? { cookie: credentials.cookie, "x-csrf-token": credentials.csrfToken } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) {
    const code = result?.error?.code ?? result?.code ?? `HTTP_${response.status}`;
    throw new Error(`${path}: ${code}`);
  }
  return { response, result };
}

const login = await request("/v1/auth/login", { email, password });
const cookie = login.response.headers.get("set-cookie")?.split(";")[0];
const csrfToken = login.result.csrfToken;
if (!cookie || typeof csrfToken !== "string") throw new Error("Login returned no session or CSRF token");
const credentials = { cookie, csrfToken };
await request("/v1/setup/connection-check", {}, credentials);
const activation = await request("/v1/setup/activate", {}, credentials);
const kingdomId = activation.result.kingdomId;
if (typeof kingdomId !== "string") throw new Error("Activation returned no kingdom ID");
// A founding allowance can pay for Farm II immediately; ordinary training
// stock only accrues after enough authoritative minute ticks.
const commandId = "2dcc93b2-84be-4084-95d2-ddfcb802e331";
const command = {
  schemaVersion: "pact.command.v1",
  commandId,
  actor: {
    principalId: kingdomId,
    productScope: "pact",
    audience: "human",
    subject: { type: "account", id: kingdomId },
  },
  action: { kind: "game.building.queue", building: "farm", targetLevel: 2, slot: 1 },
  submittedAt: new Date().toISOString(),
};
const submitted = await request("/v1/commands", command, credentials);
if (!["COMMITTED", "ALREADY_COMMITTED"].includes(submitted.result.code))
  throw new Error(`Construction command: ${submitted.result.code ?? "UNKNOWN"}`);
process.stdout.write(
  `PASS: synthetic kingdom ${kingdomId} is active; construction command ${commandId} returned ${submitted.result.code}.\n`,
);
