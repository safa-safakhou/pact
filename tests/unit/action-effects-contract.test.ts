import { ActionEffectsSchema, GuardedCommandSchema } from "@pact/contracts";
import { expect, it } from "vitest";

it("rejects omitted coverage, non-integer claims and executable guard payloads", () => {
  expect(ActionEffectsSchema.safeParse({ schemaVersion: "fleet.action-effects.v1", claims: [] }).success).toBe(false);
  expect(GuardedCommandSchema.safeParse({ command: {}, guard: { run: "code" } }).success).toBe(false);
});
