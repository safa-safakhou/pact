import { randomUUID } from "node:crypto";
import {
  AgentGameActionSchema,
  AgentGameActionV2Schema,
  AgentGuideQuerySchema,
  ApprovalProposalSchema,
  ApprovalProposalV2Schema,
  ApprovalStatusQuerySchema,
  type ChronicleReadQuery,
  ChronicleReadQuerySchema,
  type CommandReceipt,
  ConversationReadQuerySchema,
  CourtReadQuerySchema,
  DecisionSupportQuerySchema,
  type EnrollmentQuery,
  EnrollmentQuerySchema,
  InboxReadQuerySchema,
  type KingdomDiscoveryQuery,
  KingdomDiscoveryQuerySchema,
  MemoryReadSchema,
  MemorySourceSchema,
  MemoryWriteSchema,
  type ObservationSectionQuery,
  ObservationSectionQuerySchema,
  operationMetadata,
  operationValidationDetail,
  PlayerFindQuerySchema,
  PoliticsReadQuerySchema,
  ProductScopeSchema,
  pactAgentGuideTool,
  pactApprovalProposalTool,
  pactApprovalProposalV2Tool,
  pactApprovalStatusTool,
  pactChronicleReadTool,
  pactCommandOutcomeTool,
  pactConversationReadTool,
  pactCourtReadTool,
  pactDecisionSupportTool,
  pactEnvoyReportTool,
  pactGameActionTool,
  pactGameActionV2Tool,
  pactInboxReadTool,
  pactKingdomDiscoveryTool,
  pactMemoryReadTool,
  pactMemorySourceTool,
  pactMemoryWriteTool,
  pactObservationSectionTool,
  pactPlayerFindTool,
  pactPoliticsReadTool,
  pactProfileTool,
  pactReceiptReadTool,
  pactReportReadTool,
  pactSealReadTool,
  pactSeasonReadTool,
  pactWorldReadTool,
  ReceiptReadQuerySchema,
  ReportReadQuerySchema,
  RunReportQuerySchema,
  SCHEMA_VERSION,
  SealReadQuerySchema,
  SeasonReadQuerySchema,
  worldReadValidationHelp,
} from "@pact/contracts";
import { agentRecovery } from "./agent-recovery.js";
import { commandOutcome } from "./command-outcomes.js";
import type { CommandDispatcher } from "./dispatcher.js";
import type { AuthenticatedPrincipal } from "./types.js";

export interface AgentOperationOptions {
  readonly persistentPlay?: { read(accountId: string, query?: EnrollmentQuery): Promise<unknown> };
  readonly privateMemory?: {
    read(accountId: string, query: unknown): Promise<unknown>;
    source(accountId: string, query: unknown): Promise<unknown>;
    write(accountId: string, author: "agent", command: unknown): Promise<unknown>;
  };
  readonly decisionSupport?: {
    read(accountId: string, candidateId?: string, proposalOffset?: number): Promise<unknown | null>;
  };
  readonly playView?: {
    read(accountId: string, query?: { search: string; offset: number }): Promise<Record<string, unknown>>;
  };
  readonly councilThreads?: {
    read(accountId: string, peerId: string, before?: { gameTimeMs: string; id: string }): Promise<unknown>;
  };
  readonly conversationHistory?: {
    agreements(accountId: string, peerId: string, before?: { gameTimeMs: string; id: string }): Promise<unknown>;
    versions(accountId: string, peerId: string, offerId: string, beforeVersion: number): Promise<unknown>;
  };
  readonly notes?: {
    read(accountId: string): Promise<unknown>;
    write(accountId: string, text: string, expectedVersion: number): Promise<unknown>;
  };
  readonly productScope: string;
  readonly dispatcher: CommandDispatcher;
  readonly origin: string;
  readonly clock: { now(): Date };
  readonly worldViews?: WorldViewReader;
  readonly kingdomDiscovery?: { read(accountId: string, query: KingdomDiscoveryQuery): Promise<unknown> };
  readonly publicProfiles?: { read(handle: string): Promise<unknown | null> };
  readonly courts?: { read(handle: string | undefined, offset: number, accountId: string): Promise<unknown> };
  readonly politics?: { read(handle: string | undefined, offset: number, accountId: string): Promise<unknown> };
  readonly seals?: { read(sealId: string, accountId: string): Promise<unknown> };
  readonly chronicle?: { read(query: ChronicleReadQuery, accountId: string): Promise<unknown> };
  readonly runReports?: { read(runId: string | undefined, accountId: string): Promise<unknown> };
  readonly seasons?: {
    read(query: { cohortStartGameTimeMs?: number | undefined }, accountId: string): Promise<unknown>;
  };
  readonly agentGuide?: AgentGuidePort;
  readonly profile?: ProfileReader;
  readonly reports?: ReportReader;
  readonly inbox?: InboxReader;
  readonly conversations?: ConversationReaderPort;
  readonly approvals?: ApprovalStatusPort;
  readonly approvalProposals?: ApprovalProposalPort;
  readonly runLeases?: {
    openMcpLease(input: { accountId: string; holderId: string }): Promise<{ leaseId: string; expiresAt: Date }>;
    releaseMcpLease(input: { accountId: string; holderId: string }): Promise<void>;
  };
}

