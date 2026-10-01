import { z } from "zod";

const token = z.string().regex(/^[A-Za-z0-9_-]{32}$/);
/** Additive human social commands; the published gameplay v1 contracts remain unchanged. */
export const SocialCommandSchema = z
  .object({
    schemaVersion: z.literal("pact.social-command.v1"),
    commandId: z.uuid(),
    action: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("invitation.issue"),
          destinationType: z.enum(["contact", "court", "notice", "story"]),
          destinationId: z.uuid(),
          redemptionLimit: z.number().int().min(1).max(10000).optional(),
        })
        .strict(),
      z.object({ kind: z.literal("invitation.revoke"), invitationId: z.uuid() }).strict(),
      z.object({ kind: z.literal("invitation.remember"), token }).strict(),
      z.object({ kind: z.literal("invitation.accept"), token }).strict(),
      z.object({ kind: z.literal("invitation.accept-remembered") }).strict(),
    ]),
  })
  .strict();
export type SocialCommand = z.infer<typeof SocialCommandSchema>;
