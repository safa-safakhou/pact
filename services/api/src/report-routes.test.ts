import type { IdentityService } from "@pact/identity";
import type { OAuthService } from "@pact/oauth";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type { GameReportReader } from "./game-report-reader.js";
import { registerReportRoutes } from "./report-routes.js";

const recordId = "00000000-0000-4000-8000-000000000001";

describe("authorized report routes", () => {
  it("derives the viewer from credentials, validates IDs, and hides unavailable reports", async () => {
    const calls: unknown[][] = [];
    const identity = {
      authenticate: async () => ({ accountId: "human-account" }),
    } as unknown as IdentityService;
    const oauth = {
      introspectAccessToken: async (token: string) =>
        token === "reader"
          ? { accountId: "agent-account", scopes: ["world:read"] }
          : token === "writer"
            ? { accountId: "agent-account", scopes: ["game:act"] }
            : null,
    } as unknown as OAuthService;
    const reports = {
      read: async (...args: unknown[]) => {
        calls.push(args);
        return args[0] === "agent-account" ? { kind: "scout", owner: "agent-account" } : null;
      },
    } as unknown as GameReportReader;
    const server = Fastify();
    registerReportRoutes(server, identity, reports, oauth);
    try {
      const reader = await server.inject({
        method: "GET",
        url: `/v1/reports/scout/${recordId}?accountId=forged`,
        headers: { authorization: "Bearer reader" },
      });
      expect(reader.statusCode).toBe(200);
      expect(reader.json()).toEqual({ kind: "scout", owner: "agent-account" });
      expect(calls).toEqual([["agent-account", "scout", recordId]]);
      expect(
        (
          await server.inject({
            method: "GET",
            url: `/v1/reports/scout/${recordId}`,
            headers: { cookie: "pact_session=valid" },
          })
        ).statusCode,
      ).toBe(404);
      expect(
        (
          await server.inject({
            method: "GET",
            url: `/v1/reports/scout/${recordId}`,
            headers: { authorization: "Bearer writer" },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await server.inject({
            method: "GET",
            url: "/v1/reports/scout/not-a-uuid",
            headers: { authorization: "Bearer reader" },
          })
        ).statusCode,
      ).toBe(400);
      expect(calls).toHaveLength(2);
    } finally {
      await server.close();
    }
  });
});
