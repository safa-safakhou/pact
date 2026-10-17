import { expect, it } from "vitest";
import { AgentOutlookQuerySchema } from "../../packages/contracts/src/agent-outlook-schemas.js";
import { garrisonUpkeepExposure } from "../../packages/kingdom/src/garrison.js";

it("bounds the forecast and accepts no caller identity", () => {
  expect(AgentOutlookQuerySchema.parse({}).forecastMinutes).toBe(60);
  expect(AgentOutlookQuerySchema.safeParse({ forecastMinutes: 61 }).success).toBe(false);
  expect(AgentOutlookQuerySchema.safeParse({ accountId: "foreign" }).success).toBe(false);
});
it("uses the same signed one-hour food exposure plus five-minute lock bound", () => {
  expect(
    garrisonUpkeepExposure({
      units: [{ type: "spearman", count: 2 }],
      durationHours: 1,
      lenderBond: null,
      hostBond: null,
    }),
  ).toBe(2n * 10n * 65n);
});
