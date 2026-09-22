import type { IdentityService } from "@pact/identity";
import type { PrivacyService } from "@pact/privacy";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerPrivacyRoutes } from "./privacy-routes.js";

describe("privacy HTTP boundary", () => {
  it("requires cookie, CSRF, origin, and password reauthentication before issuing an export", async () => {
    const authorizeCookieWrite = vi.fn().mockResolvedValue({ accountId: "account-1" });
    const reauthenticate = vi.fn().mockResolvedValue({
      accountId: "account-1",
      sessionToken: "rotated-session",
      csrfToken: "rotated-csrf",
      idleExpiresAt: new Date("2026-09-23T00:00:00.000Z"),
      absoluteExpiresAt: new Date("2026-10-22T00:00:00.000Z"),
    });
    const requireRecentHumanSession = vi.fn().mockResolvedValue({ accountId: "account-1" });
    const requestExport = vi.fn().mockResolvedValue({
      exportId: "export-1",
      downloadToken: "a".repeat(43),
      expiresAt: new Date("2026-09-29T00:00:00.000Z"),
    });
    const identity = { authorizeCookieWrite, reauthenticate, requireRecentHumanSession } as unknown as IdentityService;
    const privacy = { requestExport } as unknown as PrivacyService;
    const server = Fastify();
    registerPrivacyRoutes(server, identity, privacy);

    const response = await server.inject({
      method: "POST",
      url: "/v1/privacy/exports",
      headers: {
        cookie: "pact_session=original-session",
        origin: "https://pact.example",
        "x-csrf-token": "original-csrf",
      },
      payload: { password: "current password" },
    });

    expect(response.statusCode).toBe(200);
    expect(authorizeCookieWrite).toHaveBeenCalledWith("original-session", "original-csrf", "https://pact.example");
    expect(reauthenticate).toHaveBeenCalledWith(
      expect.objectContaining({ sessionToken: "original-session", password: "current password" }),
    );
    expect(requireRecentHumanSession).toHaveBeenCalledWith("rotated-session", "account.export");
    expect(requestExport).toHaveBeenCalledWith("account-1");
    expect(response.headers["set-cookie"]).toContain("pact_session=rotated-session");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.json()).toMatchObject({
      downloadUrl: `/v1/privacy/exports/${"a".repeat(43)}`,
      csrfToken: "rotated-csrf",
    });
    await server.close();
  });

  it("binds an export download to the authenticated account", async () => {
    const authenticate = vi.fn().mockResolvedValue({ accountId: "account-1" });
    const downloadExport = vi.fn().mockResolvedValue({
      format: "pact-account-export-v1",
      generatedAt: "2026-09-22T00:00:00.000Z",
      index: "PACT account export",
      data: { account: { id: "account-1" } },
    });
    const identity = { authenticate } as unknown as IdentityService;
    const privacy = { downloadExport } as unknown as PrivacyService;
    const server = Fastify();
    registerPrivacyRoutes(server, identity, privacy);

    const token = "b".repeat(43);
    const response = await server.inject({
      method: "GET",
      url: `/v1/privacy/exports/${token}`,
      headers: { cookie: "pact_session=owned-session" },
    });

    expect(response.statusCode).toBe(200);
    expect(authenticate).toHaveBeenCalledWith("owned-session");
    expect(downloadExport).toHaveBeenCalledWith("account-1", token);
    expect(response.headers["content-disposition"]).toContain("pact-account-export-2026-09-22.json");
    expect(response.headers["cache-control"]).toBe("no-store");
    await server.close();
  });
});
