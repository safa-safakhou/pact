/** Evaluator-authored objective units are not game authority or a message quota.
 * Legacy studies retain byte-identical owner text. Numeric goals are never tuned. */
export function negotiationGoalText(goal: Readonly<Record<string, unknown>>, explicitDomain: boolean): string {
  return JSON.stringify(
    explicitDomain
      ? {
          ...goal,
          quantityUnit: "whole resource units",
          timeUnit: "GAME hour",
          scope: "supply delivery rates; not communication allowance",
        }
      : goal,
  );
}
