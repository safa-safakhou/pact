import type { CommandReceipt } from "@pact/contracts";
import type { ReceiptViewModel } from "./types.js";

export function toReceiptViewModel(receipt: CommandReceipt): ReceiptViewModel {
  const state =
    receipt.code === "COMMITTED" || receipt.code === "ALREADY_COMMITTED"
      ? "committed"
      : receipt.code === "APPROVAL_REQUIRED"
        ? "approval-required"
        : "rejected";
  return {
    commandId: receipt.commandId,
    code: receipt.code,
    state,
    isTerminal: state !== "approval-required",
    ...(receipt.committedAt ? { committedAt: receipt.committedAt } : {}),
    ...(receipt.approvalId ? { approvalId: receipt.approvalId } : {}),
  };
}
