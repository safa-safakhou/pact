import { IdentityError, type IdentityService } from "@pact/identity";
import type { CouncilReader } from "@pact/kingdom";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerCouncilRoutes } from "./council-routes.js";

function fixture() {
  const server = Fastify(),
    read = vi.fn(async () => ({ world: {} })),
    customize = vi.fn(async () => ({ version: 2 })),
    thread = vi.fn(async () => ({ messages: [] }));
  const identity = {
    authenticate: vi.fn(async (token: string) => {
      if (token !== "owner-session") throw new IdentityError("FORBIDDEN");
      return { accountId: "authenticated-owner" };
    }),
    authorizeCookieWrite: vi.fn(async (token: string, csrf: string, origin: string) => {
      if (token !== "owner-session" || csrf !== "real-csrf" || origin !== "https://pact.example")
        throw new IdentityError("FORBIDDEN");
      return { accountId: "authenticated-owner" };
    }),
  };
  registerCouncilRoutes(
    server,
    identity as unknown as IdentityService,
    { customize, thread } as unknown as CouncilReader,
    read,
  );
  return { server, identity, read, customize, thread };
}
const character = { name: "Aster", seed: "A river traveller", color: "#123456", variation: 2 };
describe("Council human HTTP boundary", () => {
  it("rejects anonymous and bearer-only reads and does not record human presence", async () => {
    const f = fixture();
    try {
      for (const headers of [{}, { authorization: "Bearer an-agent-token" }, { cookie: "pact_session=%xx" }])
        expect((await f.server.inject({ method: "GET", url: "/v1/game/council", headers })).statusCode).toBe(403);
      expect(f.read).not.toHaveBeenCalled();
    } finally {
      await f.server.close();
    }
  });
  it("derives the owner from the cookie and validates thread paging", async () => {
    const f = fixture();
    try {
      expect(
        (
          await f.server.inject({
            method: "GET",
            url: "/v1/game/council?search=River&offset=8",
            headers: { cookie: "pact_session=owner-session" },
          })
        ).statusCode,
      ).toBe(200);
      expect(f.read).toHaveBeenCalledWith("authenticated-owner", { search: "River", offset: 8 }, true);
      expect(
        (
          await f.server.inject({
            method: "GET",
            url: "/v1/game/council/thread?kingdomId=00000000-0000-4000-8000-000000000001&beforeGameTimeMs=1",
            headers: { cookie: "pact_session=owner-session" },
          })
        ).statusCode,
      ).toBe(400);
      expect(f.thread).not.toHaveBeenCalled();
    } finally {
      await f.server.close();
    }
  });
  it("requires the existing human CSRF/origin authorization before cosmetic writes", async () => {
    const f = fixture();
    try {
      for (const origin of ["https://attacker.example", "https://pact.example"]) {
        const response = await f.server.inject({
          method: "PUT",
          url: "/v1/game/council/character",
          headers: { cookie: "pact_session=owner-session", origin, "x-csrf-token": "wrong-csrf" },
          payload: { character, expectedVersion: 1 },
        });
        expect(response.statusCode).toBe(403);
      }
      expect(f.customize).not.toHaveBeenCalled();
      const result = await f.server.inject({
        method: "PUT",
        url: "/v1/game/council/character",
        headers: { cookie: "pact_session=owner-session", origin: "https://pact.example", "x-csrf-token": "real-csrf" },
        payload: { character, expectedVersion: 1 },
      });
      expect(result.statusCode).toBe(200);
      expect(f.customize).toHaveBeenCalledWith("authenticated-owner", character, 1);
    } finally {
      await f.server.close();
    }
  });
  it("rejects ownership fields and malformed visual identity without a write", async () => {
    const f = fixture();
    try {
      const result = await f.server.inject({
        method: "PUT",
        url: "/v1/game/council/character",
        headers: { cookie: "pact_session=owner-session", origin: "https://pact.example", "x-csrf-token": "real-csrf" },
        payload: {
          accountId: "another-player",
          character: { ...character, color: "javascript:bad" },
          expectedVersion: 1,
        },
      });
      expect(result.statusCode).toBe(400);
      expect(f.customize).not.toHaveBeenCalled();
    } finally {
      await f.server.close();
    }
  });
});
