import { expect, it } from "vitest";
import { activityStateResolver } from "./external-activity-state.js";

it("replaces old proposal advice with authorized current outcomes and removes resolved review links", async () => {
  const resolver = activityStateResolver(
    {
      read: async (account) => {
        expect(account).toBe("owner");
        return [
          {
            record: "building:one",
            label: "Farm II",
            status: "completed",
            nextStep: "Finished",
            asOfGameTimeMs: 60_000,
          },
        ];
      },
    },
    {
      read: async (account, id) => {
        expect(account).toBe("owner");
        return {
          approvalId: id,
          commandId: "command",
          untrustedContent: true,
          status: "approved",
          effectsSummary: "Farm II",
          expiresAt: new Date(),
          receipt: null,
          deepLinkPath: "/pact/?approval=one",
        };
      },
    },
  );
  const result = await resolver("owner", [
    {
      id: "1",
      category: "approval_needed",
      callId: "call",
      code: "APPROVAL_REQUIRED",
      approvalId: "one",
      records: [{ record: "building:one", version: 1 }],
      nextStep: "Review",
    },
  ]);
  expect(result["1"]).toMatchObject([
    { status: "approved", nextStep: expect.stringContaining("no further approval") },
    { status: "completed" },
  ]);
  expect(result["1"]?.[0]).not.toHaveProperty("reviewPath");
});
