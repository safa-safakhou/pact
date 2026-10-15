import { randomUUID } from "node:crypto";
import { CommandOutcomeSchema, SCHEMA_VERSION } from "@pact/contracts";
import { describe, expect, it } from "vitest";
import { commandOutcome } from "./command-outcomes.js";

describe("canonical outcome classification", () => {
  it("does not turn a committed queue or signatures into completion", () => {
    const id = randomUUID();
    const receipt = {
      schemaVersion: SCHEMA_VERSION,
      commandId: id,
      code: "COMMITTED" as const,
      committedEventIds: [],
      recordVersions: {},
      charged: [],
    };
    const result = CommandOutcomeSchema.parse(
      commandOutcome(id, receipt, [
        { status: "waiting" },
        { offerStatus: "open", signaturesOnVersion: 1, activated: false },
      ]),
    );
    expect(result.execution).toBe("committed");
    expect(result.lifecycle).toMatchObject([{ status: "waiting" }, { activated: false }]);
    expect(commandOutcome(id, { ...receipt, code: "FORBIDDEN" }, []).execution).toBe("rejected");
  });

  it("keeps ordinary missing receipt unknown without creating pending work", () => {
    const result = commandOutcome(randomUUID(), null, []);
    expect(CommandOutcomeSchema.parse(result)).toMatchObject({
      lookup: "not_found",
      execution: "unknown",
      receipt: null,
      lifecycle: [],
    });
    expect(result.coverage).toContain("neither a commit");
  });
});
