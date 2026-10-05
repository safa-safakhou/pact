import { existsSync } from "node:fs";
import { compactGuide } from "./policy.mjs";

// Reuse the game's exact display conversion, including non-terminating fractions.
const { wholeUnitText } = await import(
  existsSync("/app/packages/domain/dist/resource-facts.js")
    ? "file:///app/packages/domain/dist/resource-facts.js"
    : new URL("../../packages/domain/dist/resource-facts.js", import.meta.url).href
);
function displayUnits(value) {
  if (Array.isArray(value)) return value.map(displayUnits);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (key.endsWith("Marked"))
        return [
          key.replace(/Marked$/, "Whole"),
          typeof entry === "object"
            ? Object.fromEntries(Object.entries(entry).map(([asset, amount]) => [asset, wholeUnitText(amount)]))
            : wholeUnitText(entry),
        ];
      return [key, displayUnits(entry)];
    }),
  );
}
// A presentation adapter, not a second economy: use the server's existing whole-unit facts.
export function playerBrief(g) {
  const result = displayUnits(compactGuide(g));
  result.resources = Object.fromEntries(Object.entries(g.resources).map(([name, r]) => [name, r.facts]));
  result.unitRule =
    "Every quantity in resources and constructionStockChecks.costWhole is in whole resources. Rates explicitly say per minute or per hour. Raw marked units elsewhere use 600 marked = 1 whole. Never call a per-hour rate a per-minute rate.";
  return result;
}
export function receiptBrief(items) {
  return items.map(({ action, receipt }) => ({
    action,
    outcome: receipt.code,
    commandId: receipt.commandId,
    receiptExists: receipt.receiptExists ?? true,
    chargedWhole: (receipt.charged ?? []).map((c) => ({
      resource: c.asset,
      whole: wholeUnitText(c.units),
    })),
    records: receipt.recordVersions ?? {},
    committedAt: receipt.committedAt ?? null,
  }));
}
