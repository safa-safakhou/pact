export type ReportEntry = {
  id: string;
  category: "committed" | "proposed" | "failed" | "waiting" | "approval_needed";
  callId: string;
  code: string;
  toolName?: string;
  actionKind?: string;
  reason?: string;
  detail?: string;
  commandId?: string;
  approvalId?: string;
  records: { record: string; version: number }[];
  nextStep: string;
};
const safeId = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
/** Server tool metadata only. Does not execute inference, copy messages, or infer a successful trade. */
export function factualRunReport(
  rows: { id?: string; call_id: string; summary: string }[],
  status: string,
  lastErrorCode: string | null,
) {
  const entries: ReportEntry[] = [],
    assessments: { id: string; label: string; text: string }[] = [];
  for (const row of rows) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(row.summary);
    } catch {
      continue;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) continue;
    if (typeof data.agentAssessment === "string") {
      assessments.push({
        id: row.id ?? row.call_id,
        label: "Agent assessment — not an engine fact",
        text: data.agentAssessment.slice(0, 2000),
      });
      continue;
    }
    if (typeof data.code !== "string" || !/^[A-Z][A-Z0-9_]{0,63}$/.test(data.code)) continue;
    const code = data.code;
    const records = Object.entries(
      data.recordVersions && typeof data.recordVersions === "object" ? data.recordVersions : {},
    )
      .filter(
        ([key, value]) =>
          /^[a-z][a-z-]{0,40}:[0-9a-f-]{36}$/i.test(key) && typeof value === "number" && Number.isSafeInteger(value),
      )
      .slice(0, 20)
      .map(([record, version]) => ({ record, version: version as number }));
    const committed = code === "COMMITTED" || code === "ALREADY_COMMITTED";
    const category =
      code === "APPROVAL_REQUIRED"
        ? "approval_needed"
        : committed
          ? data.disposition === "proposed"
            ? "proposed"
            : "committed"
          : code === "WAITING"
            ? "waiting"
            : "failed";
    entries.push({
      id: row.id ?? `${row.call_id}:${entries.length}`,
      category,
      callId: row.call_id,
      code,
      ...Object.fromEntries(
        ["toolName", "actionKind", "reason", "detail"].flatMap((key) =>
          typeof data[key] === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,80}$/.test(data[key]) ? [[key, data[key]]] : [],
        ),
      ),
      records,
      ...(safeId(data.commandId) ? { commandId: data.commandId } : {}),
      ...(safeId(data.approvalId) ? { approvalId: data.approvalId } : {}),
      nextStep:
        category === "approval_needed"
          ? "Human: review the exact approval; no action has committed."
          : category === "proposed"
            ? "Wait for the other party to accept/sign the exact version; no agreement is active yet."
            : category === "failed"
              ? "Read current state and exact record version, then replan. Do not claim success or blindly repeat the failed move."
              : "Inspect the referenced record for its actual consequence; a committed instruction can still be pending.",
    });
  }
  return {
    label: "Engine facts — server-recorded tool results",
    entries,
    assessments,
    status,
    lastErrorCode,
    truncated: rows.length >= 50,
    nextStep:
      status === "waiting"
        ? "Waiting: no automatic inference. The human may explicitly resume within the original allowance."
        : status === "failed"
          ? "Read the failure and reconcile committed receipts before starting a new run."
          : status === "running"
            ? "A bounded run is active; Stop prevents new admissions, not already committed game work."
            : "Review committed records and pending counterparties before choosing another objective.",
  };
}

export function boundedAssessment(text: string) {
  let selected = "",
    bytes = 0;
  for (const cp of text) {
    const code = cp.codePointAt(0) ?? 0;
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) continue;
    const n = Buffer.byteLength(cp, "utf8");
    if (bytes + n > 1800) break;
    selected += cp;
    bytes += n;
  }
  return selected;
}
