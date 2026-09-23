import {
  API_VERSION,
  type CapabilityDocument,
  ClientAudienceSchema,
  type ClientCapability,
  ClientCompatibilityDocumentSchema,
  EVENT_SCHEMA_VERSION,
  SCHEMA_VERSION,
} from "@pact/contracts";
import { MCP_PROTOCOL_COMPAT, MCP_PROTOCOL_PRIMARY } from "@pact/mcp";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const sharedCapabilities: ClientCapability[] = [
  "command.submit",
  "receipt.read",
  "inbox.read",
  "inbox.subscribe",
  "approval.status",
];

export const additionalClientCompatibility = ClientCompatibilityDocumentSchema.parse({
  generatedAt: "2026-09-23T08:49:00.000Z",
  entries: [
    {
      clientId: "gemini-cli",
      clientLabel: "Gemini CLI",
      certificationStatus: "not_tested",
      modelApiSupport: true,
      consumerAppInstallation: "not_applicable",
      authentication:
        "PACT OAuth with an MCP-audience scoped game credential; Google subscription login is not a PACT credential",
      billing: "Gemini client/API eligibility and billing remain with the tester's Google account",
      capabilities: [],
      readableSurfaces: [],
      writableSurfaces: [],
      testedClientVersion: null,
      testedAt: null,
      evidence: ["PACT Gemini generateContent adapter recorded fixture"],
      limitation:
        "Gemini CLI binary and eligible live test credentials are not present; no host certification is claimed",
    },
    {
      clientId: "grok-external-tool-client",
      clientLabel: "Grok-powered external tool client",
      certificationStatus: "fixture_only",
      modelApiSupport: true,
      consumerAppInstallation: "not_verified",
      authentication:
        "Tester-supplied xAI API credential for the model route and a separate PACT OAuth game credential",
      billing: "xAI API usage is billed by xAI; a consumer Grok subscription is not treated as API eligibility",
      capabilities: ["read", "write"],
      readableSurfaces: ["recorded provider tool-call fixture"],
      writableSurfaces: ["recorded sandbox command fixture"],
      testedClientVersion: "recorded-fixture-v1",
      testedAt: "2026-09-20T00:00:00.000Z",
      evidence: ["packages/model-provider/src/provider-adapters.test.ts"],
      limitation:
        "No eligible live xAI client/key is present; consumer Grok MCP installation and OAuth/approval/revoke are not certified",
    },
  ],
});

export function registerCapabilityRoutes(server: FastifyInstance): void {
  server.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/v1/")) return;
    const requested = request.headers["x-pact-api-version"];
    reply.header("x-pact-api-version", API_VERSION);
    if (typeof requested === "string" && requested !== API_VERSION) {
      return reply.code(426).send({
        error: {
          code: "UNSUPPORTED_API_VERSION",
          requested,
          supported: [API_VERSION],
        },
      });
    }
  });

  server.get("/v1/capabilities", async (request, reply) => {
    const query = z.object({ audience: ClientAudienceSchema.default("human") }).parse(request.query);
    const capabilities: ClientCapability[] =
      query.audience === "human" ? [...sharedCapabilities, "approval.commit"] : [...sharedCapabilities, "mcp.tools"];
    const document: CapabilityDocument = {
      apiVersion: API_VERSION,
      commandSchemaVersion: SCHEMA_VERSION,
      eventSchemaVersion: EVENT_SCHEMA_VERSION,
      audience: query.audience,
      capabilities,
      allowedScopes: query.audience === "agent" ? ["world:read", "messages:write", "game:act"] : [],
      mcpProtocolVersions: [MCP_PROTOCOL_PRIMARY, MCP_PROTOCOL_COMPAT],
    };
    reply.header("cache-control", "public, max-age=300");
    return document;
  });

  server.get("/v1/client-compatibility", async (_request, reply) => {
    reply.header("cache-control", "public, max-age=300");
    return additionalClientCompatibility;
  });
}
