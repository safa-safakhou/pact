import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { developmentChoices } from "./development-choices.js";
import { FirstSession, nextDecision, type Stage } from "./first-session.js";

const base: Stage = {
  farmComplete: false,
  farmPending: false,
  contacts: 0,
  pendingRequests: 0,
  pendingOffers: 0,
  contracts: 0,
  asOfGameTimeMs: 0,
  worldStatus: "active",
};
const pending = { kind: "farm", instructionId: "build-real", state: "active", dueGameTimeMs: 600000 };
const request = { id: "request-real", handle: "real_player", direction: "outgoing", expiresGameTimeMs: "1200000" };
const stock = (allowance: string, ordinary = "0") => ({
  buildings: [{ kind: "farm", level: 1 }],
  balances: {
    iron: { ordinaryUnits: ordinary, foundingAllowanceUnits: allowance },
    silver: { ordinaryUnits: ordinary, foundingAllowanceUnits: allowance },
  },
});
describe("one prioritized next decision", () => {
  it("covers unfounded, affordable and unaffordable Farm II without changing stock", () => {
    expect(nextDecision({ ...base, founded: false }).kind).toBe("unfounded");
    const snapshot = stock("24000");
    const before = JSON.stringify(snapshot),
      choices = developmentChoices(snapshot);
    expect(choices[0]).toMatchObject({
      building: "farm",
      from: 1,
      to: 2,
      before: 30,
      after: 45,
      iron: "40",
      silver: "20",
      minutes: 10,
      affordable: true,
    });
    expect(choices.map((c) => [c.building, c.iron, c.silver, c.minutes])).toEqual([
      ["farm", "40", "20", 10],
      ["mine", "50", "25", 10],
      ["market", "40", "30", 10],
      ["wall", "80", "30", 10],
    ]);
    expect(JSON.stringify(snapshot)).toBe(before);
    expect(nextDecision({ ...base, choices }).text).toContain("Start your first");
    expect(nextDecision({ ...base, choices: developmentChoices(stock("0")) }).text).toContain(
      "needs more construction stock",
    );
    const html = renderToStaticMarkup(<FirstSession stage={{ ...base, choices }} onArea={() => {}} />);
    expect(html).toContain("allowance before ordinary stock");
    expect(html).toContain("30 to 45 Grain/hour at 100% harvest");
  });
  it("prioritizes approval, failure, recipient, build, then choice", () => {
    const layered = {
      ...base,
      approvals: [{ status: "pending", deepLinkPath: "/pact/?approval=real" }],
      failure: { code: "STOCK_LOW", commandId: "real" },
      requests: [request],
      pendingRequests: 1,
      build: pending,
      farmPending: true,
    };
    expect(nextDecision(layered)).toMatchObject({ kind: "approval", href: "/pact/?approval=real" });
    expect(nextDecision({ ...layered, approvals: [] })).toMatchObject({ kind: "failure" });
    expect(nextDecision({ ...layered, approvals: [], failure: undefined })).toMatchObject({ kind: "recipient" });
    expect(nextDecision({ ...base, build: pending, farmPending: true }).kind).toBe("build");
    expect(nextDecision(base).kind).toBe("choice");
  });
  it.each(["waiting", "active"])("keeps %s construction honest when paused, stale or deadline reached", (state) => {
    expect(
      nextDecision({ ...base, build: { ...pending, state, dueGameTimeMs: null }, farmPending: true }).text,
    ).toContain("No game deadline assigned");
    expect(
      nextDecision({ ...base, build: { ...pending, state }, farmPending: true, worldStatus: "paused" }).text,
    ).toContain("clock paused");
    expect(nextDecision({ ...base, build: pending, asOfGameTimeMs: 600000 }).text).toContain("refresh for settlement");
    expect(nextDecision({ ...base, build: pending, stale: true }).kind).toBe("unknown");
    expect(nextDecision({ ...base, farmComplete: true, contacts: 1 }).text).toContain("accepted");
  });
  it("keeps outgoing requests waiting and respects real contact outcomes", () => {
    expect(nextDecision({ ...base, requests: [request], pendingRequests: 1, build: pending }).text).toContain(
      "Waiting for @real_player",
    );
    expect(nextDecision({ ...base, requests: [{ ...request, expiresGameTimeMs: "0" }] })).toMatchObject({
      kind: "unknown",
    });
    for (const status of ["declined", "expired"])
      expect(
        nextDecision({ ...base, farmComplete: true, contactOutcome: { id: "real", handle: "real_player", status } })
          .text,
      ).toContain(status);
    expect(
      nextDecision({
        ...base,
        farmComplete: true,
        contacts: 1,
        contactOutcome: { id: "real", handle: "real_player", status: "accepted" },
      }).text,
    ).toContain("contact is accepted");
  });
  it("expired approvals do not demand approval, and unavailable decisions do not infer absence", () => {
    expect(
      nextDecision({ ...base, approvals: [{ status: "expired", deepLinkPath: "/pact/?approval=old" }] }).kind,
    ).toBe("choice");
    expect(nextDecision({ ...base, approvalsAvailable: false }).kind).toBe("unknown");
  });
  it("preserves second-builder offer priority and receipt links", () => {
    expect(nextDecision({ ...base, pendingOffers: 1, build: pending })).toMatchObject({
      kind: "recipient",
      area: "People",
    });
    expect(nextDecision({ ...base, failure: { code: "STOCK_LOW", commandId: "receipt-real" } }).href).toContain(
      "receipts/receipt-real",
    );
  });
});
