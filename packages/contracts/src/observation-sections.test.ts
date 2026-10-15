import { expect, it } from "vitest";
import { ObservationSectionQuerySchema, pactObservationSectionTool } from "./observation-sections.js";

it("publishes a strict additive owner-section read without account selectors", () => {
  expect(ObservationSectionQuerySchema.parse({ section: "forecast" })).toEqual({ section: "forecast" });
  for (const args of [
    { section: "unknown" },
    { section: "forecast", forecastMinutes: 61 },
    { section: "requests", limit: 33 },
    { section: "requests", accountId: "another" },
    { section: "units", cursor: { afterKey: "invented" } },
  ])
    expect(ObservationSectionQuerySchema.safeParse(args).success).toBe(false);
  expect(pactObservationSectionTool.annotations.readOnlyHint).toBe(true);
});
