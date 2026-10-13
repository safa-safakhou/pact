import { agentRecovery, type RunCommandOutcome } from "@pact/application";
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
  const priority = [
    "state",
    "self",
    "ambition",
    "next",
    "resources",
    "resourceRules",
    "builders",
    "consequences",
    "constructionStockChecks",
    "mandate",
    "next",
    "rule",
    "principle",
    "discovery",
  ];
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
  const selected: Record<string, unknown> = { ...common, omittedFields: [] as string[] };
  const groups: Record<string, unknown> =
    view.audience === "owner"
      ? {
          ambition: view.ambition,
          balances: view.balances,
          buildings: view.buildings,
          builders: view.builders,
          consequences: view.consequences
            ? {
                ...view.consequences,
                truncated: true,
                builds: view.consequences.builds.slice(0, 3),
                contacts: view.consequences.contacts.slice(0, 3),
                supplyContracts: view.consequences.supplyContracts.slice(0, 2),
              }
            : undefined,
          troops: view.troops,
          threats: view.threats,
        }
      : { sharedRecords: view.sharedRecords, publicEvents: view.publicEvents };
  for (const [field, value] of Object.entries(groups)) {
    if (value === undefined) continue;
    if (Buffer.byteLength(JSON.stringify({ ...selected, [field]: value }), "utf8") <= maxBytes - 200)
      selected[field] = value;
    else (selected.omittedFields as string[]).push(field);
  }
  return JSON.stringify(selected);
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
export function boundedCommandReceiptResult(receipt: RunCommandOutcome): string {
  const summary = {
    commandId: receipt.commandId,
    code: receipt.code,
    ...(receipt.code !== "COMMITTED" && receipt.code !== "ALREADY_COMMITTED"
      ? { recovery: agentRecovery(receipt.code) }
      : {}),
    charged: receipt.charged,
    recordVersions: receipt.recordVersions,
    ...(receipt.receiptExists === false ? { receiptExists: false } : {}),
    disposition:
      receipt.code !== "COMMITTED" && receipt.code !== "ALREADY_COMMITTED"
        ? "not_committed"
        : Object.keys(receipt.recordVersions).some(
              (key) =>
                key.startsWith("supply-offer:") ||
                key.startsWith("garrison-offer:") ||
                key.startsWith("contact-request:"),
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
  if (Buffer.byteLength(complete, "utf8") <= 36_000) return complete;
  return JSON.stringify({
    counterpartyKingdomId: page.counterpartyKingdomId,
    messageIds: page.messages.map((message) => message.messageId),
    untrustedContent: true,
    truncated: true,
  });
}

/** Keep actual candidate identities and whole notice prose, or explicitly omit prose with its source pointer. */
export function boundedDiscoveryResult(result: {
  kingdoms: Record<string, unknown>[];
  hasMore: boolean;
  selection: string;
  coverage: string;
  untrustedContent: boolean;
}): string {
  const full = JSON.stringify(result);
  if (Buffer.byteLength(full, "utf8") <= maxBytes) return full;
  const kingdoms: Record<string, unknown>[] = [];
  const view = () => ({
    selection: result.selection,
    kingdoms,
    hasMore: result.hasMore,
    untrustedContent: true,
    coverage: result.coverage,
    truncated: true,
    observed: result.kingdoms.length,
    retained: kingdoms.length,
    readMore: {
      tool: "pact_kingdom_discover_v2",
      guidance:
        "Use a smaller limit, query/filter or exclusions. Omitted candidates and prose are unknown, never empty.",
    },
  });
  for (const candidate of result.kingdoms) {
    kingdoms.push(candidate);
    if (Buffer.byteLength(JSON.stringify(view()), "utf8") <= maxBytes) continue;
    kingdoms.pop();
    const notice = candidate.publicNotice;
    if (notice && typeof notice === "object") {
      const { commentary: _prose, ...source } = notice as Record<string, unknown>;
      kingdoms.push({ ...candidate, publicNotice: { ...source, commentaryOmitted: true } });
      if (Buffer.byteLength(JSON.stringify(view()), "utf8") > maxBytes) kingdoms.pop();
    }
  }
  return JSON.stringify(view());
}
