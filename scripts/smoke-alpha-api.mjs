import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const [baseUrl, email, passwordFile] = process.argv.slice(2);
if (!baseUrl || !email || !passwordFile) {
  process.stderr.write("usage: node scripts/smoke-alpha-api.mjs BASE_URL TEST_EMAIL PASSWORD_FILE\n");
  process.exit(2);
}
const password = (await readFile(passwordFile, "utf8")).trim();
const base = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
async function request(path, options = {}) {
  const response = await fetch(new URL(path, base), options);
  const value = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${value.error?.code ?? "REQUEST_FAILED"}`);
  return { response, value };
}
const login = await request("v1/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email, password, label: "Alpha API smoke" }),
});
const cookie = login.response.headers.get("set-cookie")?.split(";")[0];
if (!cookie || typeof login.value.csrfToken !== "string") throw new Error("MISSING_SESSION");
const headers = { cookie, origin: base.origin, "x-csrf-token": login.value.csrfToken };
const kingdom = (await request("v1/kingdom/me", { headers: { cookie } })).value;
const view = (await request(`v1/world/kingdoms/${encodeURIComponent(kingdom.kingdomId)}`, { headers: { cookie } }))
  .value;
if (view.audience !== "owner" || view.profile?.kingdomId !== kingdom.kingdomId) throw new Error("OWNER_VIEW_MISMATCH");
const commandId = randomUUID();
const command = {
  schemaVersion: "pact.command.v1",
  commandId,
  actor: {
    principalId: "server-derived",
    productScope: "pact",
    audience: "human",
    subject: { type: "account", id: "server-derived" },
  },
  action: { kind: "sandbox.echo", message: "Alpha API smoke" },
  submittedAt: new Date().toISOString(),
};
const submitted = (
  await request("v1/commands", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json", "x-pact-api-version": "pact.api.v1" },
    body: JSON.stringify(command),
  })
).value;
const reconciled = (
  await request(`v1/receipts/${commandId}`, { headers: { cookie, "x-pact-api-version": "pact.api.v1" } })
).value;
if (submitted.commandId !== commandId || reconciled.commandId !== commandId) throw new Error("RECEIPT_MISMATCH");
const inbox = (await request("v1/inbox?limit=1", { headers: { cookie, "x-pact-api-version": "pact.api.v1" } })).value;
if (!Array.isArray(inbox.events)) throw new Error("INBOX_MISMATCH");
process.stdout.write(`PASS: owner view, sandbox command/receipt, inbox for kingdom ${kingdom.kingdomId}\n`);
