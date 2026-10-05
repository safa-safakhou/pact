import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Consequences, type ConsequenceView } from "./consequences.js";

const base: ConsequenceView = {
  asOfGameTimeMs: 0,
  builds: [
    { id: "build", building: "farm", targetLevel: 2, state: "completed", dueGameTimeMs: 0, settledGameTimeMs: 0 },
  ],
  contacts: [],
  supplyContracts: [
    {
      id: "contract",
      offerVersion: 1,
      status: "active",
      signedBy: ["a", "b"],
      counterparty: { handle: "real_partner", displayName: "Partner" },
      endGameTimeMs: 3600000,
      noticeEndGameTimeMs: null,
      closeReason: null,
      deliveries: [],
    },
  ],
};
describe("visible committed consequences", () => {
  it("shows completed work and a game-hour deadline without inventing deliveries", () => {
    const html = renderToStaticMarkup(<Consequences data={base} worldStatus="active" />);
    expect(html).toContain("farm 2 · completed");
    expect(html).toContain("1h 0m game time remaining");
    expect(html).toContain("No settled delivery yet");
  });
  it("shows exact settled amounts, failure and overflow instead of crediting lost stock", () => {
    const contract = base.supplyContracts[0];
    if (!contract) throw new Error("fixture");
    const html = renderToStaticMarkup(
      <Consequences
        data={{
          ...base,
          supplyContracts: [
            {
              ...contract,
              status: "defaulted",
              closeReason: "reserve_constraint",
              deliveries: [
                {
                  resource: "iron",
                  direction: "received",
                  installments: 1,
                  dueMarked: "600",
                  deliveredMarked: "300",
                  overflowMarked: "60",
                  failedInstallments: 1,
                  lastGameTimeMs: 0,
                },
              ],
            },
          ],
        }}
        worldStatus="paused"
      />,
    );
    expect(html).toContain("0.5 whole (300 marked)");
    expect(html).toContain("0.1 whole (60 marked)");
    expect(html).toContain("1 failed installments");
    expect(html).toContain("Overflow is not credited");
    expect(html).not.toContain("Future installments remain pending");
  });
});
