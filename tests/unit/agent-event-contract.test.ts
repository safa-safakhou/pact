import { describe, expect, it } from "vitest";
import { AgentEventCardSchema, AgentEventQuerySchema } from "../../packages/contracts/src/agent-event-schemas.js";

describe("scoped metadata contract", () => {
  it("defaults to twenty and caps fifty without accepting owner identity", () => {
    expect(AgentEventQuerySchema.parse({}).limit).toBe(20);
    expect(AgentEventQuerySchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(AgentEventQuerySchema.safeParse({ accountId: "foreign" }).success).toBe(false);
  });
  it("rejects private bodies and unbounded metadata", () => {
    expect(AgentEventCardSchema.safeParse({ metadata: { body: "private" } }).success).toBe(false);
  });
});
