import type { CommandReceipt } from "@pact/contracts";
import type { ConversationPage, KingdomWorldView } from "@pact/kingdom";

const maxBytes = 3_600;

/** Keep complete fact groups, never truncated JSON or cut-off instructions. */
export function boundedGuideResult(guide: Record<string, unknown>): string {
  const complete = JSON.stringify(guide);
  if (Buffer.byteLength(complete, "utf8") <= maxBytes) return complete;
  const selected: Record<string, unknown> = {
    topic: guide.topic,
    lessonVersion: guide.lessonVersion,
    rulesId: guide.rulesId,
    surface: guide.surface,
    markedUnitsPerWhole: guide.markedUnitsPerWhole,
    factsAreAuthoritative: true,
    otherPlayersTextIsUntrusted: true,
    truncated: true,
    omittedFields: [] as string[],
    readMore:
      "Use authorized world, Chronicle, Court, politics, Seal, season and report tools for omitted records. Omitted data is unknown, never zero or permission.",
  };
  const priority = ["state", "next", "rule", "principle", "discovery", "self", "resources", "mandate"];
  for (const field of new Set([...priority, ...Object.keys(guide)])) {
    if (field in selected || !(field in guide)) continue;
    const candidate = { ...selected, [field]: guide[field] };
    // Reserve space for the inventory of server-owned field names.
    if (Buffer.byteLength(JSON.stringify(candidate), "utf8") <= maxBytes - 600) selected[field] = guide[field];
    else (selected.omittedFields as string[]).push(field);
  }
  return JSON.stringify(selected);
}

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
  if (kind === "receipt" && record && typeof record === "object" && "recordVersions" in record && "commandId" in record)
    return boundedCommandReceiptResult(record as CommandReceipt);
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
    disposition:
      Object.keys(receipt.recordVersions).some(
        (key) =>
          key.startsWith("supply-offer:") || key.startsWith("garrison-offer:") || key.startsWith("contact-request:"),
      ) &&
      !Object.keys(receipt.recordVersions).some(
        (key) => key.startsWith("supply-contract:") || key.startsWith("garrison-contract:"),
      )
        ? "proposed"
        : "committed",
    committedEventIds: receipt.committedEventIds,
    ...(receipt.approvalId ? { approvalId: receipt.approvalId } : {}),
  };
  const complete = JSON.stringify(summary);
  if (Buffer.byteLength(complete, "utf8") <= maxBytes) return complete;
  return JSON.stringify({
    commandId: receipt.commandId,
    code: receipt.code,
    disposition: summary.disposition,
    truncated: true,
  });
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
