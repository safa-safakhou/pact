/** Evaluator-authored objective units are not game authority or a message quota.
 * Legacy studies retain byte-identical owner text. Numeric goals are never tuned. */
export function negotiationGoalText(
  goal: Readonly<Record<string, unknown>>,
  explicitDomain: boolean | "external.v1",
): string {
  return JSON.stringify(
    explicitDomain
      ? {
          ...goal,
          quantityUnit: "whole resource units",
          timeUnit: "GAME hour",
          scope:
            explicitDomain === "external.v1"
              ? "external peer supply delivery rates; excludes local production; not communication allowance"
              : "supply delivery rates; not communication allowance",
        }
      : goal,
  );
}
