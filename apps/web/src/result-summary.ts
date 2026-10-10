export type ResultEntry = {
  id: string;
  category: string;
  code: string;
  commandId?: string;
  nextStep: string;
  currentFacts?: { label: string; status: string; nextStep: string; reviewPath?: string }[];
};
export type ResultReport = { stale?: boolean; status: string; entries: ResultEntry[]; nextStep: string };
/** Authorized record facts only; agent prose never establishes a command outcome. */
export function resultSummary(report: ResultReport, ambition = "") {
  const latest = report.entries.at(-1);
  const approval = report.entries
    .flatMap((e) => e.currentFacts ?? [])
    .find((f) => f.status === "pending" && f.reviewPath);
  const waiting = latest?.currentFacts?.find((f) => ["active", "waiting", "pending", "open"].includes(f.status));
  const state = report.stale
    ? "unknown"
    : approval
      ? "approval-needed"
      : latest?.category === "failed"
        ? "failed"
        : waiting || latest?.category === "waiting" || report.status === "waiting"
          ? "waiting"
          : latest?.category === "proposed"
            ? "proposed"
            : latest?.category === "committed"
              ? "committed"
              : "unknown";
  return {
    ambition,
    state,
    latestResult: latest ? `${latest.category.replaceAll("_", " ")} / ${latest.code}` : "No recorded gameplay result.",
    currentDecision: report.stale
      ? "Current records unavailable."
      : approval
        ? approval.label
        : waiting
          ? `${waiting.label}: ${waiting.status}`
          : "No pending decision established by these records.",
    nextStep: report.stale
      ? "Reconnect and refresh before acting; retained receipts do not establish current state."
      : approval
        ? approval.nextStep
        : waiting
          ? waiting.nextStep
          : (latest?.nextStep ?? report.nextStep),
    ...(latest?.commandId ? { receiptId: latest.commandId } : {}),
    ...(!report.stale && approval?.reviewPath ? { reviewPath: approval.reviewPath } : {}),
    authority:
      "Signatures use current game authority. Contact acceptance follows your communication delegation; authority changes remain yours. Current terms and permissions determine each action.",
  };
}
