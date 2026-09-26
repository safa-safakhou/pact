import { pactRunCommandTool } from "@pact/application";
import {
  commandJsonSchema,
  GameActionSchema,
  gameCommandJsonSchema,
  httpCommandContract,
  mcpCommandTool,
} from "@pact/contracts";
import { describe, expect, it } from "vitest";

const publishedGameActions = [
  "game.contact.request",
  "game.contact.answer",
  "game.message.send",
  "game.transfer",
  "game.training.queue",
  "game.training.cancel",
  "game.troop.disband",
  "game.building.queue",
  "game.building.cancel",
  "game.supply.offer",
  "game.supply.counter",
  "game.supply.sign",
  "game.supply.withdraw",
  "game.supply.notice",
  "game.supply.refuse",
  "game.supply.release",
  "game.scout.start",
  "game.scout.share",
  "game.garrison.offer",
  "game.garrison.sign",
  "game.garrison.withdraw",
  "game.garrison.seize",
  "game.garrison.exit",
  "game.garrison.release",
  "game.raid.declare",
  "game.raid.nominate",
  "game.raid.accept",
  "game.raid.withdraw",
];

function gameKinds(schema: unknown): string[] {
  const found = new Set<string>();
  const visit = (value: unknown): void => {
    if (typeof value !== "object" || value === null) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    for (const [key, nested] of Object.entries(value)) {
      if (key === "const" && typeof nested === "string" && nested.startsWith("game.")) found.add(nested);
      else visit(nested);
    }
  };
  visit(schema);
  return [...found].sort();
}

describe("published game command contracts", () => {
  it("keeps every typed game group in web, MCP, and model schemas", () => {
    const expected = [...publishedGameActions].sort();
    expect(GameActionSchema.options.map((option) => option.shape.kind.value).sort()).toEqual(expected);
    expect(gameKinds(httpCommandContract.body)).toEqual(expected);
    expect(gameKinds(mcpCommandTool.inputSchema)).toEqual(expected);
    expect(gameKinds(pactRunCommandTool.inputSchema)).toEqual(expected);
    expect(httpCommandContract.body).toBe(commandJsonSchema);
    expect(mcpCommandTool.inputSchema).toBe(commandJsonSchema);
    expect(pactRunCommandTool.inputSchema).toBe(gameCommandJsonSchema);
    expect(JSON.stringify(gameCommandJsonSchema)).not.toContain("sandbox.echo");
  });
});
