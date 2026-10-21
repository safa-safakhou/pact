import { z } from "zod";
import { AcceptedCommandEnvelopeSchema } from "./schemas.js";

const id = z.string().min(1).max(2000),
  units = z.string().regex(/^(0|[1-9]\d{0,39})$/);
export const EffectClaimSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("resource"), schemaId: id, key: id, units }).strict(),
  z.object({ kind: z.literal("authority"), schemaId: id, key: id, units }).strict(),
  z.object({ kind: z.literal("promise"), schemaId: id, key: id, value: z.string().max(4000) }).strict(),
]);
export const ActionEffectsSchema = z
  .object({
    schemaVersion: z.literal("fleet.action-effects.v1"),
    revision: id,
    intentDigest: z.string().regex(/^[a-f0-9]{64}$/),
    actionKey: id,
    claims: z.array(EffectClaimSchema).min(1).max(32),
    capacities: z.array(z.object({ schemaId: id, key: id, remainingUnits: units }).strict()).max(64),
    sourceRefs: z.array(z.string().min(1).max(8000)).min(1).max(100),
    validUntil: z.object({ clockId: id, value: id }).strict(),
    coverage: z.object({ complete: z.boolean(), omitted: z.array(z.string().max(1000)).max(100) }).strict(),
    supported: z.boolean(),
  })
  .strict();
export type ActionEffects = z.infer<typeof ActionEffectsSchema>;
export type EffectClaim = z.infer<typeof EffectClaimSchema>;
export const ActionEffectsGuardSchema = z
  .object({
    schemaVersion: z.literal("fleet.action-effects-guard.v1"),
    expectedRevision: id,
    expectedEffects: ActionEffectsSchema,
    reserveConstraints: z.record(z.enum(["iron", "silver", "grain"]), units).optional(),
  })
  .strict();
export type ActionEffectsGuard = z.infer<typeof ActionEffectsGuardSchema>;
export const ActionEffectsQuoteSchema = z.object({ command: AcceptedCommandEnvelopeSchema }).strict();
export const GuardedCommandSchema = ActionEffectsQuoteSchema.extend({ guard: ActionEffectsGuardSchema }).strict();
export const actionEffectsCoverage = [
  "game.message.send",
  "game.contact.request",
  "game.contact.answer",
  "game.building.queue",
  "game.training.queue",
  "game.supply.offer",
  "game.supply.counter",
  "game.supply.sign",
] as const;
export const pactActionEffectsQuoteTool = {
  name: "pact_action_effects_quote_v1",
  description:
    "Read complete owner-local action claims and an authoritative dependency guard. No action, reservation or consent is granted.",
  inputSchema: z.toJSONSchema(ActionEffectsQuoteSchema, { target: "draft-7" }),
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
};
export const pactActionEffectsExecuteTool = {
  name: "pact_action_effects_execute_v1",
  description:
    "Submit the exact guarded command through normal authority, lease, state and receipt admission. A receipt is not fulfillment.",
  inputSchema: z.toJSONSchema(GuardedCommandSchema, { target: "draft-7" }),
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
};
