import { z } from "zod";

const integer = z.string().regex(/^\d{1,20}$/);
export const AgentEventQuerySchema = z
  .object({ cursor: z.string().min(1).max(2048).optional(), limit: z.number().int().min(1).max(50).default(20) })
  .strict();
export const AgentEventMetadataSchema = z
  .object({
    category: z.enum(["completion", "conversation", "contact", "offer", "contract", "raid", "resource"]),
    groupRef: z.string().min(1).max(200),
    recordRef: z.string().min(1).max(200),
    quiet: z.boolean().optional(),
  })
  .strict();
export const AgentEventCardSchema = z
  .object({
    sequence: integer,
    eventId: z.uuid(),
    type: z.string().min(1).max(96),
    sourceRef: z.string().max(200),
    occurredAt: z.iso.datetime(),
    publishedAt: z.iso.datetime(),
    gameTime: integer,
    deadline: z
      .object({ gameTime: integer, kind: z.string().max(64) })
      .strict()
      .optional(),
    metadata: AgentEventMetadataSchema,
  })
  .strict();
export const AgentEventPageSchema = z
  .object({
    schemaVersion: z.literal("pact.agent-events.v1"),
    events: z.array(AgentEventCardSchema).max(50),
    nextCursor: z.string().max(2048).nullable(),
    resyncRequired: z.boolean(),
    resumeFrom: z.string().max(2048).optional(),
  })
  .strict();
export type AgentEventCard = z.infer<typeof AgentEventCardSchema>;
export type AgentEventPage = z.infer<typeof AgentEventPageSchema>;
export const pactAgentEventsTool = {
  name: "pact_agent_events_v1",
  description:
    "Read authorized metadata events in publication order. Does not acknowledge messages, grant authority, start inference or enroll event waking. On a gap read a fresh owner snapshot before resuming.",
  inputSchema: {
    type: "object",
    properties: {
      cursor: { type: "string", maxLength: 2048 },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
    },
    additionalProperties: false,
  },
} as const;
