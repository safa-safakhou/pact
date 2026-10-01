import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConnectionNotice } from "./game-app.js";
import { LiveConnection, liveFetch } from "./live-connection.js";
import { createWebPactClient } from "./pact-client.js";

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

describe("live-only commitments", () => {
  it("requires a fresh read after reconnect and rejects an older refresh", () => {
    const c = new LiveConnection(true);
    const old = c.beginRefresh();
    c.invalidate(false);
    expect(c.status).toBe("offline");
    c.invalidate(true);
    expect(c.confirmRefresh(old)).toBe(false);
    expect(() => c.assertWrite()).toThrow("LIVE_REFRESH_REQUIRED");
    expect(c.confirmRefresh(c.beginRefresh())).toBe(true);
    expect(c.writable).toBe(true);
  });

  it("never submits or queues disconnected signatures, raids, approvals or run controls", async () => {
    const c = new LiveConnection(false);
    const network = vi.fn<Fetch>();
    const send = liveFetch(network, c, vi.fn());
    for (const path of ["commands", "approvals/a/approve", "runs/r/resume"])
      await expect(send(`https://example.test/v1/${path}`, { method: "POST" })).rejects.toThrow("Nothing was queued");
    c.invalidate(true);
    c.confirmRefresh(c.beginRefresh());
    expect(network).not.toHaveBeenCalled();
  });

  it("gates the SDK transport too; a network failure permits reads, not another write", async () => {
    const c = new LiveConnection(true);
    const changed = vi.fn();
    const network = vi.fn<Fetch>().mockRejectedValueOnce(new TypeError("disconnected"));
    const send = liveFetch(network, c, changed);
    const sdk = createWebPactClient({ apiOrigin: "https://example.test/", csrfToken: () => "synthetic", fetch: send });
    await expect(
      sdk.submitCommand(sdk.prepareCommand({ kind: "sandbox.echo", message: "synthetic" })),
    ).rejects.toThrow();
    expect(changed).toHaveBeenCalledOnce();
    await expect(send("https://example.test/v1/approvals/a", { method: "POST" })).rejects.toThrow(
      "LIVE_REFRESH_REQUIRED",
    );
    network.mockResolvedValueOnce(new Response("{}"));
    await send("https://example.test/v1/world");
    expect(c.status).toBe("stale");
    expect(network).toHaveBeenCalledTimes(2);
  });

  it("treats 503 as unavailable, not a successful action or healthy refresh", async () => {
    const c = new LiveConnection(true);
    const changed = vi.fn();
    const send = liveFetch(vi.fn<Fetch>().mockResolvedValue(new Response("{}", { status: 503 })), c, changed);
    const old = c.beginRefresh();
    expect((await send("https://example.test/v1/world")).status).toBe(503);
    expect(c.confirmRefresh(old)).toBe(false);
    expect(c.writable).toBe(false);
    expect(changed).toHaveBeenCalledOnce();
  });

  it("explains stale/offline in text with a reachable recovery control", () => {
    for (const status of ["stale", "offline"] as const) {
      const html = renderToStaticMarkup(
        createElement(ConnectionNotice, { status, lastRefreshed: null, onRefresh: vi.fn() }),
      );
      expect(html).toContain('role="status"');
      expect(html).toContain("stale");
      expect(html).toContain("Refresh live state</button>");
      expect(html).not.toContain("Last owner refresh");
    }
  });
});
