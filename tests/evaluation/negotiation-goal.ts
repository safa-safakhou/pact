/** Evaluator-authored objective units are not game authority or a message quota.
 * Legacy studies retain byte-identical owner text. Numeric goals are never tuned. */
export function negotiationGoalText(
  goal: Readonly<Record<string, unknown>>,
  explicitDomain: boolean | "external.v1" | "external.v2",
): string {
  if (explicitDomain === "external.v2") {
    const { receive, minimumReceivePerHour, maximumSendPerHour, ...other } = goal;
    return JSON.stringify({
      ...other,
      ...(receive !== undefined || minimumReceivePerHour !== undefined
        ? {
            incoming: {
              ...(receive !== undefined ? { resource: receive } : {}),
              ...(minimumReceivePerHour !== undefined ? { minimumPerHour: minimumReceivePerHour } : {}),
            },
          }
        : {}),
      ...(maximumSendPerHour !== undefined ? { outgoing: { maximumPerHour: maximumSendPerHour } } : {}),
      quantityUnit: "whole resource units",
      timeUnit: "GAME hour",
      scope: "external peer supply; excludes local production; not communication allowance",
    });
  }
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
