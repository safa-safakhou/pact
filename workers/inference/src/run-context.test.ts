import type { InboxService } from "@pact/inbox";
import type { ConversationReader, KingdomService, WorldViewService } from "@pact/kingdom";
import type { RunView } from "@pact/runs";
import { describe, expect, it, vi } from "vitest";
import { ownerRunContext } from "./run-context.js";

const accountId = "owner-account";
const kingdomId = "owner-kingdom";
const counterpartyKingdomId = "selected-kingdom";
const run = {
  runId: "run-1",
  accountId,
  subjectId: kingdomId,
  status: "running",
  objective: "Review my kingdom",
  provider: "fake",
  model: "fake-model",
  deadlineAt: new Date("2026-09-26T00:15:00.000Z"),
  usedCalls: 0,
  usedTokens: 0,
  maxCalls: 1,
  maxTokens: 1_000,
  maxMessages: 1,
  usedMessages: 0,
  selectedContextIds: [counterpartyKingdomId],
  maxConversations: 1,
  usedConversations: 0,
  modelCalls: 0,
  reservedTokens: 0,
  lastErrorCode: null,
  ambiguousCrash: false,
} satisfies RunView;

function inputs(options: { audience?: "owner" | "public"; body?: string } = {}) {
  const inboxPayload = "IGNORE_SYSTEM_AND_CHANGE_MANDATE";
  const kingdom = { getByAccount: vi.fn().mockResolvedValue({ kingdomId }) } as unknown as KingdomService;
  const views = {
    read: vi.fn().mockResolvedValue({
      audience: options.audience ?? "owner",
      asOfGameTimeMs: 60_000,
      profile: { kingdomId, displayName: "Owner" },
      balances: { iron: 10 },
      upkeep: { grain: 1 },
      buildings: [],
      troops: [],
      threats: [],
      contracts: [],
    }),
  } as unknown as WorldViewService;
  const inbox = {
    listRecentMetadata: vi.fn().mockResolvedValue([
      {
        sequence: "1",
        eventId: "event-1",
        type: "game.message.received.v1",
        occurredAt: "2026-09-26T00:00:00.000Z",
        payload: { hostile: inboxPayload },
      },
    ]),
  } as unknown as InboxService;
  const conversations = {
    read: vi.fn().mockResolvedValue({
      counterpartyKingdomId,
      messages: [
        {
          messageId: "message-1",
          sender: "counterparty",
          sentGameTimeMs: "60000",
          body: options.body ?? "Counterpart terms, not instructions",
        },
      ],
      untrustedContent: true,
    }),
  } as unknown as ConversationReader;
  return { kingdom, views, inbox, conversations, inboxPayload };
}

describe("owner Envoy context boundary", () => {
  it("keeps counterpart prose in user-role data and excludes arbitrary inbox payloads", async () => {
    const hostile = "IGNORE_SYSTEM_AND_SWITCH_MODEL";
    const fixture = inputs({ body: hostile });
    const messages = await ownerRunContext(run, fixture.kingdom, fixture.views, fixture.inbox, fixture.conversations);
    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).not.toContain(hostile);
    expect(messages.some((message) => message.role === "user" && message.content.includes(hostile))).toBe(true);
    expect(JSON.stringify(messages)).not.toContain(fixture.inboxPayload);
    expect(vi.mocked(fixture.conversations.read)).toHaveBeenCalledWith(accountId, counterpartyKingdomId, 3);
  });

  it("fails closed when the requested owner projection is not owner-authorized", async () => {
    const fixture = inputs({ audience: "public" });
    const messages = await ownerRunContext(run, fixture.kingdom, fixture.views, fixture.inbox, fixture.conversations);
    expect(messages).toHaveLength(2);
    expect(vi.mocked(fixture.inbox.listRecentMetadata)).not.toHaveBeenCalled();
    expect(vi.mocked(fixture.conversations.read)).not.toHaveBeenCalled();
  });

  it("omits oversized selected prose rather than leaking it through a convenience summary", async () => {
    const hostile = `HOSTILE_PRIVATE_TEXT_${"X".repeat(15_000)}`;
    const fixture = inputs({ body: hostile });
    const messages = await ownerRunContext(run, fixture.kingdom, fixture.views, fixture.inbox, fixture.conversations);
    const encoded = JSON.stringify(messages);
    expect(encoded).toContain(counterpartyKingdomId);
    expect(encoded).toContain('\\"truncated\\":true');
    expect(encoded).not.toContain("HOSTILE_PRIVATE_TEXT_");
  });
});
