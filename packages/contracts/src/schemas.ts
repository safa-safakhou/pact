import { z } from "zod";

export const SCHEMA_VERSION = "pact.command.v1" as const;
export const EVENT_SCHEMA_VERSION = "pact.event.v1" as const;
export const API_VERSION = "pact.api.v1" as const;

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
    asset: z.enum(["iron", "silver", "grain", "ore", "influence", "gems"]),
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

const gameResource = z.enum(["iron", "silver", "grain"]);
const supplyFlow = z.object({ resource: gameResource, wholePerHour: z.number().int().positive() }).strict();
const supplyBond = z.object({ resource: gameResource, wholeAmount: z.number().int().positive() }).strict();
const supplyTerms = z
  .object({
    aToB: supplyFlow.nullable(),
    bToA: supplyFlow.nullable(),
    aBond: supplyBond.nullable(),
    bBond: supplyBond.nullable(),
    durationHours: z.union([z.literal(1), z.literal(6), z.literal(24), z.literal(72)]),
    noticeHours: z.union([z.literal(0), z.literal(1), z.literal(6)]),
  })
  .strict();
const garrisonTerms = z
  .object({
    units: z
      .array(
        z.object({ type: z.enum(["spearman", "archer", "rider", "ram"]), count: z.number().int().positive() }).strict(),
      )
      .min(1)
      .max(4),
    durationHours: z.union([z.literal(1), z.literal(6), z.literal(24)]),
    lenderBond: supplyBond.nullable(),
    hostBond: supplyBond.nullable(),
  })
  .strict();
const raidUnits = z
  .array(
    z
      .object({
        type: z.enum(["spearman", "archer", "rider", "ram"]),
        count: z.number().int().positive().max(40),
        explicitIds: z.array(z.uuid()).min(1).max(40).optional(),
      })
      .strict(),
  )
  .min(1)
  .max(4);
export const ColdContactActionSchema = z
  .object({
    kind: z.literal("game.contact.request"),
    recipientKingdomId: z.uuid(),
    note: z.string().min(1).max(1_000),
    mandateVersion: z.number().int().nonnegative().optional(),
  })
  .strict();

export const DirectTransferActionSchema = z
  .object({
    kind: z.literal("game.transfer"),
    recipientKingdomId: z.uuid(),
    resource: gameResource,
    wholeAmount: z.number().int().positive().max(1_000_000_000),
    mandateVersion: z.number().int().nonnegative().optional(),
  })
  .strict();

export const TrainingQueueActionSchema = z
  .object({
    kind: z.literal("game.training.queue"),
    type: z.enum(["spearman", "archer", "rider", "ram"]),
    count: z.number().int().min(1).max(40),
    mandateVersion: z.number().int().nonnegative().optional(),
  })
  .strict();

export const BuildingQueueActionSchema = z
  .object({
    kind: z.literal("game.building.queue"),
    building: z.enum(["hall", "farm", "mine", "market", "storehouse", "barracks", "wall"]),
    targetLevel: z.number().int().min(2).max(6),
    slot: z.union([z.literal(1), z.literal(2)]),
    mandateVersion: z.number().int().nonnegative().optional(),
  })
  .strict();

export const ScoutStartActionSchema = z
  .object({
    kind: z.literal("game.scout.start"),
    targetKingdomId: z.uuid(),
    unitIds: z.array(z.uuid()).length(2).optional(),
  })
  .strict();

export const ApprovalProposalSchema = z
  .object({
    commandId: z.uuid(),
    action: z.discriminatedUnion("kind", [
      ColdContactActionSchema,
      DirectTransferActionSchema,
      TrainingQueueActionSchema,
      BuildingQueueActionSchema,
      ScoutStartActionSchema,
    ]),
  })
  .strict();

