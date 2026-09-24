import { z } from "zod";
import {
  CommandEnvelopeSchema,
  CommandReceiptSchema,
  EventEnvelopeSchema,
  ToolCallSchema,
  WorldViewQuerySchema,
} from "./schemas.js";

export const commandJsonSchema = z.toJSONSchema(CommandEnvelopeSchema, { target: "draft-7" });
export const receiptJsonSchema = z.toJSONSchema(CommandReceiptSchema, { target: "draft-7" });
export const eventJsonSchema = z.toJSONSchema(EventEnvelopeSchema, { target: "draft-7" });
export const toolCallJsonSchema = z.toJSONSchema(ToolCallSchema, { target: "draft-7" });
export const worldViewQueryJsonSchema = z.toJSONSchema(WorldViewQuerySchema, { target: "draft-7" });

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
