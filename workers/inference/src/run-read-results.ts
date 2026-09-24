import type { KingdomWorldView } from "@pact/kingdom";

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
