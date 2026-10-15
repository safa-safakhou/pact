import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import {
  ObservedOfferReferenceSchema,
  ObservedRequestReferenceSchema,
  ObservedUnitReferenceSchema,
} from "./observed-references.js";

const identity = { id: randomUUID(), ownerKingdomId: randomUUID(), asOfGameTimeMs: 0 };
it("keeps role/direction/version separate from syntactically valid identifiers", () => {
  const request = {
    ...identity,
    type: "ContactRequest",
    direction: "incoming",
    status: "pending",
    counterpartyKingdomId: randomUUID(),
    expiresGameTimeMs: "60000",
    delegationVersion: 1,
  };
  expect(ObservedRequestReferenceSchema.safeParse(request).success).toBe(true);
  expect(ObservedOfferReferenceSchema.safeParse(request).success).toBe(false);
  expect(ObservedRequestReferenceSchema.safeParse({ ...request, direction: "accepted" }).success).toBe(false);
  expect(ObservedRequestReferenceSchema.safeParse({ ...request, id: "not-a-uuid" }).success).toBe(false);
  // Nil UUID syntax is allowed by historical contracts; it proves no record.
  expect(
    ObservedRequestReferenceSchema.safeParse({ ...request, id: "00000000-0000-0000-0000-000000000000" }).success,
  ).toBe(true);
});
it("describes owned unit facts without turning ID syntax into eligibility", () => {
  expect(
    ObservedUnitReferenceSchema.parse({
      ...identity,
      type: "Unit",
      unitType: "spearman",
      hostKingdomId: identity.ownerKingdomId,
      placement: "home",
      homeGuard: true,
      battleLocked: false,
      scoutEligible: false,
    }).scoutEligible,
  ).toBe(false);
});
