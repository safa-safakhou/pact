import { z } from "zod";
import { CommandReceiptSchema, ReceiptReadQuerySchema } from "./schemas.js";

export const commandOutcomeVersion = "pact.command-outcome.v1" as const;
export const CommandOutcomeSchema = z
  .object({
    schemaVersion: z.literal(commandOutcomeVersion),
    commandId: z.uuid(),
    lookup: z.enum(["found", "not_found"]),
    execution: z.enum(["committed", "rejected", "unknown"]),
    receipt: CommandReceiptSchema.nullable(),
    lifecycle: z.array(z.record(z.string(), z.unknown())),
    coverage: z.string(),
  })
  .strict();
export const pactCommandOutcomeTool = {
  name: "pact_command_outcome_v2",
  description:
    "Read this account's canonical receipt and separately observed owned lifecycle states. A committed queue is not a completed building; signatures, activation and settlement differ. Missing receipt means unknown, never fictitious pending/transport uncertainty. Read-only, no replay or new command.",
  inputSchema: z.toJSONSchema(ReceiptReadQuerySchema, { target: "draft-7" }),
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
} as const;
