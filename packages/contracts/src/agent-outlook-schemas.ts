import { z } from "zod";

const units = z.string().regex(/^\d{1,30}$/),
  time = z.string().regex(/^\d{1,20}$/),
  refs = z.array(z.string().min(1).max(256)).max(12);
export const AgentOutlookQuerySchema = z
  .object({ forecastMinutes: z.number().int().min(1).max(60).default(60) })
  .strict();
export const OutlookFeasibilitySchema = z
  .object({
    candidates: z
      .array(
        z
          .object({
            candidateId: z.string().max(256),
            action: z.string().max(100),
            stockSufficient: z.boolean().nullable(),
            authoritySufficient: z.boolean().nullable(),
            blockers: z.array(z.string().max(100)).max(20),
            sourceRefs: refs,
          })
          .strict(),
      )
      .max(64),
    meaning: z.string().max(500),
  })
  .strict();
export const AgentOutlookSchema = z
  .object({
    schemaVersion: z.literal("pact.agent-outlook.v1"),
    ownerRef: z.uuid(),
    revision: z.string().max(100),
    asOfGameTimeMs: time,
    committedTickSequence: time,
    sourceRefs: refs,
    ownerValues: z.string().max(8000),
    resources: z
      .array(
        z
          .object({
            resource: z.enum(["iron", "silver", "grain"]),
            ordinaryUnits: units,
            allowanceUnits: units,
            lockedUnits: units,
            productionPerMinuteUnits: units,
            upkeepPerMinuteUnits: units,
            forecastUnits: units,
            forecastAllowanceUnits: units,
            throughGameTimeMs: time,
            sourceRefs: refs,
          })
          .strict(),
      )
      .max(3),
    commitments: z
      .array(
        z
          .object({
            id: z.uuid(),
            kind: z.enum(["construction", "training", "supply", "garrison"]),
            counterpartyRef: z.uuid().nullable(),
            admission: z.literal("confirmed"),
            fulfilment: z.enum(["pending", "fulfilled", "defaulted", "cancelled", "unknown"]),
            status: z.string().max(40),
            dueGameTimeMs: time.nullable(),
            authorityExposureUnits: z.record(z.string().max(20), units),
            hostFoodExposure: z
              .object({
                signedMaximumUnits: units,
                durationMinutes: z.number().int(),
                maximumLockExtensionMinutes: z.number().int(),
                meaning: z.string().max(500),
              })
              .strict()
              .nullable(),
            sourceRefs: refs,
          })
          .strict(),
      )
      .max(80),
    knownThreats: z
      .array(
        z
          .object({
            id: z.uuid(),
            kind: z.enum(["raid", "scout"]),
            status: z.string().max(40),
            otherRef: z.uuid().nullable(),
            strength: z.null(),
            lockGameTimeMs: time.nullable(),
            dueGameTimeMs: time,
            sourceRefs: refs,
          })
          .strict(),
      )
      .max(40),
    dependencies: z
      .array(
        z
          .object({
            counterpartyRef: z.uuid(),
            kind: z.enum(["incoming_supply", "outgoing_supply", "host_food", "visiting_units"]),
            resource: z.string().max(20).nullable(),
            perMinuteUnits: units.nullable(),
            shareNumeratorUnits: units.nullable(),
            shareDenominatorUnits: units.nullable(),
            sourceRefs: refs,
          })
          .strict(),
      )
      .max(80),
    outcomes: z
      .array(
        z
          .object({
            id: z.uuid(),
            kind: z.literal("battle"),
            result: z.enum(["won", "lost", "unknown"]),
            sourceRefs: refs,
          })
          .strict(),
      )
      .max(20),
    feasibility: OutlookFeasibilitySchema,
    assumptions: z
      .array(
        z
          .object({
            source: z.enum(["conditional_forecast", "signed_exposure", "unknown_opponent", "admission_not_fulfilment"]),
            detail: z.string().max(1000),
            sourceRefs: refs,
          })
          .strict(),
      )
      .max(12),
    coverage: z
      .object({
        opponentPrivateState: z.literal(false),
        completeWorld: z.literal(false),
        forecastMinutes: z.number().int(),
        garrisonOmitted: z.number().int().nonnegative(),
        commitmentHistoryLimit: z.number().int(),
        threatLimit: z.number().int(),
        meaning: z.string().max(1000),
      })
      .strict(),
  })
  .strict();
export type AgentOutlook = z.infer<typeof AgentOutlookSchema>;
export const pactAgentOutlookTool = {
  name: "pact_agent_outlook_v1",
  description:
    "Read your current factual resource/dependency outlook, conditional 1–60-minute forecast, signed exposure and known deadlines. Admission is not fulfilment. Unknown opponent forces and motives remain unknown. No universal survival/trust score, action preference, inference or authority is supplied.",
  inputSchema: {
    type: "object",
    properties: { forecastMinutes: { type: "integer", minimum: 1, maximum: 60, default: 60 } },
    additionalProperties: false,
  },
} as const;
