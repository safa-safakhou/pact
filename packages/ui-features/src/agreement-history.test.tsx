import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { type AgreementHistoryItem, changedAgreementTerms, EngineAgreementHistory } from "./agreement-history.js";

describe("engine version history presentation", () => {
  it("shows changed exact fields and invalidated signatures without making a claim a contract", () => {
    expect(
      changedAgreementTerms(
        { aToB: { resource: "grain", wholePerHour: 12 }, durationHours: 6 },
        { aToB: { resource: "grain", wholePerHour: 18 }, durationHours: 8 },
      ),
    ).toEqual([
      { field: "aToB.wholePerHour", before: "12", after: "18" },
      { field: "durationHours", before: "6", after: "8" },
    ]);
    const item: AgreementHistoryItem = {
      id: "offer",
      kind: "supply",
      status: "open",
      version: 2,
      gameTimeMs: "120000",
      expiresGameTimeMs: "3600000",
      terms: {},
      versions: [
        {
          version: 2,
          terms: { durationHours: 8 },
          proposedBy: "peer",
          gameTimeMs: "120000",
          historicalBaseline: false,
        },
        {
          version: 1,
          terms: { durationHours: 6 },
          proposedBy: "owner",
          gameTimeMs: "60000",
          historicalBaseline: false,
        },
      ],
      versionsNextBefore: null,
      signatures: [{ version: 1, kingdomId: "owner", actorKind: "agent", gameTimeMs: "90000" }],
      contract: null,
      deliveries: [],
    };
    const html = renderToStaticMarkup(
      <EngineAgreementHistory items={[item]} ownerId="owner" onMoreVersions={() => {}} />,
    );
    expect(html).toContain("Superseded: these signatures do not sign current terms.");
    expect(html).toContain("durationHours");
    expect(html).toContain("Recorded negotiation");
    expect(html).not.toContain("Engine activation");
  });
});
