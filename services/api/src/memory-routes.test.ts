import { randomUUID } from "node:crypto";
import { IdentityError, type IdentityService } from "@pact/identity";
import type { PrivateMemoryService } from "@pact/kingdom";
import type { OAuthService } from "@pact/oauth";
import Fastify from "fastify";
import { expect, it } from "vitest";
import { registerMemoryRoutes } from "./memory-routes.js";

it("derives private memory ownership, separates read grants and verifies human CSRF", async () => {
  const calls: unknown[] = [];
  const memory = {
    read: async (id: string) => {
      calls.push(id);
      return { entries: [] };
    },
    source: async () => null,
    write: async (id: string, author: string) => {
      calls.push([id, author]);
      return { code: "COMMITTED" };
    },
  } as unknown as PrivateMemoryService;
  const identity = {
    authenticate: async () => ({ accountId: "owner" }),
    authorizeCookieWrite: async (_token: string, csrf: string, origin: string) => {
      if (csrf !== "valid" || origin !== "https://pact.test") throw new IdentityError("FORBIDDEN");
      return { accountId: "owner" };
    },
  } as unknown as IdentityService;
  const oauth = {
    introspectAccessToken: async (token: string) => ({
      accountId: "agent",
      scopes: token === "read" ? ["world:read"] : ["game:act"],
    }),
  } as unknown as OAuthService;
  const app = Fastify();
  registerMemoryRoutes(app, identity, memory, oauth);
  try {
    expect((await app.inject({ url: "/v1/game/private-memory" })).statusCode).toBe(403);
    expect(
      (await app.inject({ url: "/v1/game/private-memory?accountId=foreign", headers: { cookie: "pact_session=mine" } }))
        .statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ url: "/v1/game/private-memory", headers: { authorization: "Bearer write" } })).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ url: "/v1/game/private-memory", headers: { authorization: "Bearer read" } })).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ url: "/v1/game/private-memory", headers: { cookie: "pact_session=mine" } })).headers[
        "cache-control"
      ],
    ).toBe("no-store");
    const payload = {
      schemaVersion: "pact.memory-command.v2",
      commandId: randomUUID(),
      entryId: randomUUID(),
      expectedVersion: 0,
      kind: "strategy",
      topic: "next",
      text: "My private strategy",
      sources: [],
    };
    expect(
      (
        await app.inject({
          url: "/v1/game/private-memory",
          method: "POST",
          headers: { cookie: "pact_session=mine", origin: "https://pact.test", "x-csrf-token": "invalid" },
          payload,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          url: "/v1/game/private-memory",
          method: "POST",
          headers: { cookie: "pact_session=mine", origin: "https://pact.test", "x-csrf-token": "valid" },
          payload,
        })
      ).statusCode,
    ).toBe(200);
    expect(calls).toEqual(["agent", "owner", ["owner", "human"]]);
  } finally {
    await app.close();
  }
});
