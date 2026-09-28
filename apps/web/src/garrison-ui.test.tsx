import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContractBoard } from "./game-app.js";

const lenderId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const hostId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const terms = {
  units: [{ type: "spearman", count: 3 }],
  durationHours: 6,
  lenderBond: { resource: "iron", wholeAmount: 4 },
  hostBond: null,
};

function board(kingdomId: string, status = "active"): string {
  return renderToStaticMarkup(
    createElement(ContractBoard, {
      kingdomId,
      busy: false,
      confirmAction: () => undefined,
      social: {
        contacts: [],
        requests: [],
        messages: [],
        supplyOffers: [],
        supplyContracts: [],
        garrisonOffers: [
          {
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            lenderKingdomId: lenderId,
            hostKingdomId: hostId,
            kingdomId: kingdomId === lenderId ? hostId : lenderId,
            handle: "counterparty",
            displayName: "Counterparty",
            version: 1,
            terms,
            signedBy: [],
          },
        ],
        garrisonContracts: [
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            lenderKingdomId: lenderId,
            hostKingdomId: hostId,
            kingdomId: kingdomId === lenderId ? hostId : lenderId,
            handle: "counterparty",
            displayName: "Counterparty",
            status,
            endGameTimeMs: "1790000000000",
            terms,
          },
        ],
      },
    }),
  );
}

describe("garrison contract sheet", () => {
  it("shows exact food and bond responsibilities plus lender controls", () => {
    const html = board(lenderId);
    expect(html).toContain("3 spearman · 6h · host pays troop upkeep · lender bond 4 iron · host bond none");
    expect(html).toContain("Sign garrison offer with Counterparty");
    expect(html).toContain("Withdraw offer");
    expect(html).toContain("Recall troops");
    expect(html).toContain("Request mutual release");
    expect(html).not.toContain("Seize troops");
  });

  it("shows host return and seizure controls only while active", () => {
    const active = board(hostId);
    expect(active).toContain("Return troops");
    expect(active).toContain("Seize troops");
    expect(active).not.toContain("Recall troops");
    expect(active).not.toContain("Withdraw offer");
    const closed = board(hostId, "closed");
    expect(closed).not.toContain("Return troops");
    expect(closed).not.toContain("Seize troops");
    expect(closed).not.toContain("Request mutual release");
  });
});