/** Domain-owned projection behind a product-neutral MCP read port. */
export interface WorldViewReader {
  read(accountId: string, targetKingdomId: string, forecastMinutes: number): Promise<unknown>;
  readSelf?(accountId: string, forecastMinutes: number): Promise<unknown>;
}

/** Product-owned owner projection and learning guide; MCP never accepts a caller-supplied account. */
export interface AgentGuidePort {
  readRecords?(accountId: string, records: string[]): Promise<unknown[]>;
  readSection?(accountId: string, query: ObservationSectionQuery): Promise<Record<string, unknown>>;
  read(
    accountId: string,
    topic: "start" | "development" | "diplomacy" | "military" | "authority",
  ): Promise<Record<string, unknown>>;
}

/** Product-owned display label; stable account identity comes from the validated grant. */
export interface ProfileReader {
  read(accountId: string): Promise<{ nickname?: string }>;
}

/** Product-owned authorization behind a product-neutral MCP read port. */
export interface ReportReader {
  read(
    accountId: string,
    kind: "scout" | "raid_participant" | "raid_public",
    recordId: string,
  ): Promise<unknown | null>;
}

/** Owner identity is supplied by MCP authentication, never tool arguments. */
export interface InboxReader {
  readBounded(accountId: string, cursor: string | undefined, limit: number): Promise<unknown>;
}

/** Domain-owned direct-message projection; identity comes only from the MCP grant. */
export interface ConversationReaderPort {
  read(accountId: string, counterpartyKingdomId: string, limit: number): Promise<unknown | null>;
}

/** Approval status is a read-only, owner-scoped port; commits stay human-only. */
export interface ApprovalStatusPort {
  read(accountId: string, approvalId: string): Promise<unknown | null>;
}

/** Proposals may request human review; this port never executes approval. */
export interface ApprovalProposalPort {
  proposeAgent(
    principal: AuthenticatedPrincipal,
    proposal: unknown,
  ): Promise<{
    approvalId: string;
    deepLinkPath: string;
    effectsSummary: string;
    expiresAt: Date;
  }>;
}

export class AgentOperationError extends Error {
  constructor(
    readonly code: "FORBIDDEN" | "INVALID_REQUEST" | "RUN_ALREADY_ACTIVE" | "STALE_OBSERVATION",
    readonly httpStatus = 400,
    readonly detail?: Record<string, unknown>,
  ) {
    super(code);
  }
}
function receiptToolResult(receipt: CommandReceipt, ownerAccountId: string) {
  const denied = receipt.code !== "COMMITTED" && receipt.code !== "ALREADY_COMMITTED";
  return {
    content: [
      { type: "text", text: JSON.stringify(receipt) },
      ...(denied ? [{ type: "text", text: agentRecovery(receipt.code) }] : []),
    ],
    structuredContent: receipt,
    _meta: { "pact/reference": { type: "Receipt", id: receipt.commandId, ownerAccountId, status: receipt.code } },
    ...(denied ? { isError: true } : {}),
  };
}

