import { describe, expect, it } from "vitest";
import { SocialCommandSchema } from "./social-schemas.js";

const command = {
  schemaVersion: "pact.social-command.v1",
  commandId: "00000000-0000-4000-8000-000000000001",
  action: { kind: "invitation.accept", token: "A".repeat(32) },
};
describe("additive human social command", () => {
  it("accepts a bounded token but no caller-supplied identity or redirect", () => {
    expect(SocialCommandSchema.safeParse(command).success).toBe(true);
    expect(SocialCommandSchema.safeParse({ ...command, actor: { audience: "human" } }).success).toBe(false);
    expect(
      SocialCommandSchema.safeParse({ ...command, action: { ...command.action, accountId: "someone-else" } }).success,
    ).toBe(false);
    expect(
      SocialCommandSchema.safeParse({ ...command, action: { ...command.action, token: "https://outside.example" } })
        .success,
    ).toBe(false);
  });
  it("cannot reuse the gameplay version or issue arbitrary redirect destinations", () => {
    expect(SocialCommandSchema.safeParse({ ...command, schemaVersion: "pact.command.v1" }).success).toBe(false);
    expect(
      SocialCommandSchema.safeParse({
        ...command,
        action: { kind: "invitation.issue", destinationType: "contact", destinationId: "https://outside.example" },
      }).success,
    ).toBe(false);
  });
});
