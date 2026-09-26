import type { IdentityService } from "@pact/identity";
import { IdentityError } from "@pact/identity";
import type { SocialOverviewReader } from "@pact/kingdom";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { registerSocialOverviewRoutes } from "./social-overview-routes.js";

describe("owner-only social overview", () => {
  it("requires a human session and derives the kingdom from its account", async () => {
    const accounts: string[] = [];
    const identity = {
      authenticate: async (token: string) => {
        if (token !== "valid") throw new IdentityError("INVALID_TOKEN");
        return { accountId: "owner-account" };
      },
    } as unknown as IdentityService;
    const reader = {
      read: async (accountId: string) => {
        accounts.push(accountId);
        return { kingdomId: "owner-kingdom", contacts: [], messages: [], supplyOffers: [] };
      },
    } as unknown as SocialOverviewReader;
    const server = Fastify();
    registerSocialOverviewRoutes(server, identity, reader);
    try {
      const bearer = await server.inject({
        method: "GET",
        url: "/v1/game/social?accountId=other",
        headers: { authorization: "Bearer valid" },
      });
      expect(bearer.statusCode).toBe(403);
      const invalid = await server.inject({
        method: "GET",
        url: "/v1/game/social",
        headers: { cookie: "pact_session=invalid" },
      });
      expect(invalid.statusCode).toBe(403);
      const owner = await server.inject({
        method: "GET",
        url: "/v1/game/social?accountId=other",
        headers: { cookie: "pact_session=valid" },
      });
      expect(owner.statusCode).toBe(200);
      expect(owner.headers["cache-control"]).toBe("no-store");
      expect(owner.json().kingdomId).toBe("owner-kingdom");
      expect(accounts).toEqual(["owner-account"]);
    } finally {
      await server.close();
    }
  });
});
