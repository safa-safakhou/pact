import { ProductScopeSchema } from "@pact/contracts";
import { expect, it, vi } from "vitest";
import { AgentOperationError, AgentOperationService } from "./agent-operations.js";

const principal = {
  accountId: "a7a3b2a7-1a20-4b91-8c2c-1bac6ab01405",
  principalId: "fixture",
  productScope: ProductScopeSchema.parse("pact"),
  audience: "agent" as const,
  agentScopes: ["world:read", "game:act"] as const,
};
const dispatch = vi.fn();
const operations = new AgentOperationService({
  productScope: ProductScopeSchema.parse("pact"),
  origin: "https://fixture.example",
  clock: { now: () => new Date(1000) },
  dispatcher: { dispatch, lookupReceipt: vi.fn() } as never,
  worldViews: { read: vi.fn() },
  conversations: { read: vi.fn() },
});
it("scopes the authenticated operation catalog without implying state admission", () => {
  const reads = operations.listOperations({ ...principal, agentScopes: ["world:read"] });
  expect(reads.some((t) => t.name === "pact_game_action_v2")).toBe(false);
  expect(reads.find((t) => t.name === "pact_world_read_v1")?._meta["pact/operation"]).toMatchObject({
    requiredScopes: ["world:read"],
    readOnly: true,
  });
  expect(() => operations.listOperations({ ...principal, productScope: ProductScopeSchema.parse("other") })).toThrow(
    "FORBIDDEN",
  );
});
it("reports missing body and extra action fields precisely before dispatch", async () => {
  for (const action of [
    { kind: "game.message.send", recipientKingdomId: principal.accountId },
    { kind: "game.building.queue", slot: 1, building: "farm", targetLevel: 2, summary: "extra" },
  ]) {
    try {
      await operations.execute(principal, {
        name: "pact_game_action_v2",
        arguments: { commandId: principal.accountId, action },
      });
      throw Error("not rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(AgentOperationError);
      expect((error as AgentOperationError).detail?.schemaId).toBe("pact_game_action_v2");
    }
  }
  expect(dispatch).not.toHaveBeenCalled();
});

it("rejects unknown operations and action kinds without dispatch or private input values", async () => {
  for (const params of [
    { name: "pact_conversation_read_v2", arguments: {} },
    {
      name: "pact_game_action_v2",
      arguments: {
        commandId: principal.accountId,
        action: { kind: "building.queue", slot: 1, building: "farm", targetLevel: 2 },
      },
    },
  ]) {
    await expect(operations.execute(principal, params)).rejects.toMatchObject({
      code: "INVALID_REQUEST",
      detail: { schemaId: params.name },
    });
  }
  await expect(
    operations.execute(
      { ...principal, productScope: ProductScopeSchema.parse("other") },
      { name: "pact_receipt_read_v1", arguments: {} },
    ),
  ).rejects.toThrow("FORBIDDEN");
  expect(dispatch).not.toHaveBeenCalled();
});
