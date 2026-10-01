import { z } from "zod";

// biome-ignore lint/suspicious/noControlCharactersInRegex: reject controls, permitting multiline player prose.
const prose = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/;
const text = (max: number) =>
  z
    .string()
    .min(1)
    .max(max * 2)
    .regex(prose)
    .refine((value) => [...value].length <= max);
export const PoliticsCommandSchema = z
  .object({
    schemaVersion: z.literal("pact.politics-command.v1"),
    commandId: z.uuid(),
    action: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("article.publish"), title: text(60), body: text(1200) }).strict(),
      z
        .object({
          kind: z.literal("article.replace"),
          articleId: z.uuid(),
          expectedVersion: z.number().int().positive(),
          title: text(60),
          body: text(1200),
        })
        .strict(),
      z
        .object({
          kind: z.literal("article.withdraw"),
          articleId: z.uuid(),
          expectedVersion: z.number().int().positive(),
        })
        .strict(),
      z
        .object({ kind: z.literal("allegiance.propose"), subjectKingdomId: z.uuid(), patronKingdomId: z.uuid() })
        .strict(),
      z
        .object({
          kind: z.literal("allegiance.revise"),
          proposalId: z.uuid(),
          expectedVersion: z.number().int().positive(),
          subjectKingdomId: z.uuid(),
          patronKingdomId: z.uuid(),
        })
        .strict(),
      z
        .object({
          kind: z.literal("allegiance.answer"),
          proposalId: z.uuid(),
          expectedVersion: z.number().int().positive(),
          accept: z.boolean(),
        })
        .strict(),
      z
        .object({
          kind: z.literal("allegiance.end"),
          edgeId: z.uuid(),
          subjectKingdomId: z.uuid(),
          expectedVersion: z.number().int().positive(),
        })
        .strict(),
    ]),
  })
  .strict();
export type PoliticsCommand = z.infer<typeof PoliticsCommandSchema>;
export const PoliticsReadQuerySchema = z
  .object({
    handle: z
      .string()
      .regex(/^[a-zA-Z][a-zA-Z0-9_]{2,23}$/)
      .optional(),
    offset: z.number().int().min(0).max(1000000).default(0),
  })
  .strict();