export const GameActionSchema = z.discriminatedUnion("kind", [
  ColdContactActionSchema,
  z.object({ kind: z.literal("game.contact.answer"), requestId: z.uuid(), accept: z.boolean() }).strict(),
  z
    .object({ kind: z.literal("game.message.send"), recipientKingdomId: z.uuid(), body: z.string().min(1).max(4_000) })
    .strict(),
  DirectTransferActionSchema,
  TrainingQueueActionSchema,
  z.object({ kind: z.literal("game.training.cancel"), batchId: z.uuid() }).strict(),
  z.object({ kind: z.literal("game.troop.disband"), troopId: z.uuid() }).strict(),
  BuildingQueueActionSchema,
  z.object({ kind: z.literal("game.building.cancel"), instructionId: z.uuid() }).strict(),
  z
    .object({
      kind: z.literal("game.supply.offer"),
      counterpartyKingdomId: z.uuid(),
      terms: supplyTerms,
      expiryMinutes: z.number().int().min(5).max(60).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("game.supply.counter"),
      offerId: z.uuid(),
      expectedVersion: z.number().int().positive(),
      terms: supplyTerms,
      expiryMinutes: z.number().int().min(5).max(60).optional(),
    })
    .strict(),
  z.object({ kind: z.literal("game.supply.sign"), offerId: z.uuid(), version: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal("game.supply.withdraw"), offerId: z.uuid() }).strict(),
  z
    .object({
      kind: z.literal("game.supply.notice"),
      contractId: z.uuid(),
      mandateVersion: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("game.supply.refuse"),
      contractId: z.uuid(),
      mandateVersion: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("game.supply.release"),
      contractId: z.uuid(),
      mandateVersion: z.number().int().nonnegative().optional(),
    })
    .strict(),
  ScoutStartActionSchema,
  z.object({ kind: z.literal("game.scout.share"), operationId: z.uuid(), recipientKingdomId: z.uuid() }).strict(),
  z
    .object({
      kind: z.literal("game.garrison.offer"),
      hostKingdomId: z.uuid(),
      terms: garrisonTerms,
      expiryMinutes: z.number().int().min(5).max(60).optional(),
    })
    .strict(),
  z.object({ kind: z.literal("game.garrison.sign"), offerId: z.uuid(), version: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal("game.garrison.withdraw"), offerId: z.uuid() }).strict(),
  z.object({ kind: z.literal("game.garrison.seize"), contractId: z.uuid() }).strict(),
  z
    .object({
      kind: z.literal("game.garrison.exit"),
      contractId: z.uuid(),
      mandateVersion: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("game.garrison.release"),
      contractId: z.uuid(),
      mandateVersion: z.number().int().nonnegative().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("game.raid.declare"),
      targetKingdomId: z.uuid(),
      units: raidUnits,
      lootPriority: z.array(gameResource).length(3).optional(),
      nominees: z.array(z.uuid()).max(2).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("game.raid.nominate"),
      raidId: z.uuid(),
      slot: z.union([z.literal(1), z.literal(2)]),
      kingdomId: z.uuid(),
    })
    .strict(),
  z.object({ kind: z.literal("game.raid.accept"), raidId: z.uuid(), units: raidUnits }).strict(),
  z.object({ kind: z.literal("game.raid.withdraw"), raidId: z.uuid() }).strict(),
]);
export const CommandActionSchema = z.union([SandboxActionSchema, GameActionSchema]);
export type SandboxAction = z.infer<typeof SandboxActionSchema>;
export type GameAction = z.infer<typeof GameActionSchema>;

export const CommandEnvelopeSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    commandId: z.uuid(),
    actor: ActorContextSchema,
    expectedVersion: z.number().int().nonnegative().optional(),
    action: CommandActionSchema,
    submittedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

/** A provider's game tool is a strict subset of the shared command envelope. */
export const GameCommandEnvelopeSchema = CommandEnvelopeSchema.extend({ action: GameActionSchema });

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

export const ClientAudienceSchema = z.enum(["human", "agent"]);
export const AgentScopeSchema = z.enum(["world:read", "messages:write", "game:act"]);
export const ClientCapabilitySchema = z.enum([
  "command.submit",
  "receipt.read",
  "inbox.read",
  "inbox.subscribe",
  "approval.status",
  "approval.commit",
  "mcp.tools",
]);
export const CapabilityDocumentSchema = z
  .object({
    apiVersion: z.literal(API_VERSION),
    commandSchemaVersion: z.literal(SCHEMA_VERSION),
    eventSchemaVersion: z.literal(EVENT_SCHEMA_VERSION),
    audience: ClientAudienceSchema,
    capabilities: z.array(ClientCapabilitySchema),
    allowedScopes: z.array(AgentScopeSchema),
    mcpProtocolVersions: z.array(z.enum(["2025-11-25", "2025-06-18"])),
  })
  .strict();

