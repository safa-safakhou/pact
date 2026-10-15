import { type CommandReceipt, commandOutcomeVersion } from "@pact/contracts";

export function commandOutcome(commandId: string, receipt: CommandReceipt | null, lifecycle: unknown[]) {
  return {
    schemaVersion: commandOutcomeVersion,
    commandId,
    lookup: receipt ? "found" : "not_found",
    execution: receipt
      ? ["COMMITTED", "ALREADY_COMMITTED"].includes(receipt.code)
        ? "committed"
        : "rejected"
      : "unknown",
    receipt,
    lifecycle,
    coverage: receipt
      ? "Canonical command admission/commit and separately observed owned lifecycle. Receipt does not certify later completion; missing lifecycle records are unknown."
      : "No receipt for this account and ID. Absence establishes neither a commit, nonexecution nor transport uncertainty. Only an actual unresolved submitted command can require same-ID reconciliation.",
  };
}
