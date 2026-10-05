import { describe, expect, it } from "vitest";
import { AgentWorldReadQuerySchema, WorldViewQuerySchema, worldReadValidationHelp } from "./schemas.js";

describe("agent self read", () => {
  it("adds identity-derived self while retaining the published HTTP target contract", () => {
    expect(AgentWorldReadQuerySchema.parse({})).toEqual({ forecastMinutes: 60 });
    expect(WorldViewQuerySchema.safeParse({}).success).toBe(false);
  });
  it("returns safe bounded corrections for malformed fields and forecast boundaries", () => {
    for (const input of [
      { forecastMinutes: 0 },
      { forecastMinutes: 61 },
      { accountId: "DO_NOT_ECHO" },
      { kingdomId: "DO_NOT_ECHO" },
    ]) {
      const result = worldReadValidationHelp(input);
      expect(result).toMatchObject({ valid: false, error: { code: "INVALID_REQUEST", receiptExists: false } });
      expect(JSON.stringify(result)).not.toContain("DO_NOT_ECHO");
    }
    expect(worldReadValidationHelp({ forecastMinutes: 1 })).toMatchObject({ valid: true });
    expect(worldReadValidationHelp({ forecastMinutes: 60 })).toMatchObject({ valid: true });
  });
});
