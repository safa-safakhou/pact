import { z } from "zod";

export const ObservationSectionQuerySchema = z
  .object({
    section: z.enum(["forecast", "construction", "requests", "agreements", "units", "social_attention"]),
    forecastMinutes: z.number().int().min(1).max(60).optional(),
    limit: z.number().int().min(1).max(32).optional(),
    recordId: z.uuid().optional(),
    cursor: z
      .object({
        ownerKingdomId: z.uuid(),
        section: z.enum(["requests", "agreements", "units", "social_attention"]),
        committedTickSequence: z.string().regex(/^\d+$/),
        lastCommittedEventId: z.string().regex(/^\d+$/),
        afterKey: z.string().min(1).max(100),
      })
      .strict()
      .optional(),
  })
  .strict();
export type ObservationSectionQuery = z.infer<typeof ObservationSectionQuerySchema>;
export const pactObservationSectionTool = {
  name: "pact_observation_read_v2",
  description:
    "Read one owner-scoped current section: forecast, construction, requests, agreements, units or social_attention. Retains complete records/terms and explicit coverage. Use returned cursor unchanged for another page; a changed snapshot requires a fresh first page. recordId selects an observed record within this account only. No target account/kingdom selector, message acknowledgement, inference, signature or authority change.",
  inputSchema: z.toJSONSchema(ObservationSectionQuerySchema, { target: "draft-7" }),
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
} as const;
