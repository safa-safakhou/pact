import type { CommandEnvelope } from "@pact/contracts";
import { rulesCatalog } from "@pact/domain";

type ProposalAction = Extract<
  CommandEnvelope["action"],
  { kind: "game.contact.request" | "game.transfer" | "game.training.queue" }
>;

/** PACT-specific, conditional effects shown before the shared human command dispatch. */
export function describeApprovalEffects(action: ProposalAction): string {
  switch (action.kind) {
    case "game.contact.request":
      return `Request contact with kingdom ${action.recipientKingdomId}; charge 2 Silver and one cold-contact action if valid at human approval. Note: ${JSON.stringify(action.note)}`;
    case "game.transfer":
      return `Transfer ${action.wholeAmount} ${action.resource} to kingdom ${action.recipientKingdomId}; debit sender and consume one transfer action if valid at human approval. Recipient capacity may limit the credited amount.`;
    case "game.training.queue": {
      const unit = rulesCatalog.units[action.type];
      return `Queue ${action.count} ${action.type} for training; debit ${unit.iron * action.count} Iron and ${unit.silver * action.count} Silver if stock, hall unlock, troop capacity, and queue space remain valid at human approval.`;
    }
  }
}
