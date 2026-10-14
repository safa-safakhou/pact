import { type AdminProvisioning, IdentityError, type IdentityService } from "@pact/identity";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import type { AdminReader } from "./admin-reader.js";
import { registerAdminRoutes } from "./admin-routes.js";

function fixture() {
  const identity = {
    requireStaffSession: vi.fn(async () => ({ accountId: "admin" })),
    recordStaffObservation: vi.fn(async () => {}),
    assertBrowserOrigin: vi.fn((origin: string) => {
      if (origin !== "https://pact.example") throw new IdentityError("FORBIDDEN");
    }),
  };
  const reader = {
    overview: vi.fn(async () => ({ safe: "aggregate" })),
    kingdoms: vi.fn(async () => ({ players: [] })),
  };
  const provision = {
    available: vi.fn(async () => true),
    begin: vi.fn(() => ({ secret: "fixture" })),
    complete: vi.fn(async () => ({ created: true })),
  };
  const server = Fastify();
  let now = new Date("2026-10-14T12:00:00Z");
  registerAdminRoutes(
    server,
    identity as unknown as IdentityService,
    reader as unknown as AdminReader,
    provision as unknown as AdminProvisioning,
    { token: "x".repeat(43), expiresAt: "2026-10-15T12:00:00Z" },
    () => now,
  );
  return {
    server,
    identity,
    reader,
    provision,
    setNow: (value: Date) => {
      now = value;
    },
  };
}
describe("administrator HTTP boundary", () => {
  it("blocks absent, malformed, agent and non-staff sessions before observation; bounds every query and disables caching", async () => {
    const f = fixture();
    for (const headers of [{}, { authorization: "Bearer agent" }, { cookie: "pact_session=%ZZ" }]) {
      const r = await f.server.inject({ url: "/v1/admin/overview", headers });
      expect(r.statusCode).toBe(403);
      expect(r.headers["cache-control"]).toBe("no-store");
    }
    expect(f.reader.overview).not.toHaveBeenCalled();
    const headers = { cookie: "pact_session=staff" };
    f.identity.requireStaffSession.mockRejectedValueOnce(new IdentityError("FORBIDDEN"));
    expect((await f.server.inject({ url: "/v1/admin/overview", headers })).statusCode).toBe(403);
    for (const query of ["hours=0", "hours=169", "hours=NaN", "accountId=other"])
      expect((await f.server.inject({ url: `/v1/admin/overview?${query}`, headers })).statusCode).toBe(400);
    for (const query of ["offset=-1", "offset=100001", "search=" + "a".repeat(101)])
      expect((await f.server.inject({ url: `/v1/admin/kingdoms?${query}`, headers })).statusCode).toBe(400);
    expect((await f.server.inject({ url: "/v1/admin/overview?hours=72", headers })).statusCode).toBe(200);
    expect(f.reader.overview).toHaveBeenCalledWith(72);
    expect(f.identity.recordStaffObservation).toHaveBeenCalled();
    await f.server.close();
  });
  it("requires canonical-origin host setup code, rejects replay/expiry and limits authentication attempts", async () => {
    const f = fixture(),
      payload = { setupCode: "x".repeat(43) },
      headers = { origin: "https://pact.example" };
    for (const origin of [undefined, "https://attacker.example"])
      expect(
        (
          await f.server.inject({
            method: "POST",
            url: "/v1/admin/setup/begin",
            headers: origin ? { origin } : {},
            payload,
          })
        ).statusCode,
      ).toBe(403);
    expect(
      (
        await f.server.inject({
          method: "POST",
          url: "/v1/admin/setup/begin",
          headers,
          payload: { setupCode: "y".repeat(43) },
        })
      ).statusCode,
    ).toBe(403);
    expect(f.provision.begin).not.toHaveBeenCalled();
    expect((await f.server.inject({ method: "POST", url: "/v1/admin/setup/begin", headers, payload })).statusCode).toBe(
      200,
    );
    f.provision.available.mockResolvedValue(false);
    expect((await f.server.inject({ method: "POST", url: "/v1/admin/setup/begin", headers, payload })).statusCode).toBe(
      403,
    );
    f.setNow(new Date("2026-10-15T12:00:00Z"));
    expect((await f.server.inject({ method: "POST", url: "/v1/admin/setup/begin", headers, payload })).statusCode).toBe(
      403,
    );
    for (let i = 0; i < 12; i++)
      await f.server.inject({ method: "POST", url: "/v1/admin/login", headers, payload: {} });
    expect((await f.server.inject({ method: "POST", url: "/v1/admin/login", headers, payload: {} })).statusCode).toBe(
      429,
    );
    await f.server.close();
  });
});
