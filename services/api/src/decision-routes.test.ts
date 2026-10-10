import type { DecisionSupportReader } from "@pact/application";
import type { IdentityService } from "@pact/identity";
import type { OAuthService } from "@pact/oauth";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerDecisionRoutes } from "./decision-routes.js";

describe("decision support authorization", () => {
  it("derives owner from session/read grant and rejects foreign identity or write-only tokens", async () => {
    const calls: string[] = [];
    const reader = {
      read: async (id: string) => {
        calls.push(id);
        return { kingdomId: "own" };
      },
    } as unknown as DecisionSupportReader;
    const identity = { authenticate: async () => ({ accountId: "owner" }) } as unknown as IdentityService;
    const oauth = {
      introspectAccessToken: async (token: string) => ({
        accountId: "agent-owner",
        scopes: token === "read" ? ["world:read"] : ["game:act"],
      }),
    } as unknown as OAuthService;
    const server = Fastify();
    registerDecisionRoutes(server, identity, reader, oauth);
    try {
      expect((await server.inject({ url: "/v1/game/decision-support" })).statusCode).toBe(403);
      expect(
        (
          await server.inject({
            url: "/v1/game/decision-support?accountId=foreign",
            headers: { cookie: "pact_session=own" },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (await server.inject({ url: "/v1/game/decision-support", headers: { cookie: "pact_session=own" } })).statusCode,
      ).toBe(200);
      expect(
        (await server.inject({ url: "/v1/game/decision-support", headers: { authorization: "Bearer write" } }))
          .statusCode,
      ).toBe(403);
      expect(
        (await server.inject({ url: "/v1/game/decision-support", headers: { authorization: "Bearer read" } }))
          .statusCode,
      ).toBe(200);
      expect(calls).toEqual(["owner", "agent-owner"]);
    } finally {
      await server.close();
    }
  });
});
