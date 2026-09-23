import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { additionalClientCompatibility, registerCapabilityRoutes } from "./capability-routes.js";

describe("additional client compatibility registry", () => {
  it("keeps model support separate from unverified client certification", () => {
    const gemini = additionalClientCompatibility.entries.find((entry) => entry.clientId === "gemini-cli");
    const grok = additionalClientCompatibility.entries.find((entry) => entry.clientId === "grok-external-tool-client");
    expect(gemini).toMatchObject({ modelApiSupport: true, certificationStatus: "not_tested", capabilities: [] });
    expect(grok).toMatchObject({
      modelApiSupport: true,
      certificationStatus: "fixture_only",
      consumerAppInstallation: "not_verified",
    });
    expect(grok?.capabilities).not.toContain("oauth");
    expect(grok?.capabilities).not.toContain("approval");
    expect(grok?.capabilities).not.toContain("revoke");
  });

  it("publishes the truthful matrix as a cacheable public document", async () => {
    const server = Fastify({ logger: false });
    registerCapabilityRoutes(server);
    const response = await server.inject({ method: "GET", url: "/v1/client-compatibility" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=300");
    expect(response.json()).toEqual(additionalClientCompatibility);
    await server.close();
  });
});
