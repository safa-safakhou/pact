import type { CommandReceipt } from "@pact/contracts";
import type { ConversationPage, KingdomWorldView } from "@pact/kingdom";

const maxBytes = 3_600;

/** Preserve the authorized projection when it fits, otherwise make truncation explicit. */
export function boundedWorldResult(view: KingdomWorldView): string {
  const complete = JSON.stringify(view);
  if (Buffer.byteLength(complete, "utf8") <= maxBytes) return complete;
  const common = {
    audience: view.audience,
    profile: view.profile,
    asOfGameTimeMs: view.asOfGameTimeMs,
    committedTickSequence: view.committedTickSequence,
    worldStatus: view.worldStatus,
    truncated: true,
  };
  const selected =
    view.audience === "owner"
      ? { ...common, balances: view.balances, buildings: view.buildings, troops: view.troops, threats: view.threats }
      : { ...common, sharedRecords: view.sharedRecords, publicEvents: view.publicEvents };
  const compact = JSON.stringify(selected);
  return Buffer.byteLength(compact, "utf8") <= maxBytes ? compact : JSON.stringify(common);
}

export function boundedReportResult(kind: string, recordId: string, report: unknown): string {
  const complete = JSON.stringify({ kind, recordId, report });
  if (Buffer.byteLength(complete, "utf8") <= maxBytes) return complete;
  return JSON.stringify({ kind, recordId, truncated: true });
}

export function boundedRecordResult(kind: "receipt" | "approval", recordId: string, record: unknown): string {
  const complete = JSON.stringify(record);
  if (Buffer.byteLength(complete, "utf8") <= maxBytes) return complete;
  return JSON.stringify({ kind, recordId, truncated: true });
}

/** Persist only server-issued receipt metadata needed for a later versioned command. */
export function boundedCommandReceiptResult(receipt: CommandReceipt): string {
  const summary = {
    commandId: receipt.commandId,
    code: receipt.code,
    charged: receipt.charged,
    recordVersions: receipt.recordVersions,
    committedEventIds: receipt.committedEventIds,
    ...(receipt.approvalId ? { approvalId: receipt.approvalId } : {}),
  };
  const complete = JSON.stringify(summary);
  if (Buffer.byteLength(complete, "utf8") <= maxBytes) return complete;
  return JSON.stringify({ commandId: receipt.commandId, code: receipt.code, truncated: true });
}

export function boundedConversationResult(page: ConversationPage): string {
  const complete = JSON.stringify(page);
  if (Buffer.byteLength(complete, "utf8") <= maxBytes) return complete;
  return JSON.stringify({
    counterpartyKingdomId: page.counterpartyKingdomId,
    messageIds: page.messages.map((message) => message.messageId),
    untrustedContent: true,
    truncated: true,
  });
}
