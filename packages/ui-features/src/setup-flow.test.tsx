import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SetupFlow } from "./SetupFlow.js";

describe("SetupFlow", () => {
  it("renders account headings, typed buttons, and phone-friendly touch targets", () => {
    const html = renderToStaticMarkup(
      createElement(SetupFlow, {
        step: "account",
        invitation: { invite: "inv-1", destination: "court:alpha" },
        serverHydrated: true,
      }),
    );
    expect(html).toContain("Account and security");
    expect(html).toContain("Invitation preserved");
    expect(html).toContain("invite inv-1");
    expect(html).toContain("destination court:alpha");
    expect(html).toContain('type="submit"');
    expect(html).toContain("pact-touch-target");
    expect(html).toContain("server-hydrated");
    expect(html).toContain("does not found a live kingdom");
  });

  it("renders expired, revoked, and unsupported-host messages", () => {
    const expired = renderToStaticMarkup(
      createElement(SetupFlow, { step: "inbox", errorCode: "EXPIRED", approvals: [] }),
    );
    expect(expired).toMatch(/expired/i);

    const revoked = renderToStaticMarkup(createElement(SetupFlow, { step: "credentials", errorCode: "REVOKED" }));
    expect(revoked).toMatch(/revoked/i);

    const unsupported = renderToStaticMarkup(
      createElement(SetupFlow, { step: "provider", errorCode: "UNSUPPORTED_HOST" }),
    );
    expect(unsupported).toMatch(/not supported/i);
  });

  it("shows run labels, unknown pricing, external-host and connector copy", () => {
    const allowance = renderToStaticMarkup(
      createElement(SetupFlow, {
        step: "allowance",
        pricingAvailable: false,
        allowanceTokens: 4000,
      }),
    );
    expect(allowance).toContain("Confirm run allowance");
    expect(allowance).toContain("Provider price unavailable");

    const run = renderToStaticMarkup(
      createElement(SetupFlow, {
        step: "run",
        runStatus: "running",
        externalHostMessage: "External-host usage is billed by the connector.",
        connectorPrerequisiteMessage: "Complete connector prerequisites before connecting.",
      }),
    );
    expect(run).toContain("Working");
    expect(run).toContain("External-host usage is billed by the connector.");
    expect(run).toContain("Complete connector prerequisites before connecting.");
    expect(run).toContain('type="button"');
  });

  it("renders draft, provider, model, and inbox step labels", () => {
    expect(renderToStaticMarkup(createElement(SetupFlow, { step: "draft" }))).toContain("Private kingdom draft");
    expect(
      renderToStaticMarkup(
        createElement(SetupFlow, {
          step: "provider",
          providers: [{ id: "openai", label: "OpenAI" }],
          selectedProviderId: "openai",
        }),
      ),
    ).toContain("Choose a model provider");
    expect(
      renderToStaticMarkup(
        createElement(SetupFlow, {
          step: "model",
          models: [{ id: "gpt", label: "GPT test" }],
          selectedModelId: "gpt",
        }),
      ),
    ).toContain("Choose a model");
    expect(renderToStaticMarkup(createElement(SetupFlow, { step: "inbox", approvals: [] }))).toContain(
      "Approval inbox",
    );
  });
});
