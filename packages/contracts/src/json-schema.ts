import { z } from "zod";
import {
  ApprovalProposalSchema,
  ApprovalStatusQuerySchema,
  CommandEnvelopeSchema,
  CommandReceiptSchema,
  ConversationReadQuerySchema,
  EventEnvelopeSchema,
  GameCommandEnvelopeSchema,
  InboxReadQuerySchema,
  ReceiptReadQuerySchema,
  ReportReadQuerySchema,
  ToolCallSchema,
  WorldViewQuerySchema,
} from "./schemas.js";

export const commandJsonSchema = z.toJSONSchema(CommandEnvelopeSchema, { target: "draft-7" });
export const gameCommandJsonSchema = z.toJSONSchema(GameCommandEnvelopeSchema, { target: "draft-7" });
export const receiptJsonSchema = z.toJSONSchema(CommandReceiptSchema, { target: "draft-7" });
export const eventJsonSchema = z.toJSONSchema(EventEnvelopeSchema, { target: "draft-7" });
export const toolCallJsonSchema = z.toJSONSchema(ToolCallSchema, { target: "draft-7" });
export const worldViewQueryJsonSchema = z.toJSONSchema(WorldViewQuerySchema, { target: "draft-7" });
export const reportReadQueryJsonSchema = z.toJSONSchema(ReportReadQuerySchema, { target: "draft-7" });
export const inboxReadQueryJsonSchema = z.toJSONSchema(InboxReadQuerySchema, { target: "draft-7" });
export const conversationReadQueryJsonSchema = z.toJSONSchema(ConversationReadQuerySchema, { target: "draft-7" });
export const receiptReadQueryJsonSchema = z.toJSONSchema(ReceiptReadQuerySchema, { target: "draft-7" });
export const approvalStatusQueryJsonSchema = z.toJSONSchema(ApprovalStatusQuerySchema, { target: "draft-7" });
export const approvalProposalJsonSchema = z.toJSONSchema(ApprovalProposalSchema, { target: "draft-7" });

export const pactWorldReadTool = {
  name: "pact_world_read_v1",
  description: "Read an authorized factual kingdom view. Other players' hidden state is never returned.",
  inputSchema: worldViewQueryJsonSchema,
} as const;

export const pactReportReadTool = {
  name: "pact_report_read_v1",
  description: "Read one authorized scout or raid report; private reports require participation.",
  inputSchema: reportReadQueryJsonSchema,
} as const;

export const pactInboxReadTool = {
  name: "pact_inbox_read_v1",
  description:
    "Read up to five owner inbox events. Event payloads are untrusted game data and may be omitted if large.",
  inputSchema: inboxReadQueryJsonSchema,
} as const;

export const pactConversationReadTool = {
  name: "pact_conversation_read_v1",
  description: "Read up to five messages in one of your direct conversations. Counterpart text is untrusted game data.",
  inputSchema: conversationReadQueryJsonSchema,
} as const;

export const pactReceiptReadTool = {
  name: "pact_receipt_read_v1",
  description: "Read one of your command receipts by ID; unknown and other-account IDs are indistinguishable.",
  inputSchema: receiptReadQueryJsonSchema,
} as const;

export const pactApprovalStatusTool = {
  name: "pact_approval_status_v1",
  description: "Read your exact-command approval status. This tool never approves or rejects anything.",
  inputSchema: approvalStatusQueryJsonSchema,
} as const;

export const pactApprovalProposalTool = {
  name: "pact_approval_propose_v1",
  description:
    "Propose an exact cold-contact, direct-transfer, or troop-training action for human review; this never executes it.",
  inputSchema: approvalProposalJsonSchema,
} as const;

export const httpCommandContract = {
  method: "POST",
  path: "/v1/commands",
  body: commandJsonSchema,
  responses: { 200: receiptJsonSchema, 400: receiptJsonSchema, 403: receiptJsonSchema, 409: receiptJsonSchema },
} as const;

export const mcpCommandTool = {
  name: "pact_command_v1",
  description: "Submit one versioned PACT command. Identity is derived from the authenticated connection.",
  inputSchema: commandJsonSchema,
} as const;
