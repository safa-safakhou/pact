import { z } from "zod";

export const MemorySourceSchema = z
  .object({
    kind: z.enum([
      "message",
      "supply-offer",
      "supply-contract",
      "garrison-offer",
      "garrison-contract",
      "raid",
      "scout",
      "building",
      "receipt",
    ]),
    id: z.uuid(),
    version: z.number().int().positive().optional(),
  })
  .strict()
  .refine((v) => v.version === undefined || v.kind === "supply-offer" || v.kind === "garrison-offer", {
    message: "Only offer sources have term versions.",
  });
export const MemoryKindSchema = z.enum(["assessment", "strategy", "goal", "milestone", "question"]);
export const MemoryWriteSchema = z
  .object({
    schemaVersion: z.literal("pact.memory-command.v2"),
    commandId: z.uuid(),
    entryId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
    kind: MemoryKindSchema,
    topic: z.string().min(1).max(80),
    peerKingdomId: z.uuid().nullable().optional(),
    text: z.string().max(8000),
    sources: z.array(MemorySourceSchema).max(8),
    deleted: z.boolean().default(false),
  })
  .strict()
  .refine((v) => v.deleted || v.text.length > 0, { message: "A retained note requires text." })
  .refine((v) => new Set(v.sources.map((s) => `${s.kind}:${s.id}:${s.version ?? ""}`)).size === v.sources.length, {
    message: "Source pointers must be distinct.",
  });
export const MemoryReadSchema = z
  .object({
    peerKingdomId: z.uuid().optional(),
    topic: z.string().max(80).optional(),
    kind: MemoryKindSchema.optional(),
    beforeGameTimeMs: z
      .string()
      .regex(/^[0-9]{1,18}$/)
      .optional(),
    beforeEntryId: z.uuid().optional(),
    entryId: z.uuid().optional(),
    beforeVersion: z.number().int().positive().optional(),
  })
  .strict()
  .refine((v) => Boolean(v.beforeGameTimeMs) === Boolean(v.beforeEntryId), {
    message: "Both cursor fields are required.",
  })
  .refine((v) => v.beforeVersion === undefined || v.entryId !== undefined, {
    message: "Version history requires an entry.",
  })
  .refine(
    (v) =>
      !v.entryId ||
      [v.peerKingdomId, v.topic, v.kind, v.beforeGameTimeMs, v.beforeEntryId].every((x) => x === undefined),
    {
      message: "Entry history and list filters/cursors are separate reads.",
    },
  );
export const pactMemoryReadTool = {
  name: "pact_private_memory_read_v2",
  description:
    "Read your private authored notes and revisions. Assessments are not facts or authority. Sources use their existing authorized readers; omitted notes remain pageable.",
  inputSchema: {
    type: "object",
    properties: {
      peerKingdomId: { type: "string", format: "uuid" },
      topic: { type: "string", maxLength: 80 },
      kind: { type: "string", enum: MemoryKindSchema.options },
      beforeGameTimeMs: { type: "string", pattern: "^[0-9]{1,18}$" },
      beforeEntryId: { type: "string", format: "uuid" },
      entryId: { type: "string", format: "uuid" },
      beforeVersion: { type: "integer", minimum: 1 },
    },
    additionalProperties: false,
  },
} as const;
export const pactMemoryWriteTool = {
  name: "pact_private_memory_write_v2",
  description:
    "Save a concise private note, not hidden reasoning. Cannot change objectives, facts or permissions. Retries use the original command/payload; expectedVersion prevents lost edits.",
  inputSchema: {
    type: "object",
    properties: {
      schemaVersion: { type: "string", const: "pact.memory-command.v2" },
      commandId: { type: "string", format: "uuid" },
      entryId: { type: "string", format: "uuid" },
      expectedVersion: { type: "integer", minimum: 0 },
      kind: { type: "string", enum: MemoryKindSchema.options },
      topic: { type: "string", minLength: 1, maxLength: 80 },
      peerKingdomId: { type: ["string", "null"], format: "uuid" },
      text: { type: "string", maxLength: 8000 },
      sources: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: [
                "message",
                "supply-offer",
                "supply-contract",
                "garrison-offer",
                "garrison-contract",
                "raid",
                "scout",
                "building",
                "receipt",
              ],
            },
            id: { type: "string", format: "uuid" },
            version: { type: "integer", minimum: 1 },
          },
          required: ["kind", "id"],
          additionalProperties: false,
        },
      },
      deleted: { type: "boolean", default: false },
    },
    required: ["schemaVersion", "commandId", "entryId", "expectedVersion", "kind", "topic", "text", "sources"],
    additionalProperties: false,
  },
} as const;
export const pactMemorySourceTool = {
  name: "pact_private_memory_source_v2",
  description:
    "Reauthorize a private note's source pointer and return retained participant metadata and its existing read tool. No copied transcript, acknowledgement or new access grant.",
  inputSchema: z.toJSONSchema(MemorySourceSchema, { target: "draft-7", unrepresentable: "any" }),
} as const;
