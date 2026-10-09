import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { Mcp, PublicClient } from "./client.mjs";

test("MCP rule denial, persisted denial receipt, and absent receipt remain distinct", async () => {
  let result;
  const server = http.createServer((req, res) => {
    req.resume();
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ result }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const c = new Mcp(`http://127.0.0.1:${server.address().port}`, "fake-token");
    result = {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: { code: "CONTACT_REQUIRED", recovery: "Accept the actual incoming request first." },
          }),
        },
      ],
    };
    await assert.rejects(
      c.call("pact_game_action_v1"),
      (e) => e.serverCode === "CONTACT_REQUIRED" && e.serverRecovery === "Accept the actual incoming request first.",
    );
    result = { isError: true, structuredContent: { commandId: "original-id", code: "FORBIDDEN" } };
    assert.deepEqual(await c.call("pact_game_action_v1"), result.structuredContent);
    result = { isError: true, structuredContent: { code: "RECEIPT_NOT_FOUND", receiptExists: false } };
    assert.equal((await c.call("pact_receipt_read_v1")).receiptExists, false);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("human command failures preserve top-level dispatcher error codes", async () => {
  const server = http.createServer((req, res) => {
    req.resume();
    res.writeHead(409, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ code: "TICK_PENDING" }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const client = new PublicClient(`http://127.0.0.1:${server.address().port}`, {});
    await assert.rejects(client.http("/v1/commands", {}), (e) => e.serverCode === "TICK_PENDING");
  } finally {
    await new Promise((r) => server.close(r));
  }
});
