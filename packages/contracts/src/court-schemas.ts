import { z } from "zod";

const handle = z.string().regex(/^[a-z][a-z0-9_]{2,23}$/);
// biome-ignore lint/suspicious/noControlCharactersInRegex: reject controls while permitting ordinary multiline prose.
const publicProse = /^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/;
const text = (max: number) => z.string().min(1).max(max).regex(publicProse);
const mode = z.enum(["open", "request", "invitation_only"]);
export const CourtCommandSchema = z
  .object({
    schemaVersion: z.literal("pact.court-command.v1"),
    commandId: z.uuid(),
    action: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("court.create"),
          handle,
          title: text(60),
          description: z.string().max(1200).regex(publicProse),
          joinMode: mode,
        })
        .strict(),
      z
        .object({
          kind: z.literal("court.edit"),
          courtId: z.uuid(),
          expectedVersion: z.number().int().positive(),
          title: text(60),
          description: z.string().max(1200).regex(publicProse),
          joinMode: mode,
        })
        .strict(),
      z.object({ kind: z.literal("court.join"), courtId: z.uuid() }).strict(),
      z.object({ kind: z.literal("court.request"), courtId: z.uuid() }).strict(),
      z.object({ kind: z.literal("court.cancel-request"), courtId: z.uuid() }).strict(),
      z.object({ kind: z.literal("court.leave"), courtId: z.uuid() }).strict(),
      z.object({ kind: z.literal("court.close"), courtId: z.uuid() }).strict(),
      z
        .object({
          kind: z.literal("court.answer-request"),
          courtId: z.uuid(),
          kingdomId: z.uuid(),
          accept: z.boolean(),
        })
        .strict(),
      z.object({ kind: z.literal("court.remove"), courtId: z.uuid(), kingdomId: z.uuid() }).strict(),
      z
        .object({
          kind: z.literal("court.role"),
          courtId: z.uuid(),
          kingdomId: z.uuid(),
          role: z.enum(["member", "moderator"]),
        })
        .strict(),
      z.object({ kind: z.literal("court.transfer-propose"), courtId: z.uuid(), kingdomId: z.uuid() }).strict(),
      z
        .object({
          kind: z.literal("court.transfer-answer"),
          courtId: z.uuid(),
          proposalId: z.uuid(),
          accept: z.boolean(),
        })
        .strict(),
      z
        .object({
          kind: z.literal("court.pin"),
          courtId: z.uuid(),
          slot: z.number().int().min(1).max(3),
          body: text(1200),
        })
        .strict(),
      z.object({ kind: z.literal("court.unpin"), courtId: z.uuid(), slot: z.number().int().min(1).max(3) }).strict(),
    ]),
  })
  .strict();
export type CourtCommand = z.infer<typeof CourtCommandSchema>;
export const CourtReadQuerySchema = z
  .object({
    handle: z
      .string()
      .regex(/^[a-zA-Z][a-zA-Z0-9_]{2,23}$/)
      .optional(),
    offset: z.number().int().min(0).max(1000000).default(0),
  })
  .strict();
