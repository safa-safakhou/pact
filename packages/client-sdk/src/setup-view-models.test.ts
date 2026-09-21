import { describe, expect, it } from "vitest";
import {
  buildSetupSnapshot,
  readInvitationDestination,
  toPricingMessage,
  toRunStatusLabel,
  toSetupErrorMessage,
} from "./view-models.js";

describe("setup view models", () => {
  it("maps run statuses to Working, Waiting, or Stopped", () => {
    expect(toRunStatusLabel("running")).toBe("Working");
    expect(toRunStatusLabel("waiting")).toBe("Waiting");
    expect(toRunStatusLabel("stopped")).toBe("Stopped");
    expect(toRunStatusLabel("finished")).toBe("Stopped");
    expect(toRunStatusLabel("failed")).toBe("Stopped");
    expect(toRunStatusLabel("unknown")).toBe("Stopped");
  });

  it("never presents unknown pricing as zero cost", () => {
    expect(toPricingMessage({ available: false })).toEqual({
      kind: "unavailable",
      text: "Provider price unavailable",
    });
    expect(toPricingMessage({ available: false, estimateText: "$0.00" })).toEqual({
      kind: "unavailable",
      text: "Provider price unavailable",
    });
    expect(toPricingMessage({ available: true, estimateText: "" })).toEqual({
      kind: "unavailable",
      text: "Provider price unavailable",
    });
    expect(toPricingMessage({ available: true, estimateText: "About $0.12" })).toEqual({
      kind: "estimate",
      text: "About $0.12",
    });
  });

  it("returns actionable expired, revoked, and unsupported-host messages", () => {
    expect(toSetupErrorMessage("EXPIRED")).toMatch(/expired/i);
    expect(toSetupErrorMessage("REVOKED")).toMatch(/revoked/i);
    expect(toSetupErrorMessage("UNSUPPORTED_HOST")).toMatch(/not supported/i);
    expect(toSetupErrorMessage("EXPIRED")).not.toMatch(/found(ed|ing).*kingdom/i);
    expect(toSetupErrorMessage("REVOKED")).not.toMatch(/live kingdom/i);
  });

  it("preserves invitation destination fields", () => {
    expect(
      readInvitationDestination({
        invite: "  invite-token  ",
        destination: "court:abc",
      }),
    ).toEqual({ invite: "invite-token", destination: "court:abc" });
    expect(readInvitationDestination({ invite: null, destination: "  " })).toEqual({});
  });

  it("builds a hydrateable snapshot that never claims a live kingdom", () => {
    const snapshot = buildSetupSnapshot({
      step: "inbox",
      invitation: { invite: "tok", destination: "notice:1" },
      runStatus: "waiting",
      pricing: { available: false },
      errorCode: "EXPIRED",
      externalHostMessage: "Usage is billed by the external host.",
      connectorPrerequisiteMessage: "Install the certified connector before connecting.",
      serverState: { draftId: "draft-1", approvalId: "apr-1" },
    });
    expect(snapshot.runStatusLabel).toBe("Waiting");
    expect(snapshot.pricing.text).toBe("Provider price unavailable");
    expect(snapshot.errorMessage).toMatch(/expired/i);
    expect(snapshot.invitation).toEqual({ invite: "tok", destination: "notice:1" });
    expect(snapshot.serverState).toEqual({ draftId: "draft-1", approvalId: "apr-1" });
    expect(snapshot.foundsLiveKingdom).toBe(false);
  });
});
