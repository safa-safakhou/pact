// Operator-only repair for sessions orphaned by the initial harness DELETE bug.
// Database access is READ ONLY; closure goes through each synthetic owner's public MCP grant.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { Mcp } from "./client.mjs";

const dir = "/srv/pact/state/population-20261004",
  s = JSON.parse(fs.readFileSync(`${dir}/private-state.json`, "utf8"));
const ids = s.actors.map((a) => a.accountId);
if (ids.some((x) => !/^[0-9a-f-]{36}$/.test(x))) throw Error("BAD_ID");
const query =
  "SELECT row_to_json(s)::text FROM (SELECT id,account_id FROM mcp_sessions WHERE product_scope='pact' AND account_id IN (" +
  ids.map((x) => `'${x}'::uuid`).join(",") +
  ")) s";
const raw = execFileSync(
  "docker",
  ["exec", "pact-connection-test-postgres-1", "psql", "-U", "pact", "-d", "pact", "-At", "-c", query],
  { encoding: "utf8" },
);
let closed = 0;
for (const line of raw.trim().split("\n").filter(Boolean)) {
  const row = JSON.parse(line),
    a = s.actors.find((a) => a.accountId === row.account_id);
  const m = new Mcp(`${s.base}/mcp`, a.tokens.access_token);
  m.session = row.id;
  await m.close();
  closed++;
}
fs.appendFileSync(
  `${dir}/events.jsonl`,
  `${JSON.stringify({
    at: new Date().toISOString(),
    runId: s.runId,
    type: "operator_recovery",
    note: "Closed orphaned synthetic cohort MCP sessions through their own grants; SELECT-only DB read recovered lost session IDs.",
    closed,
  })}\n`,
);
console.log(JSON.stringify({ closed }));
