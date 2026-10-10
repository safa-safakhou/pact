import { z } from "zod";

const envelope = { schemaVersion: z.literal("pact.enrollment.v2"), commandId: z.uuid(), enrollmentId: z.uuid() };
export const EnrollmentCommandSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...envelope,
      kind: z.literal("enroll"),
      expectedVersion: z.literal(0),
      route: z.literal("api"),
      objective: z.string().min(1).max(4000),
      provider: z.string().min(1).max(80),
      model: z.string().min(1).max(160),
      credentialId: z.uuid(),
      deadlineAt: z.iso.datetime(),
      mode: z.enum(["periodic", "events"]),
      minIntervalMs: z.number().int().min(3600000).max(86400000),
      totalCallBudget: z.number().int().min(1).max(1000),
      totalTokenBudget: z.number().int().min(1).max(40000000),
      sliceCalls: z.number().int().min(1).max(20),
      sliceTokens: z.number().int().min(1).max(40000),
      sliceDurationMs: z.number().int().min(30000).max(900000),
      maxMessages: z.number().int().min(1).max(24),
      maxConversations: z.number().int().min(1).max(12),
    })
    .strict()
    .refine((v) => v.sliceCalls <= v.totalCallBudget && v.sliceTokens <= v.totalTokenBudget, {
      message: "One slice must fit the total budget.",
    }),
  z.object({ ...envelope, kind: z.literal("revoke"), expectedVersion: z.number().int().positive() }).strict(),
]);
export type EnrollmentCommand = z.infer<typeof EnrollmentCommandSchema>;
export const EnrollmentQuerySchema = z
  .object({ beforeAt: z.iso.datetime().optional(), beforeId: z.uuid().optional() })
  .strict()
  .refine((v) => Boolean(v.beforeAt) === Boolean(v.beforeId), { message: "A complete cursor is required." });
export type EnrollmentQuery = z.infer<typeof EnrollmentQuerySchema>;
