import { z } from "zod";

export const ownedWorldIntentVersion = "pact.world.owner.v1" as const;
// Root ambition is the authenticated owner's current instruction. Empty string
// means none was provided; profile contains identity, never an intent fallback.
export const OwnedWorldIntentSchema = z
  .object({
    schemaVersion: z.literal(ownedWorldIntentVersion).optional(),
    audience: z.literal("owner"),
    ambition: z.string().max(8000),
    asOfGameTimeMs: z.number().int().nonnegative(),
    committedTickSequence: z.string().regex(/^\d+$/),
    profile: z
      .object({
        kingdomId: z.uuid(),
        handle: z.string(),
        displayName: z.string(),
        portrait: z.string(),
      })
      .strict(),
  })
  .passthrough();
export type OwnedWorldIntent = z.infer<typeof OwnedWorldIntentSchema>;
