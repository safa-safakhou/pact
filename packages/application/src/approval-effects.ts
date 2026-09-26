import type { CommandEnvelope } from "@pact/contracts";
import { rulesCatalog, upgradeCost } from "@pact/domain";

type ProposalAction = Extract<
  CommandEnvelope["action"],
  {
    kind: "game.contact.request" | "game.transfer" | "game.training.queue" | "game.building.queue" | "game.scout.start";
  }
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
    case "game.building.queue": {
      const cost = upgradeCost(action.building, action.targetLevel);
      return `Queue ${action.building} level ${action.targetLevel} in builder slot ${action.slot}; construction costs ${cost.iron / 600n} Iron and ${cost.silver / 600n} Silver if eligible when work starts. Founding allowance may cover some or all of the cost; an unstarted waiting instruction debits no stock. Human approval issues an exact one-use construction permit.`;
    }
    case "game.scout.start":
      return `Scout kingdom ${action.targetKingdomId}; charge ${rulesCatalog.scouting.silverCost} Silver, ${rulesCatalog.scouting.grainCost} Grain, and one scout charge, and commit two ordinary Spearmen for ${rulesCatalog.scouting.durationMinutes} minutes if valid at human approval. ${action.unitIds ? `Exact troop IDs: ${action.unitIds.join(", ")}.` : "The server selects the lowest eligible troop IDs."}`;
  }
}
