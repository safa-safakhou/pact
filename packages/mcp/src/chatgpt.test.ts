import { pactActionEffectsExecuteTool, pactActionEffectsQuoteTool } from "@pact/contracts";
import { describe, expect, it } from "vitest";
import { chatgptDescriptor, playHtml } from "./chatgpt.js";

describe("versioned host tool annotations and conversation app", () => {
  it("preserves canonical action-effect write annotations through host decoration", () => {
    const execute = chatgptDescriptor(pactActionEffectsExecuteTool);
    expect(execute.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, openWorldHint: false });
    expect(execute.securitySchemes[0]?.scopes).toEqual(["game:act"]);
    expect(execute._meta["pact/operation"]).toMatchObject({ readOnly: false, requiredScopes: ["game:act"] });
    expect(chatgptDescriptor(pactActionEffectsQuoteTool).annotations.readOnlyHint).toBe(true);
    expect(
      chatgptDescriptor({ name: "new_canonical_write", annotations: { readOnlyHint: false } }).annotations.readOnlyHint,
    ).toBe(false);
  });
  it("describes lease reservation as a private non-destructive write without changing gameplay labels", () => {
    expect(chatgptDescriptor({ name: "run.open" })).toMatchObject({
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
      securitySchemes: [{ type: "oauth2", scopes: ["game:act"] }],
      _meta: { securitySchemes: [{ type: "oauth2", scopes: ["game:act"] }] },
    });
    for (const name of ["pact_command_v1", "pact_game_action_v1", "pact_game_action_v2"])
      expect(chatgptDescriptor({ name }).annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      });
  });
  it("classifies all admitted v2 writes as game:act and history as read-only", () => {
    for (const name of [
      "pact_game_action_v2",
      "pact_command_v2",
      "pact_approval_propose_v2",
      "pact_private_memory_write_v2",
    ]) {
      const descriptor = chatgptDescriptor({ name });
      expect(descriptor.annotations.readOnlyHint).toBe(false);
      expect(descriptor.securitySchemes[0]?.scopes).toEqual(["game:act"]);
    }
    expect(chatgptDescriptor({ name: "pact_conversation_history_v2" }).annotations.readOnlyHint).toBe(true);
    expect(playHtml).toContain("pact_conversation_history_v2");
    expect(playHtml).toContain("Superseded: these signatures do not sign current terms.");
    expect(playHtml).not.toContain("Their ruler must accept this introduction");
  });
});
