import { PactClient, PactClientError } from "@pact/client-sdk";
import { describe, expect, it } from "vitest";
import { ConversationOutbox, definiteMessageRefusal } from "./conversation-outbox.js";

describe("private exact-message recovery", () => {
  it("distinguishes a certain refusal from unknown delivery and retryable admission", () => {
    expect(definiteMessageRefusal(new PactClientError("FORBIDDEN", 403, "BLOCKED"))).toBe(true);
    for (const error of [
      new Error("network"),
      new PactClientError("SERVER_ERROR", 500),
      new PactClientError("RATE_LIMITED", 429),
      new PactClientError("CONFLICT", 409, "IDEMPOTENCY_CONFLICT"),
    ])
      expect(definiteMessageRefusal(error)).toBe(false);
  });
  it("restores the original payload/version/ID after reload and isolates owners until confirmed", () => {
    const values = new Map<string, string>(),
      storage = {
        getItem: (k: string) => values.get(k) ?? null,
        setItem: (k: string, v: string) => {
          values.set(k, v);
        },
        removeItem: (k: string) => {
          values.delete(k);
        },
      };
    const client = new PactClient({
      audience: "human",
      transport: { send: async () => ({ status: 500, body: {} }) },
      commandIds: { create: () => crypto.randomUUID() },
      clock: { now: () => new Date("2026-10-10T10:00:00Z") },
    });
    const command = client.prepareCommand({
      kind: "game.message.send",
      recipientKingdomId: crypto.randomUUID(),
      body: "🦆".repeat(4096),
    });
    new ConversationOutbox(storage).save("owner", command);
    const restored = new ConversationOutbox(storage);
    expect(restored.restore("different-owner")).toBeNull();
    expect(restored.restore("owner")).toEqual(command);
    expect(restored.restore("owner")).toEqual(command); // merely checking never consumes the intent
    restored.confirmed("owner");
    expect(restored.restore("owner")).toBeNull();
  });
  it("fails closed on invalid tab state and preserves storage when persistence fails", () => {
    const outbox = new ConversationOutbox({
      getItem: () => "{invalid",
      setItem: () => {
        throw Error("quota");
      },
      removeItem: () => {},
    });
    expect(outbox.restore("owner")).toBeNull();
    expect(() =>
      outbox.save("owner", { action: { kind: "sandbox.note.append", body: "not a message" } } as never),
    ).toThrow("NOT_MESSAGE");
  });
});
