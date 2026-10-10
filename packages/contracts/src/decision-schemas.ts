import { z } from "zod";

export const DecisionSupportQuerySchema = z
  .object({
    candidateId: z.string().min(1).max(256).optional(),
    proposalOffset: z.number().int().min(0).max(10000).optional(),
  })
  .strict();
export const pactDecisionSupportTool = {
  name: "pact_decision_support_v2",
  description:
    "Read your authorized exact costs, prerequisites, upkeep, charge state, conditional forecast and proposal exposure. Optional unranked candidates include waiting, reading and declining; direct authorized actions remain available. This read grants no authority and acknowledges no messages. Peer statements and future deliveries are not certified facts.",
  inputSchema: {
    type: "object",
    properties: {
      proposalOffset: {
        type: "integer",
        minimum: 0,
        maximum: 10000,
        description:
          "Page through twelve proposals from the observed set; pair history reads expose deeper retained records.",
      },
      candidateId: {
        type: "string",
        minLength: 1,
        maxLength: 256,
        description:
          "Optionally resolve an observed candidate ID against current facts. Returns a blueprint, not a commitment; changed facts return CANDIDATE_STALE.",
      },
    },
    additionalProperties: false,
  },
} as const;