/** Shared canonical agent operations; protocol adapters own authentication and session/context binding. */
export class AgentOperationService {
  constructor(private readonly options: AgentOperationOptions) {}
  /** Plain shared schemas for protocol clients, scoped to the installed read/write ports. */
  listOperations(principal: AuthenticatedPrincipal) {
    if (principal.audience !== "agent" || principal.productScope !== this.options.productScope)
      throw new AgentOperationError("FORBIDDEN", 403);
    const read = principal.agentScopes?.includes("world:read"),
      act = principal.agentScopes?.includes("game:act");
    const candidates = [
      [this.options.worldViews, pactWorldReadTool],
      [this.options.kingdomDiscovery, pactKingdomDiscoveryTool],
      [this.options.publicProfiles, pactPlayerFindTool],
      [this.options.profile, pactProfileTool],
      [this.options.agentGuide, pactAgentGuideTool],
      [this.options.agentGuide?.readSection, pactObservationSectionTool],
      [this.options.courts, pactCourtReadTool],
      [this.options.politics, pactPoliticsReadTool],
      [this.options.seals, pactSealReadTool],
      [this.options.chronicle, pactChronicleReadTool],
      [this.options.runReports, pactEnvoyReportTool],
      [this.options.seasons, pactSeasonReadTool],
      [this.options.reports, pactReportReadTool],
      [this.options.inbox, pactInboxReadTool],
      [this.options.conversations, pactConversationReadTool],
      [this.options.approvals, pactApprovalStatusTool],
      [this.options.decisionSupport, pactDecisionSupportTool],
      [this.options.privateMemory, pactMemoryReadTool],
      [this.options.privateMemory, pactMemorySourceTool],
      [true, pactReceiptReadTool],
      [this.options.agentGuide?.readRecords, pactCommandOutcomeTool],
    ] as const;
    return [
      ...(read ? candidates.filter(([port]) => Boolean(port)).map(([, tool]) => tool) : []),
      ...(read && this.options.persistentPlay
        ? [
            {
              name: "pact_persistent_play_status_v2",
              description: "Read existing owner-consented enrollment; never start or renew it.",
              inputSchema: {
                type: "object",
                properties: {
                  beforeAt: { type: "string", format: "date-time" },
                  beforeId: { type: "string", format: "uuid" },
                },
                additionalProperties: false,
              },
            },
          ]
        : []),
      ...(act ? [pactGameActionV2Tool, pactGameActionTool] : []),
      ...(act && this.options.privateMemory ? [pactMemoryWriteTool] : []),
      ...(act && this.options.approvalProposals ? [pactApprovalProposalV2Tool, pactApprovalProposalTool] : []),
      ...(act && this.options.runLeases
        ? [
            {
              name: "run.open",
              description:
                "Open or renew this grant's fifteen-minute exclusive game write lease; no inference or enrollment.",
              inputSchema: { type: "object", properties: {}, additionalProperties: false },
            },
          ]
        : []),
    ].map(({ name, description, inputSchema }) => {
      const write = [
        "run.open",
        pactGameActionV2Tool.name,
        pactGameActionTool.name,
        pactMemoryWriteTool.name,
        pactApprovalProposalV2Tool.name,
        pactApprovalProposalTool.name,
      ].includes(name);
      return {
        name,
        description,
        inputSchema,
        _meta: { "pact/operation": operationMetadata(name, [write ? "game:act" : "world:read"], !write) },
      };
    });
  }
  async execute(
    principal: AuthenticatedPrincipal,
    params: Record<string, unknown>,
    sessionId?: string,
  ): Promise<Record<string, unknown>> {
    if (principal.audience !== "agent" || principal.productScope !== this.options.productScope) {
      throw new AgentOperationError("FORBIDDEN", 403);
    }
    const name = String(params.name ?? "");
    if (
      params.arguments !== undefined &&
      (params.arguments === null || typeof params.arguments !== "object" || Array.isArray(params.arguments))
    )
      throw new AgentOperationError("INVALID_REQUEST");
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    if (name === "pact_council_thread_v1") {
      if (!principal.agentScopes?.includes("world:read") || !this.options.councilThreads)
        throw new AgentOperationError("FORBIDDEN", 403);
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (
        Object.keys(args).some((k) => !["kingdomId", "beforeGameTimeMs", "beforeId"].includes(k)) ||
        typeof args.kingdomId !== "string" ||
        !uuid.test(args.kingdomId) ||
        Boolean(args.beforeId) !== Boolean(args.beforeGameTimeMs) ||
        (args.beforeId !== undefined && (typeof args.beforeId !== "string" || !uuid.test(args.beforeId))) ||
        (args.beforeGameTimeMs !== undefined &&
          (typeof args.beforeGameTimeMs !== "string" || !/^\d{1,18}$/.test(args.beforeGameTimeMs)))
      )
        throw new AgentOperationError("INVALID_REQUEST");
      const data = await this.options.councilThreads.read(
        principal.accountId,
        args.kingdomId,
        typeof args.beforeId === "string" && typeof args.beforeGameTimeMs === "string"
          ? { id: args.beforeId, gameTimeMs: args.beforeGameTimeMs }
          : undefined,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data), annotations: { audience: ["assistant"] } }],
        structuredContent: data,
      };
    }
    if (name === "pact_play_view_v1" || name === "pact_notes_read_v1") {
      if (!principal.agentScopes?.includes("world:read")) throw new AgentOperationError("FORBIDDEN", 403);
      const port = name === "pact_play_view_v1" ? this.options.playView : this.options.notes;
      if (!port) throw new AgentOperationError("FORBIDDEN", 403);
      if (name === "pact_notes_read_v1" && Object.keys(args).length) throw new AgentOperationError("INVALID_REQUEST");
      if (
        name === "pact_play_view_v1" &&
        (Object.keys(args).some((k) => !["search", "offset"].includes(k)) ||
          (args.search !== undefined && (typeof args.search !== "string" || args.search.length > 80)) ||
          (args.offset !== undefined &&
            (!Number.isSafeInteger(args.offset) || Number(args.offset) < 0 || Number(args.offset) > 10000)))
      )
        throw new AgentOperationError("INVALID_REQUEST");
      const result =
        name === "pact_play_view_v1"
          ? await this.options.playView?.read(principal.accountId, {
              search: String(args.search ?? ""),
              offset: Number(args.offset ?? 0),
            })
          : await this.options.notes?.read(principal.accountId);
      const data = { ...(result && typeof result === "object" ? result : { result }), untrustedContent: true };
      return {
        content: [{ type: "text", text: JSON.stringify(data), annotations: { audience: ["assistant"] } }],
        structuredContent: data,
      };
    }
    if (name === "pact_notes_write_v1") {
      if (!principal.agentScopes?.includes("game:act") || !this.options.notes)
        throw new AgentOperationError("FORBIDDEN", 403);
      if (
        Object.keys(args).some((k) => !["text", "expectedVersion"].includes(k)) ||
        typeof args.text !== "string" ||
        args.text.length > 8000 ||
        !Number.isSafeInteger(args.expectedVersion) ||
        Number(args.expectedVersion) < 1
      )
        throw new AgentOperationError("INVALID_REQUEST");
      const result = await this.options.notes.write(principal.accountId, args.text, Number(args.expectedVersion));
      const data = { ...(result && typeof result === "object" ? result : { result }), untrustedContent: true };
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
        structuredContent: data,
        ...("saved" in data && data.saved === false ? { isError: true } : {}),
      };
    }
    if (name === pactProfileTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.profile)
        throw new AgentOperationError("FORBIDDEN", 403);
      if (
        (params.arguments !== undefined &&
          (params.arguments === null || typeof params.arguments !== "object" || Array.isArray(params.arguments))) ||
        Object.keys(args).length !== 0
      )
        throw new AgentOperationError("INVALID_REQUEST");
      const details = await this.options.profile.read(principal.accountId);
      const profile = { id: principal.accountId, ...(details.nickname ? { nickname: details.nickname } : {}) };
      return {
        content: [{ type: "text", text: JSON.stringify(profile) }],
        structuredContent: profile,
        isError: false,
      };
    }
    if (name === pactObservationSectionTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.agentGuide?.readSection)
        throw new AgentOperationError("FORBIDDEN", 403);
      const query = ObservationSectionQuerySchema.safeParse(args);
      if (!query.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, query.error.issues));
      try {
        const result = await this.options.agentGuide.readSection(principal.accountId, query.data);
        return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? error.code : null;
        if (code === "FORBIDDEN" || code === "INVALID_REQUEST" || code === "STALE_OBSERVATION")
          throw new AgentOperationError(code, code === "FORBIDDEN" ? 403 : code === "STALE_OBSERVATION" ? 409 : 400, {
            schemaId: name,
          });
        throw error;
      }
    }
    if (name === pactAgentGuideTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.agentGuide)
        throw new AgentOperationError("FORBIDDEN", 403);
      const query = AgentGuideQuerySchema.safeParse(args);
      if (!query.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, query.error.issues));
      const guide = await this.options.agentGuide.read(principal.accountId, query.data.topic);
      return {
        content: [{ type: "text", text: JSON.stringify(guide) }],
        structuredContent: guide,
      };
    }
    if (name === "run.open") {
      if (
        !principal.agentScopes?.includes("game:act") ||
        !this.options.runLeases ||
        !sessionId ||
        Object.keys(args).length !== 0
      )
        throw new AgentOperationError("FORBIDDEN", 403);
      let lease: { leaseId: string; expiresAt: Date };
      try {
        lease = await this.options.runLeases.openMcpLease({ accountId: principal.accountId, holderId: sessionId });
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "RUN_ALREADY_ACTIVE")
          throw new AgentOperationError("RUN_ALREADY_ACTIVE", 409);
        throw error;
      }
      const result = { leaseId: lease.leaseId, expiresAt: lease.expiresAt.toISOString() };
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactKingdomDiscoveryTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.kingdomDiscovery)
        throw new AgentOperationError("FORBIDDEN", 403);
      const query = KingdomDiscoveryQuerySchema.safeParse(args);
      if (!query.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, query.error.issues));
      const result = await this.options.kingdomDiscovery.read(principal.accountId, query.data);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactPlayerFindTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.publicProfiles)
        throw new AgentOperationError("FORBIDDEN", 403);
      const query = PlayerFindQuerySchema.safeParse(args);
      if (!query.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, query.error.issues));
      const kingdom = await this.options.publicProfiles.read(query.data.handle);
      const result = { found: kingdom !== null, kingdom, untrustedContent: true };
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactCourtReadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.courts)
        throw new AgentOperationError("FORBIDDEN", 403);
      const query = CourtReadQuerySchema.safeParse(args);
      if (!query.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, query.error.issues));
      const result = await this.options.courts.read(query.data.handle, query.data.offset, principal.accountId);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactSealReadTool.name) {
      // Seal reads never expose original omitted evidence.
      if (!principal.agentScopes?.includes("world:read") || !this.options.seals)
        throw new AgentOperationError("FORBIDDEN", 403);
      const query = SealReadQuerySchema.safeParse(args);
      if (!query.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, query.error.issues));
      const result = await this.options.seals.read(query.data.sealId, principal.accountId);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactChronicleReadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.chronicle)
        throw new AgentOperationError("FORBIDDEN", 403);
      const query = ChronicleReadQuerySchema.safeParse(args);
      if (!query.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, query.error.issues));
      const result = await this.options.chronicle.read(query.data, principal.accountId);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactPoliticsReadTool.name) {
      // Political prose cannot grant authority.
      if (!principal.agentScopes?.includes("world:read") || !this.options.politics)
        throw new AgentOperationError("FORBIDDEN", 403);
      const query = PoliticsReadQuerySchema.safeParse(args);
      if (!query.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, query.error.issues));
      const result = await this.options.politics.read(query.data.handle, query.data.offset, principal.accountId);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactEnvoyReportTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.runReports)
        throw new AgentOperationError("FORBIDDEN", 403);
      const q = RunReportQuerySchema.safeParse(args);
      if (!q.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, q.error.issues));
      const result = await this.options.runReports.read(q.data.runId, principal.accountId);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactSeasonReadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.seasons)
        throw new AgentOperationError("FORBIDDEN", 403);
      const q = SeasonReadQuerySchema.safeParse(args);
      if (!q.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, q.error.issues));
      const result = await this.options.seasons.read(q.data, principal.accountId);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactWorldReadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.worldViews)
        throw new AgentOperationError("FORBIDDEN", 403);
      const parsed = worldReadValidationHelp(args);
      if (!parsed.valid) {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify(parsed.error) }],
          structuredContent: parsed.error,
        };
      }
      const query = { data: parsed.query };
      const view = query.data.targetKingdomId
        ? await this.options.worldViews.read(
            principal.accountId,
            query.data.targetKingdomId,
            query.data.forecastMinutes,
          )
        : await this.options.worldViews.readSelf?.(principal.accountId, query.data.forecastMinutes);
      if (!view) {
        const result = {
          code: "NOT_FOUND",
          receiptExists: false,
          message:
            "No authorized kingdom view is available. An unfounded owner must finish human signup and founding in PACT.",
        };
        return { isError: true, content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(view) }],
        structuredContent: view as Record<string, unknown>,
      };
    }
    if (name === pactReportReadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.reports)
        throw new AgentOperationError("FORBIDDEN", 403);
      const query = ReportReadQuerySchema.safeParse(args);
      if (!query.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, query.error.issues));
      const report = await this.options.reports.read(principal.accountId, query.data.kind, query.data.recordId);
      if (!report) throw new AgentOperationError("INVALID_REQUEST", 404);
      return {
        content: [{ type: "text", text: JSON.stringify(report) }],
        structuredContent: report as Record<string, unknown>,
      };
    }
    if (name === pactInboxReadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.inbox)
        throw new AgentOperationError("FORBIDDEN", 403);
      const query = InboxReadQuerySchema.safeParse(args);
      if (!query.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, query.error.issues));
      const page = await this.options.inbox.readBounded(principal.accountId, query.data.cursor, query.data.limit);
      return {
        content: [{ type: "text", text: JSON.stringify(page) }],
        structuredContent: page as Record<string, unknown>,
      };
    }
    if (name === pactMemoryReadTool.name || name === pactMemoryWriteTool.name || name === pactMemorySourceTool.name) {
      const write = name === pactMemoryWriteTool.name;
      if (!this.options.privateMemory || !principal.agentScopes?.includes(write ? "game:act" : "world:read"))
        throw new AgentOperationError("FORBIDDEN", 403);
      const parsed = (
        write ? MemoryWriteSchema : name === pactMemorySourceTool.name ? MemorySourceSchema : MemoryReadSchema
      ).safeParse(args);
      if (!parsed.success) throw new AgentOperationError("INVALID_REQUEST", 400);
      let data: Record<string, unknown>;
      try {
        const result = write
          ? await this.options.privateMemory.write(principal.accountId, "agent", parsed.data)
          : name === pactMemorySourceTool.name
            ? await this.options.privateMemory.source(principal.accountId, parsed.data)
            : await this.options.privateMemory.read(principal.accountId, parsed.data);
        data = { ...((result as Record<string, unknown>) ?? { code: "SOURCE_UNAVAILABLE" }), untrustedContent: true };
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
        if (
          typeof code !== "string" ||
          ![
            "FORBIDDEN",
            "SOURCE_UNAVAILABLE",
            "STALE_VERSION",
            "OPERATION_CONFLICT",
            "PRIVATE_MEMORY_FULL",
            "NOTE_TOO_LARGE",
          ].includes(code)
        )
          throw error;
        data = { code };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
        structuredContent: data,
        ...(data.code && !["COMMITTED", "ALREADY_COMMITTED"].includes(String(data.code)) ? { isError: true } : {}),
      };
    }
    if (name === "pact_persistent_play_status_v2") {
      if (!this.options.persistentPlay || !principal.agentScopes?.includes("world:read"))
        throw new AgentOperationError("FORBIDDEN", 403);
      const query = EnrollmentQuerySchema.safeParse(args);
      if (!query.success) throw new AgentOperationError("INVALID_REQUEST", 400);
      const data = (await this.options.persistentPlay.read(principal.accountId, query.data)) as Record<string, unknown>;
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
    }
    if (name === pactDecisionSupportTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.decisionSupport)
        throw new AgentOperationError("FORBIDDEN", 403);
      const query = DecisionSupportQuerySchema.safeParse(args);
      if (!query.success) throw new AgentOperationError("INVALID_REQUEST", 400);
      const result = await this.options.decisionSupport.read(
        principal.accountId,
        query.data.candidateId,
        query.data.proposalOffset,
      );
      const data = result ?? { code: "NOT_FOUND" };
      return {
        content: [{ type: "text", text: JSON.stringify(data) }],
        structuredContent: data as Record<string, unknown>,
      };
    }
    if (name === "pact_conversation_history_v2") {
      if (!principal.agentScopes?.includes("world:read") || !this.options.conversationHistory)
        throw new AgentOperationError("FORBIDDEN", 403);
      const peer = args?.kingdomId,
        before = args?.beforeGameTimeMs,
        beforeId = args?.beforeId,
        offerId = args?.offerId,
        beforeVersion = args?.beforeVersion;
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (
        typeof peer !== "string" ||
        !uuid.test(peer) ||
        Boolean(before) !== Boolean(beforeId) ||
        Boolean(offerId) !== Boolean(beforeVersion) ||
        Object.keys(args ?? {}).some(
          (k) => !["kingdomId", "beforeGameTimeMs", "beforeId", "offerId", "beforeVersion"].includes(k),
        )
      )
        throw new AgentOperationError("INVALID_REQUEST");
      if (
        before !== undefined &&
        (typeof before !== "string" ||
          !/^\d{1,18}$/.test(before) ||
          typeof beforeId !== "string" ||
          !uuid.test(beforeId))
      )
        throw new AgentOperationError("INVALID_REQUEST");
      if (
        offerId !== undefined &&
        (typeof offerId !== "string" ||
          !uuid.test(offerId) ||
          typeof beforeVersion !== "number" ||
          !Number.isSafeInteger(beforeVersion) ||
          beforeVersion < 1 ||
          before !== undefined)
      )
        throw new AgentOperationError("INVALID_REQUEST");
      const result =
        typeof offerId === "string" && typeof beforeVersion === "number"
          ? await this.options.conversationHistory.versions(principal.accountId, peer, offerId, beforeVersion)
          : await this.options.conversationHistory.agreements(
              principal.accountId,
              peer,
              typeof before === "string" && typeof beforeId === "string"
                ? { id: beforeId, gameTimeMs: before }
                : undefined,
            );
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactConversationReadTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.conversations)
        throw new AgentOperationError("FORBIDDEN", 403);
      const query = ConversationReadQuerySchema.safeParse(args);
      if (!query.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, query.error.issues));
      const page = await this.options.conversations.read(
        principal.accountId,
        query.data.counterpartyKingdomId,
        query.data.limit,
      );
      if (!page) throw new AgentOperationError("INVALID_REQUEST", 404);
      return {
        content: [{ type: "text", text: JSON.stringify(page) }],
        structuredContent: page as Record<string, unknown>,
      };
    }
    if (name === pactCommandOutcomeTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.agentGuide?.readRecords)
        throw new AgentOperationError("FORBIDDEN", 403);
      const query = ReceiptReadQuerySchema.safeParse(args);
      if (!query.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, query.error.issues));
      const receipt = await this.options.dispatcher.lookupReceipt(principal, query.data.commandId);
      const lifecycle = receipt
        ? await this.options.agentGuide.readRecords(principal.accountId, Object.keys(receipt.recordVersions))
        : [];
      const result = commandOutcome(query.data.commandId, receipt, lifecycle);
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (name === pactReceiptReadTool.name) {
      if (!principal.agentScopes?.includes("world:read")) throw new AgentOperationError("FORBIDDEN", 403);
      const query = ReceiptReadQuerySchema.safeParse(args);
      if (!query.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, query.error.issues));
      const receipt = await this.options.dispatcher.lookupReceipt(principal, query.data.commandId);
      if (!receipt) {
        const result = {
          code: "RECEIPT_NOT_FOUND",
          receiptExists: false,
          lookup: "not_found",
          commandState: "unknown",
          evidence: "Receipt absence alone establishes neither a commit nor transport uncertainty.",
          message:
            "No receipt for this account and command ID. A deterministic validation/rules denial before commit creates no receipt. Correct the denied action; do not interpret this as success. After a transport timeout reconcile the same ID before retrying.",
        };
        return { isError: true, content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
      }
      return receiptToolResult(receipt, principal.accountId);
    }
    if (name === pactApprovalStatusTool.name) {
      if (!principal.agentScopes?.includes("world:read") || !this.options.approvals)
        throw new AgentOperationError("FORBIDDEN", 403);
      const query = ApprovalStatusQuerySchema.safeParse(args);
      if (!query.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, query.error.issues));
      const status = await this.options.approvals.read(principal.accountId, query.data.approvalId);
      if (!status) throw new AgentOperationError("INVALID_REQUEST", 404);
      const result = {
        ...status,
        deepLink: `${this.options.origin}${String((status as Record<string, unknown>).deepLinkPath)}`,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result as Record<string, unknown>,
      };
    }
    if (name === pactApprovalProposalTool.name || name === pactApprovalProposalV2Tool.name) {
      if (!principal.agentScopes?.includes("game:act") || !this.options.approvalProposals || !sessionId)
        throw new AgentOperationError("FORBIDDEN", 403);
      const parsed = (
        name === pactApprovalProposalV2Tool.name ? ApprovalProposalV2Schema : ApprovalProposalSchema
      ).safeParse(args);
      if (!parsed.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, parsed.error.issues));
      const approval = await this.options.approvalProposals.proposeAgent({ ...principal, sessionId }, parsed.data);
      const result = {
        code: "APPROVAL_REQUIRED",
        approvalId: approval.approvalId,
        deepLink: `${this.options.origin}${approval.deepLinkPath}`,
        effectsSummary: approval.effectsSummary,
        expiresAt: approval.expiresAt.toISOString(),
      };
      return { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result };
    }
    if (!principal.agentScopes?.includes("game:act")) throw new AgentOperationError("FORBIDDEN", 403);
    if (name === pactGameActionTool.name || name === pactGameActionV2Tool.name) {
      const parsed = (name === pactGameActionV2Tool.name ? AgentGameActionV2Schema : AgentGameActionSchema).safeParse(
        args,
      );
      if (!parsed.success)
        throw new AgentOperationError("INVALID_REQUEST", 400, operationValidationDetail(name, parsed.error.issues));
      const command = {
        schemaVersion: name === pactGameActionV2Tool.name ? "pact.command.v2" : SCHEMA_VERSION,
        commandId: parsed.data.commandId,
        actor: {
          principalId: principal.accountId,
          productScope: ProductScopeSchema.parse(this.options.productScope),
          audience: principal.audience,
          subject: { type: "account" as const, id: principal.accountId },
        },
        ...(parsed.data.expectedVersion === undefined ? {} : { expectedVersion: parsed.data.expectedVersion }),
        action: parsed.data.action,
        submittedAt: this.options.clock.now().toISOString(),
      };
      const receipt = await this.options.dispatcher.dispatch(
        { ...principal, ...(sessionId ? { sessionId } : {}) },
        command,
      );
      return receiptToolResult(receipt, principal.accountId);
    }
    if (name === "pact_command_v1") {
      const receipt = await this.options.dispatcher.dispatch(
        { ...principal, ...(sessionId ? { sessionId } : {}) },
        args,
      );
      return { content: [{ type: "text", text: JSON.stringify(receipt) }], structuredContent: receipt };
    }
    const action =
      name === "sandbox.echo"
        ? { kind: "sandbox.echo" as const, message: String(args.message ?? "") }
        : name === "sandbox.counter.increment"
          ? {
              kind: "sandbox.counter.increment" as const,
              counterId: String(args.counterId ?? ""),
              amount: Number(args.amount ?? 0),
            }
          : name === "sandbox.draft.read"
            ? { kind: "sandbox.draft.read" as const }
            : name === "sandbox.draft.write"
              ? { kind: "sandbox.draft.write" as const, note: String(args.note ?? "") }
              : null;
    if (!action)
      throw new AgentOperationError(
        "INVALID_REQUEST",
        400,
        operationValidationDetail(name, [{ path: ["name"], code: "unsupported_operation" }]),
      );
    const command = {
      schemaVersion: SCHEMA_VERSION,
      commandId: randomUUID(),
      actor: {
        principalId: principal.accountId,
        productScope: ProductScopeSchema.parse(this.options.productScope),
        audience: principal.audience,
        subject: { type: "account" as const, id: principal.accountId },
      },
      action,
      submittedAt: this.options.clock.now().toISOString(),
    };
    const receipt = await this.options.dispatcher.dispatch(
      { ...principal, ...(sessionId ? { sessionId } : {}) },
      command,
    );
    return receiptToolResult(receipt, principal.accountId);
  }
}
