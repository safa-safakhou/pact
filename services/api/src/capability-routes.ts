import {
  API_VERSION,
  type CapabilityDocument,
  ClientAudienceSchema,
  type ClientCapability,
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
}
