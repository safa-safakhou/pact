import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AgentEventCardSchema, AgentEventQuerySchema } from "../../packages/contracts/src/agent-event-schemas.js";

describe("scoped metadata contract", () => {
  it("defaults to twenty and caps fifty without accepting owner identity", () => {
    expect(AgentEventQuerySchema.parse({}).limit).toBe(20);
    expect(AgentEventQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(AgentEventQuerySchema.safeParse({ accountId: "foreign" }).success).toBe(false);
  });
  it("rejects private bodies and unbounded metadata on an otherwise valid card", () => {
    const card = {
      sequence: "1",
      eventId: randomUUID(),
      type: "message.sent.v1",
      sourceRef: "outbox:" + randomUUID(),
      occurredAt: "2026-10-17T12:00:00.000Z",
      publishedAt: "2026-10-17T12:01:00.000Z",
      gameTime: "60000",
      metadata: { category: "conversation", groupRef: "conversation:fixture", recordRef: "message:fixture" },
    };
    expect(AgentEventCardSchema.safeParse(card).success).toBe(true);
    expect(AgentEventCardSchema.safeParse({ ...card, metadata: { ...card.metadata, body: "private" } }).success).toBe(
      false,
    );
    expect(
      AgentEventCardSchema.safeParse({ ...card, metadata: { ...card.metadata, recordRef: "x".repeat(201) } }).success,
    ).toBe(false);
  });
});
