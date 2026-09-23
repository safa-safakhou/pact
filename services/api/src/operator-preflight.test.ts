import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { registerIdentityRoutes } from "./identity-routes.js";
import { OperatorPreflight } from "./operator-preflight.js";
import { registerOperatorRoutes } from "./operator-routes.js";

function validRegister(realRegistrationEnabled = true): unknown {
  const evidence = { checkedAt: "2026-09-23T08:00:00.000Z", reference: "synthetic-test-evidence" };
  return {
    schemaVersion: 1,
    realRegistrationEnabled,
    controller: {
      legalName: "Synthetic Test Controller",
      contactAddress: "Test address, not for production",
      privacyEmail: "privacy@example.test",
      supportEmail: "support@example.test",
      privacyOwner: "Test privacy owner",
      supportOwner: "Test support owner",
    },
    documents: {
      termsVersion: "test-v1",
      termsUrl: "https://example.test/terms",
      privacyVersion: "test-v1",
      privacyUrl: "https://example.test/privacy",
      rightsAndComplaintRoute: "Synthetic test route",
      privacyRequestUrl: "https://example.test/privacy-request",
    },
    processing: {
      purposesAndLawfulBases: ["Synthetic contract test"],
      processors: [
        {
          name: "Synthetic Processor",
          purpose: "Contract testing",
          dataLocation: "Test region",
          agreementReference: "test-agreement",
          transferMechanism: "Not applicable in synthetic tests",
        },
      ],
    },
    disclosures: { telegram: true, deviceSessions: true, modelProviders: true },
    transactionalEmail: { mode: "captured_smtp", from: "PACT Test <noreply@example.test>", deliveryEvidence: evidence },
    operationalEvidence: { staffMfa: evidence, restore: evidence, deletion: evidence },
  };
}

describe("operator preflight", () => {
  it("fails closed and names missing required fields without exposing private register details", () => {
    const preflight = OperatorPreflight.parse({ schemaVersion: 1, realRegistrationEnabled: true });
    expect(preflight.registrationEnabled).toBe(false);
    expect(preflight.publicNotice()).toBeUndefined();
    expect(preflight.report()).toMatchObject({ ready: false, registrationEnabled: false });
    expect(preflight.errors).toContain("controller: Invalid input: expected object, received undefined");
  });

  it("projects public notices without agreement references or operational evidence", () => {
    const notice = OperatorPreflight.parse(validRegister()).publicNotice();
    expect(notice).toMatchObject({
      registrationEnabled: true,
      disclosures: { telegram: true, deviceSessions: true, modelProviders: true },
    });
    expect(JSON.stringify(notice)).not.toContain("test-agreement");
    expect(JSON.stringify(notice)).not.toContain("synthetic-test-evidence");
  });

  it("rejects placeholder operator facts and a terms version that differs from the runtime", () => {
    const register = validRegister() as Record<string, unknown>;
    expect(OperatorPreflight.parse(register, "other-terms").registrationEnabled).toBe(false);
    const controller = register.controller as Record<string, unknown>;
    controller.legalName = "REPLACE WITH ACTUAL NAME";
    expect(OperatorPreflight.parse(register).registrationEnabled).toBe(false);
  });

  it("blocks signup before parsing or invoking the identity service when preflight is unavailable", async () => {
    const server = Fastify({ logger: false });
    const signup = vi.fn();
    registerIdentityRoutes(
      server,
      { signup } as never,
      {} as never,
      OperatorPreflight.unavailable("operator register missing"),
    );

    const response = await server.inject({ method: "POST", url: "/v1/auth/signup", payload: {} });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: { code: "REGISTRATION_UNAVAILABLE", message: "Registration is not currently available." },
    });
    expect(signup).not.toHaveBeenCalled();
    await server.close();
  });

  it("serves only a closed status when the operator register is unavailable", async () => {
    const server = Fastify({ logger: false });
    registerOperatorRoutes(server, OperatorPreflight.unavailable("operator register missing"));
    const status = await server.inject({ method: "GET", url: "/v1/legal/registration-status" });
    const notices = await server.inject({ method: "GET", url: "/v1/legal/notices" });
    expect(status.json()).toEqual({ registrationEnabled: false });
    expect(notices.json()).toEqual({ registrationEnabled: false, noticesConfigured: false });
    await server.close();
  });

  it("allows a valid enabled register to reach signup", async () => {
    const server = Fastify({ logger: false });
    const signup = vi.fn().mockResolvedValue({ accepted: true });
    registerIdentityRoutes(server, { signup } as never, {} as never, OperatorPreflight.parse(validRegister()));
    const response = await server.inject({
      method: "POST",
      url: "/v1/auth/signup",
      payload: {
        email: "player@example.test",
        password: "synthetic-password",
        age18Declared: true,
        acceptedTermsVersion: "test-v1",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(signup).toHaveBeenCalledOnce();
    await server.close();
  });
});
