import { IdentityError, type IdentityService } from "@pact/identity";
import type { ModerationService } from "@pact/kingdom";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerModerationRoutes } from "./moderation-routes.js";

describe("moderation HTTP boundary", () => {
  it("derives reporter from human cookie/CSRF and rejects ownership injection, agent credentials and asset actions", async () => {
    const report = vi.fn(async () => ({ caseId: "fixture" })),
      action = vi.fn(),
      server = Fastify(),
      identity = {
        authenticate: vi.fn(async () => ({ accountId: "owner" })),
        authorizeCookieWrite: vi.fn(async () => ({ accountId: "owner" })),
        requireStaffSession: vi.fn(async () => ({ accountId: "staff", sessionId: "staff-session" })),
      };
    registerModerationRoutes(
      server,
      identity as unknown as IdentityService,
      { report, action } as unknown as ModerationService,
      new Set(["https://pact.example"]),
    );
    const payload = {
      reportKey: "00000000-0000-4000-8000-000000000001",
      kind: "profile",
      targetId: "00000000-0000-4000-8000-000000000002",
      category: "doxxing",
      details: "Fixture",
    };
    for (const headers of [{}, { authorization: "Bearer agent" }, { cookie: "pact_session=human" }])
      expect(
        (await server.inject({ method: "POST", url: "/v1/moderation/reports", headers, payload })).statusCode,
      ).toBe(403);
    const headers = { cookie: "pact_session=human", origin: "https://pact.example", "x-csrf-token": "csrf" };
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/v1/moderation/reports",
          headers,
          payload: { ...payload, accountId: "other" },
        })
      ).statusCode,
    ).toBe(400);
    expect((await server.inject({ method: "POST", url: "/v1/moderation/reports", headers, payload })).statusCode).toBe(
      200,
    );
    expect(report).toHaveBeenCalledWith("owner", payload);
    expect(
      (
        await server.inject({
          method: "POST",
          url: "/v1/moderation/cases/" + payload.targetId + "/actions",
          headers,
          payload: { action: "transfer", reason: "abuse", kingdomId: payload.targetId, amount: 99 },
        })
      ).statusCode,
    ).toBe(400);
    expect(action).not.toHaveBeenCalled();
    identity.requireStaffSession.mockRejectedValueOnce(new IdentityError("FORBIDDEN"));
    expect((await server.inject({ url: "/v1/moderation/queue", headers })).statusCode).toBe(403);
    await server.close();
  });
  it("accepts only canonical-origin limited appeals without issuing a session or game authorization", async () => {
    const appealByToken = vi.fn(async () => ({ submitted: true })),
      server = Fastify();
    registerModerationRoutes(
      server,
      {} as IdentityService,
      { appealByToken } as unknown as ModerationService,
      new Set(["https://pact.example"]),
    );
    const payload = { token: "x".repeat(43), reason: "Synthetic appeal" };
    for (const headers of [{}, { origin: "https://attacker.example" }])
      expect((await server.inject({ method: "POST", url: "/v1/moderation/appeal", headers, payload })).statusCode).toBe(
        403,
      );
    const result = await server.inject({
      method: "POST",
      url: "/v1/moderation/appeal",
      headers: { origin: "https://pact.example" },
      payload,
    });
    expect(result.statusCode).toBe(200);
    expect(result.headers["set-cookie"]).toBeUndefined();
    expect(result.headers["cache-control"]).toBe("no-store");
    await server.close();
  });
});
