import { randomUUID } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { BaselineMcpClient } from "../../scripts/lib/baseline-mcp.js";
import { type BaselineTools, BaselineWriteError, playBaseline } from "../../scripts/lib/baseline-player.js";

afterEach(() => vi.unstubAllGlobals());
const self = randomUUID();
const partner = randomUUID();
const offerId = randomUUID();
const guide = {
  state: "active",
  worldStatus: "active",
  self: { kingdomId: self },
  contacts: [{ kingdomId: partner }],
  activeSupplyContracts: [],
  openSupplyOffers: [],
};
function fixture(overrides: Record<string, unknown> = {}, uncertain = false) {
  const writes: Record<string, unknown>[] = [];
  const reads: string[] = [];
  const receipt = (commandId: unknown, kind?: unknown) => ({
    schemaVersion: "pact.command.v1",
    commandId,
    code: "COMMITTED",
    committedEventIds: [],
    charged: [],
    recordVersions: kind === "game.supply.offer" ? { [`supply-offer:${offerId}`]: 3 } : {},
  });
  const tools: BaselineTools = {
    call: async (name, args) => {
      reads.push(name);
      if (name === "pact_agent_guide_v1") return { ...guide, ...overrides };
      if (name === "pact_world_read_v1") return { audience: "owner", buildings: [], builders: [] };
      if (name === "pact_game_action_v1") {
        writes.push(args);
        if (uncertain) throw new Error("Caller lost response");
        return receipt(args.commandId, (args.action as { kind: string }).kind);
      }
      if (name === "pact_receipt_read_v1") return receipt(args.commandId, "game.supply.offer");
      return {};
    },
  };
  return { tools, writes, reads };
}
it("requires human activation and an accepted contact without writing", async () => {
  for (const overrides of [{ state: "draft" }, { contacts: [] }, { worldStatus: "paused" }]) {
    const f = fixture(overrides);
    await playBaseline(f.tools);
    expect(f.writes).toEqual([]);
    expect(f.reads).not.toContain("run.open");
  }
});
it("does not duplicate existing agreements or offers", async () => {
  for (const field of ["activeSupplyContracts", "openSupplyOffers"]) {
    const f = fixture({ [field]: [{ counterpartyKingdomId: partner }] });
    await playBaseline(f.tools);
    expect(f.writes).toEqual([]);
    expect(f.reads).not.toContain("run.open");
  }
});
it("signs the actual returned offer version", async () => {
  const f = fixture();
  const result = await playBaseline(f.tools);
  expect(result.status).toBe("awaiting_partner_signature");
  expect(f.writes.at(-1)?.action).toEqual({ kind: "game.supply.sign", offerId, version: 3 });
});
it("reconciles uncertain writes by the exact ID without resubmitting", async () => {
  const f = fixture({}, true);
  await playBaseline(f.tools);
  expect(f.writes).toHaveLength(3);
  expect(f.reads.filter((n) => n === "pact_receipt_read_v1")).toHaveLength(3);
  expect(new Set(f.writes.map((w) => w.commandId)).size).toBe(3);
});
it("stops with the uncertain ID when the receipt is unavailable", async () => {
  const f = fixture({}, true);
  const tools = {
    call: async (name: string, args: Record<string, unknown>) => {
      if (name === "pact_receipt_read_v1") throw new Error("Unavailable");
      return f.tools.call(name, args);
    },
  };
  await expect(playBaseline(tools)).rejects.toBeInstanceOf(BaselineWriteError);
  expect(f.writes).toHaveLength(1);
});
it("enforces the call ceiling and rejects invalid ceilings", async () => {
  const f = fixture();
  await expect(playBaseline(f.tools, { maxToolCalls: 1 })).rejects.toThrow("BASELINE_CALL_CEILING");
  expect(f.writes).toEqual([]);
  await expect(playBaseline(f.tools, { maxToolCalls: 21 })).rejects.toThrow("INVALID_CALL_CEILING");
});
it("rejects nonlocal plaintext and credential-bearing URLs", () => {
  for (const url of [
    "http://example.test/mcp",
    "https://user:pass@example.test/mcp",
    "https://example.test/mcp?token=x",
    "https://example.test/mcp#x",
  ])
    expect(() => new BaselineMcpClient(url, "fixture-token")).toThrow();
  expect(() => new BaselineMcpClient("https://example.test/mcp", "bad\ntoken")).toThrow();
});
it("uses the authenticated session, refuses redirects, and closes its lease", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ result: { protocolVersion: "2025-11-25" } }), {
        headers: { "Mcp-Session-Id": "fixture-session" },
      }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 202 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ result: { structuredContent: { state: "active" } } })))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  const client = new BaselineMcpClient("https://example.test/mcp", "fixture-token");
  await expect(client.call("pact_agent_guide_v1", {})).rejects.toThrow("MCP_NOT_INITIALIZED");
  await client.initialize();
  expect(await client.call("pact_agent_guide_v1", {})).toEqual({ state: "active" });
  await client.close();
  expect(fetchMock).toHaveBeenCalledTimes(4);
  for (const [, options] of fetchMock.mock.calls) {
    expect(options.redirect).toBe("error");
    expect(options.headers.Authorization).toBe("Bearer fixture-token");
    expect(options.headers.Origin).toBe("https://example.test");
  }
  expect(fetchMock.mock.calls[2]?.[1].headers["Mcp-Session-Id"]).toBe("fixture-session");
  expect(fetchMock.mock.calls[3]?.[1].method).toBe("DELETE");
  await expect(client.call("pact_agent_guide_v1", {})).rejects.toThrow("MCP_NOT_INITIALIZED");
});
it("does not return rejected remote content", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { protocolVersion: "2025-11-25" } }), {
          headers: { "Mcp-Session-Id": "s" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: { isError: true, content: [{ text: "private remote detail" }] } })),
      ),
  );
  const client = new BaselineMcpClient("https://example.test/mcp", "fixture-token");
  await client.initialize();
  await expect(client.call("pact_agent_guide_v1", {})).rejects.toThrow("MCP_TOOL_REJECTED");
});

it("closes an HTTP session through Fastify JSON parsing", async () => {
  const { default: Fastify } = await import("fastify");
  const server = Fastify();
  let closed = false;
  server.post("/mcp", async (request, reply) => {
    const body = request.body as { method: string };
    if (body.method === "notifications/initialized") return reply.code(202).send();
    reply.header("Mcp-Session-Id", "fixture-http-session");
    return { result: { protocolVersion: "2025-11-25" } };
  });
  server.delete("/mcp", async (_request, reply) => {
    closed = true;
    return reply.code(204).send();
  });
  const address = await server.listen({ host: "127.0.0.1", port: 0 });
  try {
    const client = new BaselineMcpClient(`${address}/mcp`, "fixture-token");
    await client.initialize();
    await client.close();
    expect(closed).toBe(true);
  } finally {
    await server.close();
  }
});
