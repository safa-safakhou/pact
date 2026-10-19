import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createGateway } from "./gateway.mjs";

test("loopback gateway proxies protocol paths and serves built assets without exposing state", async () => {
  const root = await mkdtemp(join(tmpdir(), "pact-gateway-"));
  await writeFile(join(root, "index.html"), "<h1>Local world</h1>");
  const backend = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ path: req.url, host: req.headers.host }));
  });
  await new Promise((r) => backend.listen(0, "127.0.0.1", r));
  const gateway = createGateway({ webRoot: root, apiPort: backend.address().port });
  await new Promise((r) => gateway.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${gateway.address().port}`;
  try {
    assert.match(await (await fetch(base)).text(), /Local world/);
    assert.equal((await (await fetch(`${base}/v2/interfaces`)).json()).path, "/v2/interfaces");
    assert.equal(
      (await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json()).path,
      "/.well-known/oauth-authorization-server",
    );
    assert.equal((await fetch(`${base}/.env`)).status, 404);
    assert.equal((await fetch(`${base}/../.env`)).status, 404);
  } finally {
    await new Promise((r) => gateway.close(r));
    await new Promise((r) => backend.close(r));
    await rm(root, { recursive: true, force: true });
  }
});
