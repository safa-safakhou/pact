import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FirstSession } from "./first-session.js";
import { RunPanel, RunResult } from "./run-panel.js";

describe("first-session and run decision interface", () => {
  it("does not claim absent relationships when the social projection is unavailable", () => {
    const html = renderToStaticMarkup(
      <FirstSession
        stage={{
          socialAvailable: false,
          farmComplete: true,
          farmPending: false,
          contacts: 0,
          pendingRequests: 0,
          pendingOffers: 0,
          contracts: 0,
        }}
        onArea={() => {}}
      />,
    );
    expect(html).toContain("temporarily unavailable");
    expect(html).toContain("no success is assumed");
    expect(html).not.toContain("No contract has been accepted");
  });
  it("shows honest pending construction/counterparties, not invented tutorial success", () => {
    const html = renderToStaticMarkup(
      <FirstSession
        stage={{
          farmComplete: false,
          farmPending: true,
          contacts: 0,
          pendingRequests: 2,
          pendingOffers: 0,
          contracts: 0,
        }}
        onArea={() => {}}
      />,
    );
    expect(html).toContain("build is pending");
    expect(html).toContain("2 requests still pending");
    expect(html).toContain("No contract has been accepted");
    expect(html).toContain("Read real consequences");
  });
  it("makes exact two-party signature and next decision explicit", () => {
    const html = renderToStaticMarkup(
      <FirstSession
        stage={{
          farmComplete: true,
          farmPending: false,
          contacts: 1,
          pendingRequests: 0,
          pendingOffers: 1,
          contracts: 0,
        }}
        onArea={() => {}}
      />,
    );
    expect(html).toContain("Both parties must sign the same version");
    expect(html).not.toContain("trade succeeded");
  });
  it("requires bounded explicit provider confirmation and no unattended inference", () => {
    const html = renderToStaticMarkup(<RunPanel request={async () => ({})} contacts={[]} />);
    expect(html).toContain("40,000");
    expect(html).toContain("Provider price unavailable");
    expect(html).toContain("no model call has started");
    expect(html).toContain('disabled=""');
  });
  it("result card separates factual denial from untrusted assessment and links exact human approval", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const html = renderToStaticMarkup(
      <RunResult
        report={{
          label: "Engine facts",
          status: "waiting",
          entries: [
            {
              id: "1",
              category: "approval_needed",
              callId: "a",
              code: "APPROVAL_REQUIRED",
              approvalId: id,
              records: [],
              nextStep: "Human: review",
            },
          ],
          assessments: [{ id: "2", label: "Agent assessment — not an engine fact", text: "<script>claim</script>" }],
          nextStep: "No automatic inference",
          truncated: false,
        }}
      />,
    );
    expect(html).toContain(`?approval=${id}`);
    expect(html).not.toContain("<script>");
    expect(html).toContain("not an engine fact");
  });
});
