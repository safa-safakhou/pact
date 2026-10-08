/** Explicit live verification: creates one labelled synthetic guest, no model calls or counterpart writes. */

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

const base = process.argv[2];
if (!base || !process.argv.includes("--create-synthetic-player"))
  throw Error("Usage: node scripts/chatgpt-smoke.mjs HTTPS_BASE --create-synthetic-player");
const root = base.replace(/\/$/, ""),
  origin = new URL(root).origin;
let cookie, csrf, access, session;
async function request(path, body, auth = "human", method = body ? "POST" : "GET") {
  const headers = { origin, accept: "application/json, text/event-stream" };
  if (body) headers["content-type"] = "application/json";
  if (auth === "human" && cookie) {
    headers.cookie = cookie;
    if (body) headers["x-csrf-token"] = csrf;
  }
  if (auth === "agent") {
    headers.authorization = `Bearer ${access}`;
    if (session) headers["mcp-session-id"] = session;
  }
  const response = await fetch(root + path, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  assert(response.ok, `${method} ${path}: HTTP ${response.status}`);
  return { response, data: response.status === 202 || response.status === 204 ? null : await response.json() };
}
const metadata = (await request("/.well-known/oauth-authorization-server", null, "none")).data;
assert.equal(metadata.authorization_response_iss_parameter_supported, true);
const joined = await request("/v1/play/join", { entryKey: randomUUID(), nickname: "Synthetic ChatGPT probe" }, "none");
cookie = joined.response.headers.get("set-cookie").split(";")[0];
csrf = joined.data.csrfToken;
const client = (
  await request(
    "/oauth/register",
    {
      client_name: "Synthetic ChatGPT certification",
      redirect_uris: ["https://chatgpt.com/connector/oauth/synthetic-pact-test"],
    },
    "none",
  )
).data;
const verifier = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
const challenge = createHash("sha256").update(verifier).digest("base64url");
const query = {
  client_id: client.client_id,
  redirect_uri: client.redirect_uris[0],
  scope: "world:read game:act",
  code_challenge: challenge,
  code_challenge_method: "S256",
  resource: root + "/mcp",
  audience: "mcp",
  subject_label: "Synthetic ChatGPT probe",
};
const authorization = (await request("/oauth/authorize", query)).data;
const tokens = (
  await request(
    "/oauth/token",
    {
      grant_type: "authorization_code",
      client_id: client.client_id,
      code: authorization.code,
      redirect_uri: query.redirect_uri,
      code_verifier: verifier,
      resource: query.resource,
    },
    "none",
  )
).data;
access = tokens.access_token;
let id = 0;
async function rpc(method, params = {}) {
  const r = await request("/mcp", { jsonrpc: "2.0", id: ++id, method, params }, "agent");
  if (method === "initialize") session = r.response.headers.get("mcp-session-id");
  assert(!r.data?.error, "RPC error: " + method);
  return r.data.result;
}
await rpc("initialize", {
  protocolVersion: "2025-11-25",
  capabilities: {},
  clientInfo: { name: "Synthetic ChatGPT probe", version: "1" },
});
await request("/mcp", { jsonrpc: "2.0", method: "notifications/initialized" }, "agent");
const tools = await rpc("tools/list");
assert(tools.tools.some((t) => t.name === "pact_play_view_v1" && t._meta.ui.resourceUri));
assert(tools.tools.every((t) => t.securitySchemes?.length));
const resources = await rpc("resources/list");
assert.match(resources.resources[0].uri, /^ui:\/\/pact\/play-[a-f0-9]{16}\.html$/);
const playDescriptor = tools.tools.find((t) => t.name === "pact_play_view_v1");
assert.equal(playDescriptor._meta.ui.resourceUri, resources.resources[0].uri);
assert.equal(playDescriptor._meta["openai/outputTemplate"], resources.resources[0].uri);
const html = await rpc("resources/read", { uri: resources.resources[0].uri });
assert(html.contents[0].text.includes("ui/initialize"));
assert(html.contents[0].text.includes("Your negotiations"));
assert(html.contents[0].text.includes("createLandscape"));
assert.equal(html.contents[0]._meta["openai/ui"].preferredDisplayMode, "fullscreen");
assert(tools.tools.some((t) => t.name === "pact_council_thread_v1"));
assert(!html.contents[0].text.includes("Full factual snapshot"));
async function call(name, args = {}) {
  return rpc("tools/call", { name, arguments: args });
}
const before = (await call("pact_notes_read_v1")).structuredContent;
const text = "Any free-form workflow 🌍 — synthetic certification; no strategic category.";
assert.equal(
  (await call("pact_notes_write_v1", { text, expectedVersion: before.version })).structuredContent.saved,
  true,
);
assert.equal(
  (await call("pact_notes_write_v1", { text: "stale overwrite", expectedVersion: before.version })).isError,
  true,
);
assert.equal((await call("pact_notes_read_v1")).structuredContent.text, text);
const view = (await call("pact_play_view_v1")).structuredContent;
assert.equal(view.world.audience, "owner");
assert.equal(view.world.ambition, text);
assert(view.interactions && Array.isArray(view.interactions.messages));
assert(view.parties[view.interactions.kingdomId].character.name);
assert.equal(view.parties[view.interactions.kingdomId].agent.runActive, false);
const exchange = (await call("pact_council_thread_v1", { kingdomId: view.interactions.kingdomId })).structuredContent;
assert.deepEqual(exchange.messages, []);
assert.equal(exchange.next, null);
assert.equal(view.players.pageSize, 8);
assert(view.players.players.length <= 8);
const discovery = (await call("pact_play_view_v1", { search: "Cinder", offset: 0 })).structuredContent;
assert.equal(discovery.players.query, "Cinder");
assert(discovery.players.players.every((p) => typeof p.hallLevel === "number"));
assert(
  discovery.players.players.every((p) =>
    Object.keys(p).every((k) => ["kingdomId", "handle", "displayName", "hallLevel"].includes(k)),
  ),
);
const mandate = (await request("/v1/mandate")).data;
await request("/v1/mandate", {
  allowedActions: ["world.read", "building.queue"],
  resourceLimits: { iron: "300000", silver: "300000", grain: "300000" },
  reserveFloors: { grain: "12000" },
  troopLimit: 0,
  sessionLimit: 1,
  expectedVersion: mandate.version,
});
const commandId = randomUUID();
const action = { kind: "game.building.queue", building: "farm", targetLevel: 2, slot: 1 };
const deniedWithoutLease = await call("pact_game_action_v1", { commandId, action });
assert.equal(deniedWithoutLease.isError, true);
assert(JSON.stringify(deniedWithoutLease).includes("WRITE_LEASE_REQUIRED"));
await call("run.open");
const leaseSession = session;
// ChatGPT can initialize separate transports for separate tool calls.
await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {} });
assert.equal(session, leaseSession, "OAuth reconnect must preserve the lease-owning logical session");
const receipt = await call("pact_game_action_v1", { commandId, action });
assert(
  ["COMMITTED", "ALREADY_COMMITTED"].includes(receipt.structuredContent.code),
  "Building receipt: " + receipt.structuredContent.code,
);
await rpc("initialize", { protocolVersion: "2025-11-25", capabilities: {} });
assert.equal(session, leaseSession);
const replay = await call("pact_game_action_v1", { commandId, action });
assert(["COMMITTED", "ALREADY_COMMITTED"].includes(replay.structuredContent.code));
await request("/mcp", null, "agent", "DELETE");
await request("/oauth/revoke", { token: tokens.refresh_token, client_id: client.client_id }, "none");
console.log(
  JSON.stringify({
    passed: true,
    syntheticKingdomId: joined.data.kingdomId,
    toolCount: tools.tools.length,
    uiResource: resources.resources[0].uri,
    privateNotes: "persisted; stale write rejected",
    gameplay: "one self-owned farm queued with replay receipt verified",
    modelCalls: 0,
    counterpartWrites: 0,
    lease: "preserved across reconnects; closed",
    oauthGrant: "revoked",
  }),
);
