import { describe, expect, it } from "vitest";
import { chatgptDescriptor, playHtml } from "./chatgpt.js";

describe("versioned host tool annotations and conversation app", () => {
  it("classifies all admitted v2 writes as game:act and history as read-only", () => {
    for (const name of ["pact_game_action_v2", "pact_command_v2", "pact_approval_propose_v2"]) {
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
