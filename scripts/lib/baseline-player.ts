import { randomUUID } from "node:crypto";
import { type CommandReceipt, CommandReceiptSchema, type GameAction, GameActionSchema } from "@pact/contracts";

/** The player gets only published tools. No database, admin or rules-worker port. */
export interface BaselineTools {
  call(name: string, args: Record<string, unknown>): Promise<unknown>;
}
export class BaselineWriteError extends Error {
  constructor(readonly commandId: string) {
    super("Command did not return a committed receipt; reconcile this ID before starting another attempt.");
  }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_TOOL_RESULT");
  return value as Record<string, unknown>;
}
function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error("INVALID_TOOL_RESULT");
  return value.map(object);
}

/** One deterministic turn, not a scheduler. Re-enter explicitly after a partner responds. */
export async function playBaseline(
  tools: BaselineTools,
  options: { partnerKingdomId?: string; maxToolCalls?: number } = {},
) {
  const ceiling = options.maxToolCalls ?? 14;
  if (!Number.isSafeInteger(ceiling) || ceiling < 1 || ceiling > 20) throw new Error("INVALID_CALL_CEILING");
  let toolCalls = 0;
  const committed: { commandId: string; kind: GameAction["kind"] }[] = [];
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    if (toolCalls >= ceiling) throw new Error("BASELINE_CALL_CEILING");
    toolCalls++;
    return tools.call(name, args);
  };
  const act = async (action: GameAction) => {
    GameActionSchema.parse(action);
    const commandId = randomUUID();
    let receipt: CommandReceipt;
    try {
      receipt = CommandReceiptSchema.parse(await call("pact_game_action_v1", { commandId, action }));
    } catch {
      // Uncertain completion: inspect this exact ID, never manufacture a new write.
      try {
        receipt = CommandReceiptSchema.parse(await call("pact_receipt_read_v1", { commandId }));
      } catch {
        throw new BaselineWriteError(commandId);
      }
    }
    if (receipt.commandId !== commandId || receipt.code !== "COMMITTED") throw new BaselineWriteError(commandId);
    committed.push({ commandId, kind: action.kind });
    return receipt;
  };
  const guide = object(await call("pact_agent_guide_v1"));
  if (guide.state !== "active") return { status: "human_activation_required", toolCalls, committed };
  if (guide.worldStatus !== "active") return { status: "world_not_active", toolCalls, committed };
  const selfId = object(guide.self).kingdomId;
  if (typeof selfId !== "string") throw new Error("INVALID_OWNER_GUIDE");
  const contacts = rows(guide.contacts);
  const partnerId = options.partnerKingdomId ?? contacts[0]?.kingdomId;
  if (typeof partnerId !== "string" || !contacts.some((c) => c.kingdomId === partnerId))
    return { status: "accepted_contact_required", toolCalls, committed };
  const owner = object(await call("pact_world_read_v1", { targetKingdomId: selfId, forecastMinutes: 1 }));
  if (owner.audience !== "owner") throw new Error("OWNER_VIEW_REQUIRED");
  // A public/contact read is enough; no attempt to obtain partner balances.
  await call("pact_world_read_v1", { targetKingdomId: partnerId, forecastMinutes: 1 });
  await call("pact_agent_guide_v1", { topic: "development" });
  await call("pact_agent_guide_v1", { topic: "diplomacy" });
  if (rows(guide.activeSupplyContracts).some((c) => c.counterpartyKingdomId === partnerId))
    return { status: "agreement_active", toolCalls, committed };
  if (rows(guide.openSupplyOffers).some((o) => o.counterpartyKingdomId === partnerId))
    return { status: "awaiting_existing_offer", toolCalls, committed };
  await call("run.open");
  const farm = rows(owner.buildings).find((b) => b.kind === "farm");
  const builders = rows(owner.builders);
  const slot = builders.find((b) => !b.instructionId)?.slot;
  if (farm?.level === 1 && (slot === 1 || slot === 2) && !builders.some((b) => b.kind === "farm"))
    await act({ kind: "game.building.queue", building: "farm", targetLevel: 2, slot });
  await act({
    kind: "game.message.send",
    recipientKingdomId: partnerId,
    body: "I offer 12 Grain/hour for 4 Silver/hour for one hour, no bonds, zero notice. Please inspect the exact offer before signing.",
  });
  const offer = await act({
    kind: "game.supply.offer",
    counterpartyKingdomId: partnerId,
    terms: {
      aToB: { resource: "grain", wholePerHour: 12 },
      bToA: { resource: "silver", wholePerHour: 4 },
      aBond: null,
      bBond: null,
      durationHours: 1,
      noticeHours: 0,
    },
  });
  const key = Object.keys(offer.recordVersions).find((k) => k.startsWith("supply-offer:"));
  if (!key) throw new Error("OFFER_REFERENCE_MISSING");
  const offerId = key.slice("supply-offer:".length);
  await act({ kind: "game.supply.sign", offerId, version: offer.recordVersions[key] ?? 0 });
  return { status: "awaiting_partner_signature", toolCalls, committed, offerId };
}