export const ClientCertificationStatusSchema = z.enum(["certified", "fixture_only", "not_tested"]);
export const ClientCompatibilityEntrySchema = z
  .object({
    clientId: z.enum(["gemini-cli", "grok-external-tool-client"]),
    clientLabel: z.string().min(1),
    certificationStatus: ClientCertificationStatusSchema,
    modelApiSupport: z.boolean(),
    consumerAppInstallation: z.enum(["supported", "not_verified", "not_applicable"]),
    authentication: z.string().min(1),
    billing: z.string().min(1),
    capabilities: z.array(z.enum(["oauth", "read", "write", "approval", "revoke"])),
    readableSurfaces: z.array(z.string()),
    writableSurfaces: z.array(z.string()),
    testedClientVersion: z.string().nullable(),
    testedAt: z.iso.datetime().nullable(),
    evidence: z.array(z.string()),
    limitation: z.string().min(1),
  })
  .strict();
export const ClientCompatibilityDocumentSchema = z
  .object({
    generatedAt: z.iso.datetime(),
    entries: z.array(ClientCompatibilityEntrySchema),
  })
  .strict();

export const ToolCallSchema = z
  .object({
    name: z.enum(["sandbox.echo", "sandbox.counter.increment", "sandbox.draft.read", "sandbox.draft.write"]),
    arguments: z.record(z.string(), z.unknown()),
  })
  .strict();

/** Viewer identity is deliberately absent; every adapter supplies it from authentication. */
export const WorldViewQuerySchema = z
  .object({
    targetKingdomId: z.uuid(),
    forecastMinutes: z.number().int().min(1).max(60).default(60),
  })
  .strict();
export type WorldViewQuery = z.infer<typeof WorldViewQuerySchema>;

/** Record identity is supplied by the caller; visibility is resolved from authentication. */
export const ReportReadQuerySchema = z
  .object({
    kind: z.enum(["scout", "raid_participant", "raid_public"]),
    recordId: z.uuid(),
  })
  .strict();
export type ReportReadQuery = z.infer<typeof ReportReadQuerySchema>;

/** Both identifiers are looked up under the authenticated owner, never a caller-supplied account. */
export const ReceiptReadQuerySchema = z.object({ commandId: z.uuid() }).strict();
export const ApprovalStatusQuerySchema = z.object({ approvalId: z.uuid() }).strict();

/** Owner identity is supplied by the authenticated route or active run. */
export const InboxReadQuerySchema = z
  .object({
    cursor: z.string().max(20).regex(/^\d+$/).optional(),
    limit: z.number().int().min(1).max(5).default(5),
  })
  .strict();
export type InboxReadQuery = z.infer<typeof InboxReadQuerySchema>;

/** Owner identity is never an argument; at most five private messages are read per call. */
export const ConversationReadQuerySchema = z
  .object({
    counterpartyKingdomId: z.uuid(),
    limit: z.number().int().min(1).max(5).default(5),
  })
  .strict();
export type ConversationReadQuery = z.infer<typeof ConversationReadQuerySchema>;

export type ActorContext = z.infer<typeof ActorContextSchema>;
export type ProductScope = z.infer<typeof ProductScopeSchema>;
export type SubjectRef = z.infer<typeof SubjectRefSchema>;
export type CommandEnvelope = z.infer<typeof CommandEnvelopeSchema>;
export type CommandReceipt = z.infer<typeof CommandReceiptSchema>;
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;
export type EventCursor = z.infer<typeof EventCursorSchema>;
export type ClientAudience = z.infer<typeof ClientAudienceSchema>;
export type AgentScope = z.infer<typeof AgentScopeSchema>;
export type ClientCapability = z.infer<typeof ClientCapabilitySchema>;
export type CapabilityDocument = z.infer<typeof CapabilityDocumentSchema>;
export type ClientCompatibilityEntry = z.infer<typeof ClientCompatibilityEntrySchema>;
export type ClientCompatibilityDocument = z.infer<typeof ClientCompatibilityDocumentSchema>;

export function validateCommandForWeb(input: unknown): CommandEnvelope {
  return CommandEnvelopeSchema.parse(input);
}

export function validateCommandForMcp(input: unknown): CommandEnvelope {
  return CommandEnvelopeSchema.parse(input);
}

export function validateProviderToolCommand(input: unknown): CommandEnvelope {
  return CommandEnvelopeSchema.parse(input);
}

export function validateProviderGameCommand(input: unknown): CommandEnvelope & { action: GameAction } {
  return GameCommandEnvelopeSchema.parse(input);
}
