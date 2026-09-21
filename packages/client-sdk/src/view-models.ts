import type { CommandReceipt } from "@pact/contracts";
import type {
  InvitationDestination,
  PricingMessage,
  ReceiptViewModel,
  RunStatusLabel,
  SetupSnapshot,
  SetupSnapshotInput,
  SetupStep,
} from "./types.js";

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

/** Map durable run status to truthful player-facing labels. */
export function toRunStatusLabel(status: string): RunStatusLabel {
  if (status === "running") return "Working";
  if (status === "waiting") return "Waiting";
  return "Stopped";
}

/**
 * Pricing copy for allowance confirmation. Unknown pricing never presents as zero cost.
 */
export function toPricingMessage(input: { available: boolean; estimateText?: string }): PricingMessage {
  if (!input.available) {
    return { kind: "unavailable", text: "Provider price unavailable" };
  }
  const estimate = input.estimateText?.trim();
  if (!estimate) {
    return { kind: "unavailable", text: "Provider price unavailable" };
  }
  return { kind: "estimate", text: estimate };
}

const SETUP_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  EXPIRED: "This approval has expired. Request a new approval from your Envoy run, then decide again.",
  REVOKED: "This model key was revoked. Add a new credential before starting another run.",
  UNSUPPORTED_HOST:
    "This external host is not supported for PACT connection yet. Use a certified route or continue with a PACT model adapter.",
  CREDENTIAL_REVOKED: "This model key was revoked. Add a new credential before starting another run.",
  APPROVAL_EXPIRED: "This approval has expired. Request a new approval from your Envoy run, then decide again.",
  HOST_UNSUPPORTED:
    "This external host is not supported for PACT connection yet. Use a certified route or continue with a PACT model adapter.",
};

/** Actionable setup/approval error copy; never implies a live kingdom was founded. */
export function toSetupErrorMessage(code: string): string {
  return (
    SETUP_ERROR_MESSAGES[code] ??
    "Something went wrong during setup. Check your connection and try again. Your private draft is unchanged."
  );
}

/** Preserve invitation destination from URL search params or host-provided fields. */
export function readInvitationDestination(input: {
  invite?: string | null;
  destination?: string | null;
}): InvitationDestination {
  const invite = input.invite?.trim();
  const destination = input.destination?.trim();
  return {
    ...(invite ? { invite } : {}),
    ...(destination ? { destination } : {}),
  };
}

export const SETUP_STEPS: readonly SetupStep[] = [
  "account",
  "draft",
  "provider",
  "credentials",
  "model",
  "allowance",
  "run",
  "inbox",
] as const;

/** Pure setup snapshot for web, native, and Telegram hosts. */
export function buildSetupSnapshot(input: SetupSnapshotInput): SetupSnapshot {
  const invitation = input.invitation ?? {};
  const pricing = toPricingMessage(
    input.pricing ?? {
      available: false,
    },
  );
  return {
    step: input.step,
    invitation,
    runStatusLabel: toRunStatusLabel(input.runStatus ?? "stopped"),
    pricing,
    errorMessage: input.errorCode ? toSetupErrorMessage(input.errorCode) : null,
    externalHostMessage: input.externalHostMessage ?? null,
    connectorPrerequisiteMessage: input.connectorPrerequisiteMessage ?? null,
    serverState: input.serverState ?? {},
    foundsLiveKingdom: false,
  };
}
