import { z } from "zod";

export const SCHEMA_VERSION = "pact.command.v1" as const;
export const EVENT_SCHEMA_VERSION = "pact.event.v1" as const;

const safeIdentifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);
export const ProductScopeSchema = safeIdentifier.brand("ProductScope");
export const SubjectRefSchema = z
  .object({
    type: z.enum(["account", "kingdom", "agent", "system"]),
    id: safeIdentifier,
  })
  .strict();

export const ActorContextSchema = z
  .object({
    principalId: safeIdentifier,
    productScope: ProductScopeSchema,
    audience: z.enum(["human", "agent", "service"]),
    subject: SubjectRefSchema,
    sessionId: safeIdentifier.optional(),
  })
  .strict();

export const AssetAmountSchema = z
  .object({
    asset: z.enum(["grain", "ore", "influence", "gems"]),
    units: z.string().regex(/^(0|[1-9][0-9]{0,17})$/, "units must be an unsigned base-10 integer string"),
  })
  .strict();

export const SandboxActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sandbox.echo"), message: z.string().min(1).max(500) }).strict(),
  z
    .object({
      kind: z.literal("sandbox.counter.increment"),
      counterId: safeIdentifier,
      amount: z.number().int().min(1).max(100),
    })
    .strict(),
  z.object({ kind: z.literal("sandbox.draft.read") }).strict(),
  z
    .object({
      kind: z.literal("sandbox.draft.write"),
      note: z.string().max(500),
    })
    .strict(),
]);

export const CommandEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    commandId: z.uuid(),
    actor: ActorContextSchema,
    expectedVersion: z.number().int().nonnegative().optional(),
    action: SandboxActionSchema,
    submittedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const ReceiptCodeSchema = z.enum([
  "COMMITTED",
  "ALREADY_COMMITTED",
  "APPROVAL_REQUIRED",
  "STALE_VERSION",
  "INSUFFICIENT_STOCK",
  "RESERVE_FLOOR",
  "UNIT_LOCKED",
  "RATE_LIMITED",
  "EXPIRED",
  "FORBIDDEN",
  "WORLD_PAUSED",
  "IDEMPOTENCY_CONFLICT",
  "INVALID_COMMAND",
]);

export const CommandReceiptSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    commandId: z.uuid(),
    code: ReceiptCodeSchema,
    committedEventIds: z.array(z.uuid()).max(100),
    recordVersions: z.record(safeIdentifier, z.number().int().nonnegative()),
    charged: z.array(AssetAmountSchema).max(20),
    approvalId: z.uuid().optional(),
    committedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();

export const EventEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(EVENT_SCHEMA_VERSION),
    eventId: z.uuid(),
    productScope: ProductScopeSchema,
    type: safeIdentifier,
    actor: SubjectRefSchema,
    audience: z.array(SubjectRefSchema).min(1).max(100),
    gameTime: z.number().int().nonnegative(),
    occurredAt: z.iso.datetime({ offset: true }),
    relatedRecordId: safeIdentifier,
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();

export const EventCursorSchema = z
  .object({
    schemaVersion: z.literal(EVENT_SCHEMA_VERSION),
    productScope: ProductScopeSchema,
    sequence: z.string().regex(/^(0|[1-9][0-9]{0,19})$/),
  })
  .strict();

export const ToolCallSchema = z
  .object({
    name: z.enum(["sandbox.echo", "sandbox.counter.increment", "sandbox.draft.read", "sandbox.draft.write"]),
    arguments: z.record(z.string(), z.unknown()),
  })
  .strict();

export type ActorContext = z.infer<typeof ActorContextSchema>;
export type ProductScope = z.infer<typeof ProductScopeSchema>;
export type SubjectRef = z.infer<typeof SubjectRefSchema>;
export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;
export type CommandReceipt = z.infer<typeof CommandReceiptSchema>;
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
export type EventCursor = z.infer<typeof EventCursorSchema>;

export function validateCommandForWeb(input: unknown): CommandEnvelope {
  return CommandEnvelopeSchema.parse(input);
}

export function validateCommandForMcp(input: unknown): CommandEnvelope {
  return CommandEnvelopeSchema.parse(input);
}

export function validateProviderToolCommand(input: unknown): CommandEnvelope {
  return CommandEnvelopeSchema.parse(input);
}
