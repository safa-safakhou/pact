import { createHash } from "node:crypto";
import {
  type CommandReceipt,
  gameCommandJsonSchema,
  type ProductScope,
  SCHEMA_VERSION,
  validateProviderGameCommand,
} from "@pact/contracts";
import { agentRecovery } from "./agent-recovery.js";
import type { CommandDispatcher } from "./dispatcher.js";
import { DispatcherError, type DispatcherFailureCode } from "./types.js";

export type RunCommandOutcome = Omit<CommandReceipt, "code"> & {
  code: CommandReceipt["code"] | DispatcherFailureCode;
  receiptExists?: false;
  recovery?: string;
};

/** PACT-owned provider tool; the generic provider router validates its arguments first. */
export const pactRunCommandTool = {
  name: "pact_command_v1",
  description:
    "Submit one typed PACT game command. Identity and authority come from the active run, never these arguments.",
  inputSchema: gameCommandJsonSchema,
  parseArguments: validateProviderGameCommand,
} as const;

export interface RunCommandToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: unknown;
}

export interface RunCommandToolBatch {
  readonly run: { readonly runId: string; readonly accountId: string };
  readonly requestId: string;
  readonly calls: readonly RunCommandToolCall[];
}

/** Stable UUIDv8: retries of one provider response cannot mint a second command ID. */
export function runToolCommandId(runId: string, requestId: string, callId: string): string {
  const bytes = createHash("sha256")
    .update(`pact-run-command-v1\0${runId}\0${requestId}\0${callId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x80;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** One tool call is one shared command transaction; ordinary denials stay readable receipts. */
export async function dispatchRunCommandTools(
  dispatcher: CommandDispatcher,
  productScope: ProductScope,
  input: RunCommandToolBatch,
): Promise<readonly RunCommandOutcome[]> {
  const principal = {
    accountId: input.run.accountId,
    productScope,
    audience: "agent" as const,
    sessionId: input.run.runId,
    agentScopes: ["game:act"] as const,
  };
  const receipts: RunCommandOutcome[] = [];
  for (const call of input.calls) {
    if (call.name !== pactRunCommandTool.name || !call.id) throw new DispatcherError("INVALID_COMMAND");
    const parsed = validateProviderGameCommand(call.arguments);
    const commandId = runToolCommandId(input.run.runId, input.requestId, call.id);
    try {
      receipts.push(
        await dispatcher.dispatch(
          principal,
          { ...parsed, commandId },
          {
            requestId: input.requestId,
            commandId,
            runId: input.run.runId,
          },
        ),
      );
    } catch (error) {
      if (!(error instanceof DispatcherError)) throw error;
      receipts.push({
        schemaVersion: SCHEMA_VERSION,
        commandId,
        code: error.code,
        receiptExists: false,
        recovery: agentRecovery(error.code),
        committedEventIds: [],
        recordVersions: {},
        charged: [],
      });
    }
  }
  return receipts;
}
