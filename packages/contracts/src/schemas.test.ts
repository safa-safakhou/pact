import { describe, expect, it } from "vitest";
import { commandJsonSchema, gameCommandJsonSchema, httpCommandContract, mcpCommandTool } from "./json-schema.js";
import {
  validateCommandForMcp,
  validateCommandForWeb,
  validateProviderGameCommand,
  validateProviderToolCommand,
} from "./schemas.js";

const valid = {
  schemaVersion: "pact.command.v1",
  commandId: "8c6cd695-f341-4f27-a63b-bb37223e2518",
  actor: {
    principalId: "account:fixture",
    productScope: "pact",
    audience: "agent",
    subject: { type: "kingdom", id: "kingdom:fixture" },
  },
  action: { kind: "sandbox.echo", message: "hello" },
  submittedAt: "2026-09-20T00:00:00.000Z",
};

describe("shared command validation", () => {
  it("accepts the same fixture across web, MCP, and provider adapters", () => {
    expect(validateCommandForWeb(valid)).toEqual(valid);
    expect(validateCommandForMcp(valid)).toEqual(valid);
    expect(validateProviderToolCommand(valid)).toEqual(valid);
  });

  it.each([
    ["arbitrary code", { ...valid, action: { kind: "execute.code", code: "rm -rf /" } }],
    ["actor impersonation field", { ...valid, actor: { ...valid.actor, impersonate: "other" } }],
    ["database query", { ...valid, action: { kind: "database.query", sql: "select *" } }],
    ["credential read", { ...valid, action: { kind: "credential.read", provider: "openai" } }],
    ["human account operation", { ...valid, action: { kind: "account.delete" } }],
  ])("rejects %s", (_name, malformed) => {
    expect(() => validateCommandForWeb(malformed)).toThrow();
    expect(() => validateCommandForMcp(malformed)).toThrow();
    expect(() => validateProviderToolCommand(malformed)).toThrow();
  });

  it("derives HTTP and MCP JSON Schema from the same strict command definition", () => {
    expect(httpCommandContract.body).toBe(commandJsonSchema);
    expect(mcpCommandTool.inputSchema).toBe(commandJsonSchema);
    expect(commandJsonSchema).toMatchObject({ type: "object", additionalProperties: false });
    expect(JSON.stringify(commandJsonSchema)).toContain("pact.command.v1");
    expect(JSON.stringify(commandJsonSchema)).not.toContain("execute.code");
  });

  it("limits the PACT run tool to game actions without changing the shared envelope", () => {
    const game = {
      ...valid,
      action: { kind: "game.message.send", recipientKingdomId: valid.commandId, body: "hello" },
    };
    expect(validateProviderGameCommand(game)).toEqual(game);
    expect(() => validateProviderGameCommand(valid)).toThrow();
    expect(() => validateProviderGameCommand({ ...game, model: "attacker" })).toThrow();
    expect(gameCommandJsonSchema).toMatchObject({ type: "object", additionalProperties: false });
    expect(JSON.stringify(gameCommandJsonSchema)).toContain("game.message.send");
    expect(JSON.stringify(gameCommandJsonSchema)).not.toContain("sandbox.echo");
  });
});
