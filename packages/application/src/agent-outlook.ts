import type { AgentOutlook } from "@pact/contracts";
import type { OwnerKingdomView } from "@pact/kingdom";
import { calculateDecisionSupport } from "./decision-support.js";
/** Reuse the existing exact quotes; do not infer a kingdom-wide feasibility score. */
export function outlookFeasibility(view: OwnerKingdomView): AgentOutlook["feasibility"] {
  const support = calculateDecisionSupport(view);
  return {
    candidates: support.candidates
      .filter((c) => c.kind === "action")
      .slice(0, 64)
      .map((c) => {
        const q = c.checks.admissionQuote as { admission?: { blockers: string[] } } | undefined,
          blockers = q?.admission?.blockers ?? [];
        return {
          candidateId: c.id,
          action: c.action?.kind ?? "unknown",
          stockSufficient: typeof c.checks.affordable === "boolean" ? c.checks.affordable : null,
          authoritySufficient: q
            ? !blockers.some((b) => b === "FORBIDDEN" || b.startsWith("INSUFFICIENT_ALLOWANCE"))
            : null,
          blockers,
          sourceRefs: [`world:${view.profile.kingdomId}:${view.committedTickSequence}:${view.lastCommittedEventId}`],
        };
      }),
    meaning:
      "Unranked per-action stock and delegated-authority checks from existing decision support. Other prerequisites, floors, versions and capacity still apply. No permission or reservation is granted; shared command handlers revalidate.",
  };
}
