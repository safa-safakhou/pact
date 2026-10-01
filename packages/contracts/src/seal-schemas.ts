import { z } from "zod";

const ranges = z
  .array(
    z
      .object({
        start: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
        end: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      })
      .strict(),
  )
  .min(1)
  .max(20);
const fields = z
  .array(z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,63}$/))
  .min(1)
  .max(32);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const SealSelectionSchema = z.discriminatedUnion("recordType", [
  z.object({ recordType: z.literal("message"), recordId: z.uuid(), ranges: ranges.optional() }).strict(),
  z.object({ recordType: z.enum(["scout", "battle"]), recordId: z.uuid(), fields: fields.optional() }).strict(),
]);
export type SealSelection = z.infer<typeof SealSelectionSchema>;
export const SealCommandSchema = z
  .object({
    schemaVersion: z.literal("pact.seal-command.v1"),
    commandId: z.uuid(),
    action: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("seal.publish"), selection: SealSelectionSchema, previewDigest: digest }).strict(),
      z.object({ kind: z.literal("seal.remove"), sealId: z.uuid() }).strict(),
    ]),
  })
  .strict();
export type SealCommand = z.infer<typeof SealCommandSchema>;
export const SealReadQuerySchema = z.object({ sealId: z.uuid() }).strict();
