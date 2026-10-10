import { randomUUID } from "node:crypto";
import { IdentityError, type IdentityService } from "@pact/identity";
import { CollectionError, type CollectionStoriesService } from "@pact/kingdom";
import Fastify from "fastify";
import { expect, it } from "vitest";
import { registerCollectionRoutes } from "./collection-routes.js";

it("keeps collection reads/writes human scoped and requires origin/CSRF for exact commands", async () => {
  const calls: unknown[] = [];
  let stale = false;
  const app = Fastify();
  const identity = {
    authenticate: async () => ({ accountId: "owner" }),
    authorizeCookieWrite: async (_token: string, csrf: string, origin: string) => {
      if (csrf !== "valid" || origin !== "https://pact.test") throw new IdentityError("FORBIDDEN");
      return { accountId: "owner" };
    },
  } as unknown as IdentityService;
  const collections = {
    read: async (id: string) => {
      calls.push(id);
      return { pieces: [] };
    },
    command: async (id: string) => {
      if (stale) throw new CollectionError("STALE_VERSION");
      calls.push(id);
      return { code: "COMMITTED" };
    },
    publicCard: async () => null,
  } as unknown as CollectionStoriesService;
  registerCollectionRoutes(app, identity, collections);
  try {
    for (const headers of [
      {},
      { authorization: "Bearer agent" },
      { cookie: "pact_session=mine", authorization: "Bearer agent" },
    ])
      expect((await app.inject({ url: "/v1/collections", headers })).statusCode).toBe(403);
    expect(
      (await app.inject({ url: "/v1/collections?accountId=foreign", headers: { cookie: "pact_session=mine" } }))
        .statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ url: "/v1/collections", headers: { cookie: "pact_session=mine" } })).headers["cache-control"],
    ).toBe("no-store");
    const payload = {
      schemaVersion: "pact.collection-command.v2",
      kind: "story",
      commandId: randomUUID(),
      storyId: randomUUID(),
      expectedVersion: 0,
      title: "Private",
      annotation: "Interpretation",
      incidentIds: [],
      deleted: false,
    };
    expect(
      (
        await app.inject({
          url: "/v1/collections",
          method: "POST",
          headers: { cookie: "pact_session=mine", origin: "https://evil.test", "x-csrf-token": "valid" },
          payload,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          url: "/v1/collections",
          method: "POST",
          headers: { cookie: "pact_session=mine", origin: "https://pact.test", "x-csrf-token": "valid" },
          payload,
        })
      ).statusCode,
    ).toBe(200);
    expect((await app.inject({ url: "/v1/collections/public/someone" })).statusCode).toBe(404);
    expect(calls).toEqual(["owner", "owner"]);
    stale = true;
    const conflict = await app.inject({
      url: "/v1/collections",
      method: "POST",
      headers: { cookie: "pact_session=mine", origin: "https://pact.test", "x-csrf-token": "valid" },
      payload,
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe("STALE_VERSION");
  } finally {
    await app.close();
  }
});
