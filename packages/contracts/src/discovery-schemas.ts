import { z } from "zod";

/** A bounded selection, not a directory offset or caller-selected identity. */
export const KingdomDiscoveryQuerySchema = z
  .object({
    query: z.string().trim().max(80).default(""),
    relationship: z.enum(["any", "new", "contacts", "incoming", "outgoing"]).default("any"),
    minHallLevel: z.number().int().min(1).max(6).optional(),
    maxHallLevel: z.number().int().min(1).max(6).optional(),
    excludeKingdomIds: z.array(z.uuid()).max(50).default([]),
    noticeQuery: z.string().trim().min(1).max(80).optional(),
    noticeResource: z.enum(["iron", "silver", "grain"]).optional(),
    courtHandle: z
      .string()
      .regex(/^[a-z][a-z0-9_]{2,23}$/)
      .optional(),
    sharedCourtOnly: z.boolean().default(false),
    rotation: z.number().int().min(0).max(1000000).default(0),
    limit: z.number().int().min(1).max(20).default(8),
  })
  .strict()
  .refine((q) => q.minHallLevel === undefined || q.maxHallLevel === undefined || q.minHallLevel <= q.maxHallLevel, {
    message: "Minimum Hall level cannot exceed maximum",
  });
export type KingdomDiscoveryQuery = z.infer<typeof KingdomDiscoveryQuerySchema>;
