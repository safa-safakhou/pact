import { z } from "zod";

export const referenceCatalogVersion = "pact.references.v1" as const;
const identity = {
  id: z.uuid(),
  ownerKingdomId: z.uuid(),
  asOfGameTimeMs: z.number().int().nonnegative(),
};
export const ObservedRequestReferenceSchema = z
  .object({
    ...identity,
    type: z.literal("ContactRequest"),
    direction: z.enum(["incoming", "outgoing"]),
    status: z.literal("pending"),
    counterpartyKingdomId: z.uuid(),
    expiresGameTimeMs: z.string().regex(/^\d+$/),
    delegationVersion: z.number().int().nonnegative(),
  })
  .strict();
export const ObservedUnitReferenceSchema = z
  .object({
    ...identity,
    type: z.literal("Unit"),
    unitType: z.string(),
    hostKingdomId: z.uuid(),
    placement: z.string(),
    homeGuard: z.boolean(),
    battleLocked: z.boolean(),
    scoutEligible: z.boolean(),
  })
  .strict();
export const ObservedOfferReferenceSchema = z
  .object({
    ...identity,
    type: z.literal("SupplyOffer"),
    status: z.literal("open"),
    version: z.number().int().positive(),
    counterpartyKingdomId: z.uuid(),
    expiresGameTimeMs: z.string().regex(/^\d+$/),
  })
  .strict();
export type ObservedUnitReference = z.infer<typeof ObservedUnitReferenceSchema>;

export const ObservedKingdomReferenceSchema = z
  .object({
    type: z.literal("Kingdom"),
    id: z.uuid(),
    role: z.enum(["self", "public"]),
    asOfGameTimeMs: z.number().int().nonnegative(),
  })
  .strict();
export const ObservedReceiptReferenceSchema = z
  .object({
    type: z.literal("Receipt"),
    id: z.uuid(),
    ownerAccountId: z.uuid(),
    status: z.string(),
  })
  .strict();
