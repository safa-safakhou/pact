import type { ApprovalStatusReader } from "@pact/approvals";
import type { OwnerRecordStates } from "@pact/kingdom";
import type { ActivityStateResolver, CurrentActivityFact } from "@pact/runs";

/** Domain composition belongs in the application, never in the reusable run platform. */
export function activityStateResolver(
  states: Pick<OwnerRecordStates, "read">,
  approvals: Pick<ApprovalStatusReader, "read">,
): ActivityStateResolver {
  return async (accountId, entries) => {
    const records = await states.read(
      accountId,
      entries.flatMap((entry) => entry.records.map((r) => r.record)),
    );
    const byRecord = new Map(records.map((r) => [r.record, r]));
    const result: Record<string, CurrentActivityFact[]> = {};
    const approvalIds = [...new Set(entries.flatMap((entry) => (entry.approvalId ? [entry.approvalId] : [])))];
    const approvalViews = new Map(
      await Promise.all(approvalIds.map(async (id) => [id, await approvals.read(accountId, id)] as const)),
    );
    for (const entry of entries) {
      const facts: CurrentActivityFact[] = entry.records.flatMap((r) => {
        const current = byRecord.get(r.record);
        return current ? [current] : [];
      });
      if (entry.approvalId) {
        const approval = approvalViews.get(entry.approvalId);
        if (approval)
          facts.unshift({
            label: "Exact human approval",
            status: approval.status,
            nextStep:
              approval.status === "pending"
                ? "Human: review this exact approval; no command has committed yet."
                : approval.status === "approved"
                  ? "Approval resolved. Inspect the receipt and current consequences; no further approval is pending."
                  : `Approval ${approval.status}; no approval remains pending. Read current state before proposing a different action.`,
            ...(approval.status === "pending" ? { reviewPath: approval.deepLinkPath } : {}),
          });
      }
      result[entry.id] = facts;
    }
    return result;
  };
}
