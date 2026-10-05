import { IdentityError, type IdentityService } from "@pact/identity";
import type { NotificationService } from "@pact/inbox";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerNotificationRoutes } from "./notification-routes.js";

describe("notification HTTP authorization", () => {
  it("rejects unauthenticated/agent writes and ownership injection before changing preferences", async () => {
    const authorizeCookieWrite = vi.fn().mockResolvedValue({ accountId: "owner" });
    const setPreference = vi.fn().mockResolvedValue({});
    const server = Fastify();
    registerNotificationRoutes(
      server,
      { authorizeCookieWrite } as unknown as IdentityService,
      { setPreference } as unknown as NotificationService,
    );
    const payload = { category: "raid", channel: "email", enabled: true };
    for (const headers of [{}, { authorization: "Bearer agent" }, { cookie: "pact_session=owner" }])
      expect(
        (await server.inject({ method: "POST", url: "/v1/notifications/preferences", headers, payload })).statusCode,
      ).toBe(403);
    expect(setPreference).not.toHaveBeenCalled();
    const headers = { cookie: "pact_session=owner", origin: "https://pact.example", "x-csrf-token": "csrf" };
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/v1/notifications/preferences",
          headers,
          payload: { ...payload, accountId: "other" },
        })
      ).statusCode,
    ).toBe(400);
    expect(setPreference).not.toHaveBeenCalled();
    expect(
      (await server.inject({ method: "POST", url: "/v1/notifications/preferences", headers, payload })).statusCode,
    ).toBe(200);
    expect(setPreference).toHaveBeenCalledWith("owner", "raid", "email", true);
    expect(authorizeCookieWrite).toHaveBeenCalledWith("owner", "csrf", "https://pact.example");
    await server.close();
  });
  it("requires a human cookie for deep-link settings and returns no-store", async () => {
    const authenticate = vi
      .fn()
      .mockRejectedValueOnce(new IdentityError("FORBIDDEN"))
      .mockResolvedValueOnce({ accountId: "owner" });
    const server = Fastify();
    registerNotificationRoutes(
      server,
      { authenticate } as unknown as IdentityService,
      {
        preferences: vi.fn().mockResolvedValue({ subscriptions: [], preferences: [] }),
      } as unknown as NotificationService,
    );
    expect((await server.inject({ url: "/v1/notifications/preferences" })).statusCode).toBe(403);
    expect(
      (await server.inject({ url: "/v1/notifications/preferences", headers: { cookie: "pact_session=expired" } }))
        .statusCode,
    ).toBe(403);
    const response = await server.inject({
      url: "/v1/notifications/preferences",
      headers: { cookie: "pact_session=current" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    await server.close();
  });
});
