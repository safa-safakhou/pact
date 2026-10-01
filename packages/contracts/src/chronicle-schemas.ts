import { z } from "zod";

// biome-ignore lint/suspicious/noControlCharactersInRegex: reject control characters in public prose, allowing multiline text.
const prose = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/;

const text = (max: number) =>
  z
    .string()
    .min(1)
    .max(max * 2)
    .regex(prose)
    .refine((v) => [...v].length <= max);
const common = {
  title: text(60),
  commentary: text(1200),
  courtHandle: z
    .string()
    .regex(/^[a-z][a-z0-9_]{2,23}$/)
    .optional(),
};
export const ChronicleSelectionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("notice"),
      ...common,
      durationHours: z.number().int().min(1).max(24),
      postId: z.uuid().optional(),
      expectedVersion: z.number().int().positive().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("story"),
      ...common,
      factCommandId: z.uuid(),
      sealIds: z.array(z.uuid()).max(3).default([]),
    })
    .strict(),
]);
export type ChronicleSelection = z.infer<typeof ChronicleSelectionSchema>;
export const ChronicleCommandSchema = z
  .object({
    schemaVersion: z.literal("pact.chronicle-command.v1"),
    commandId: z.uuid(),
    action: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("chronicle.publish"),
          selection: ChronicleSelectionSchema,
          previewDigest: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict(),
      z
        .object({ kind: z.literal("chronicle.remove"), postId: z.uuid(), expectedVersion: z.number().int().positive() })
        .strict(),
    ]),
  })
  .strict();
export type ChronicleCommand = z.infer<typeof ChronicleCommandSchema>;
export const ChronicleReadQuerySchema = z
  .object({
    postId: z.uuid().optional(),
    type: z.enum(["notice", "story"]).optional(),
    authorHandle: z
      .string()
      .regex(/^[a-z][a-z0-9_]{2,23}$/)
      .optional(),
    courtHandle: z
      .string()
      .regex(/^[a-z][a-z0-9_]{2,23}$/)
      .optional(),
    offset: z.number().int().min(0).max(100000).default(0),
  })
  .strict();
export type ChronicleReadQuery = z.infer<typeof ChronicleReadQuerySchema>;
