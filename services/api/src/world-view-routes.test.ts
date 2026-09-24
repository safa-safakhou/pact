import type { IdentityService } from "@pact/identity";
import type { WorldViewService } from "@pact/kingdom";
import type { OAuthService } from "@pact/oauth";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerWorldViewRoutes } from "./world-view-routes.js";

const kingdomId = "00000000-0000-4000-8000-000000000001";

describe("authorized world-view routes", () => {
  it("derives the viewer from a human session or scoped token, never request parameters", async () => {
    const calls: { viewer: string; target: string; minutes: number }[] = [];
    const identity = {
      authenticate: async (token: string) => {
        if (token !== "valid") throw new Error("invalid session");
        return { accountId: "human-account" };
      },
    } as unknown as IdentityService;
    const oauth = {
      introspectAccessToken: async (token: string) =>
        token === "reader"
          ? { accountId: "agent-account", scopes: ["world:read"], audience: "mcp" }
          : token === "writer"
            ? { accountId: "agent-account", scopes: ["game:act"], audience: "mcp" }
            : null,
    } as unknown as OAuthService;
    const worldViews = {
      read: async (viewer: string, target: string, minutes: number) => {
        calls.push({ viewer, target, minutes });
        return { audience: "public", profile: { kingdomId: target } };
      },
    } as unknown as WorldViewService;
    const server = Fastify();
    registerWorldViewRoutes(server, identity, worldViews, oauth);
    try {
      const human = await server.inject({
        method: "GET",
        url: `/v1/world/kingdoms/${kingdomId}?forecastMinutes=2&accountId=forged`,
        headers: { cookie: "pact_session=valid" },
      });
      expect(human.statusCode).toBe(200);
      expect(calls.at(-1)).toEqual({ viewer: "human-account", target: kingdomId, minutes: 2 });
      const reader = await server.inject({
        method: "GET",
        url: `/v1/world/kingdoms/${kingdomId}`,
        headers: { authorization: "Bearer reader" },
      });
      expect(reader.statusCode).toBe(200);
      expect(calls.at(-1)).toEqual({ viewer: "agent-account", target: kingdomId, minutes: 60 });
      const writer = await server.inject({
        method: "GET",
        url: `/v1/world/kingdoms/${kingdomId}`,
        headers: { authorization: "Bearer writer" },
      });
      expect(writer.statusCode).toBe(403);
      expect(calls).toHaveLength(2);
      const oversized = await server.inject({
        method: "GET",
        url: `/v1/world/kingdoms/${kingdomId}?forecastMinutes=61`,
        headers: { cookie: "pact_session=valid" },
      });
      expect(oversized.statusCode).toBe(400);
      expect(calls).toHaveLength(2);
    } finally {
      await server.close();
    }
  });
});
