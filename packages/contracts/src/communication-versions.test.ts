import { describe, expect, it } from "vitest";
import {
  AgentGameActionSchema,
  AgentGameActionV2Schema,
  CommandEnvelopeSchema,
  CommandEnvelopeV2Schema,
  parseAcceptedCommand,
} from "./schemas.js";
import { SocialCommandSchema, SocialCommandV2Schema } from "./social-schemas.js";

const commandId = "11111111-1111-4111-8111-111111111111",
  kingdomId = "22222222-2222-4222-8222-222222222222";
describe("versioned communication commands", () => {
  it("retains v1 bounds while v2 carries full Unicode messages with the exact submitted version", () => {
    const action = { kind: "game.message.send", recipientKingdomId: kingdomId, body: "🦆".repeat(4096) };
    expect(AgentGameActionSchema.safeParse({ commandId, action }).success).toBe(false);
    expect(AgentGameActionV2Schema.safeParse({ commandId, action }).success).toBe(true);
    const raw = {
      commandId,
      action,
      actor: {
        principalId: "server-derived",
        productScope: "pact",
        audience: "human",
        subject: { type: "account", id: "server-derived" },
      },
      submittedAt: "2026-10-10T10:00:00Z",
    };
    expect(CommandEnvelopeSchema.safeParse({ ...raw, schemaVersion: "pact.command.v1" }).success).toBe(false);
    expect(CommandEnvelopeV2Schema.safeParse({ ...raw, schemaVersion: "pact.command.v2" }).success).toBe(true);
    expect(parseAcceptedCommand({ ...raw, schemaVersion: "pact.command.v2" })).toMatchObject({
      schemaVersion: "pact.command.v2",
      commandId,
      action,
    });
  });
  it("puts owner delegation in v2 without widening the invitation v1 schema", () => {
    const action = { kind: "contact.delegation", mode: "agent_decides", allowedKingdomIds: [], expectedVersion: 0 };
    expect(SocialCommandSchema.safeParse({ schemaVersion: "pact.social-command.v1", commandId, action }).success).toBe(
      false,
    );
    expect(
      SocialCommandV2Schema.safeParse({ schemaVersion: "pact.social-command.v2", commandId, action }).success,
    ).toBe(true);
    expect(
      SocialCommandV2Schema.safeParse({
        schemaVersion: "pact.social-command.v2",
        commandId,
        action,
        accountId: kingdomId,
      }).success,
    ).toBe(false);
  });
});
