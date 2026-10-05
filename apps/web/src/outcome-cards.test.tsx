import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { contextEvent, contextOwner, emptyContextOwner } from "./experience-context-fixtures.js";
import { MilestoneMemory } from "./milestone-reveals.js";
import { OutcomeCards, type OutcomeKind, outcomeCards, outcomeCue } from "./outcome-cards.js";

const kinds: OutcomeKind[] = ["build", "contact", "delivery", "signature", "raid", "default", "waiting"];
function input(kind: OutcomeKind) {
  return {
    owner: contextOwner,
    view: contextEvent(emptyContextOwner(), kind),
    stale: false,
    offers: kind === "signature" ? [{ id: "fixture-offer", version: 1, signedBy: [contextOwner] }] : [],
  };
}
describe("seven factual game moments", () => {
  it.each(kinds)("renders authorized %s records with source; missing/stale/foreign data never celebrate", (kind) => {
    const current = input(kind),
      cards = outcomeCards(current);
    expect(cards.some((c) => c.kind === kind)).toBe(true);
    for (const c of cards) {
      expect(c.recordId).not.toBe("");
      expect(c.href).toContain("/v1/");
      expect(c.href).not.toContain("/world/owner");
      if (["build", "delivery", "raid", "default"].includes(c.kind))
        expect(c.href).toBe("/v1/world/kingdoms/preview-owner");
    }
    expect(outcomeCards({ ...current, stale: true })).toEqual([]);
    expect(outcomeCards({ ...current, view: undefined })).toEqual([]);
    expect(outcomeCards({ ...current, owner: "different" })).toEqual([]);
    expect(outcomeCards({ ...current, view: { ...current.view, audience: "public" } })).toEqual([]);
    expect(outcomeCards({ ...current, view: { ...current.view, asOfGameTimeMs: 1 } })).toEqual([]);
  });
  it("never promotes queue/timer/zero delivery/signature/pending contact to success", () => {
    const view = contextEvent(emptyContextOwner(), "waiting");
    if (!view.consequences) throw Error("fixture");
    view.asOfGameTimeMs = view.consequences.asOfGameTimeMs = 1000000;
    view.consequences.builds = [
      { id: "queue", building: "farm", targetLevel: 2, state: "active", dueGameTimeMs: 0, settledGameTimeMs: null },
    ];
    const cards = outcomeCards({
      owner: contextOwner,
      view,
      stale: false,
      offers: [{ id: "unsigned", version: 1, signedBy: [] }],
      requests: [{ id: "pending", direction: "outgoing", handle: "peer", expiresGameTimeMs: "0" }],
    });
    expect(cards.map((c) => c.kind)).toEqual(["waiting"]);
    expect(cards[0]?.text).toContain("acceptance or expiry is not inferred");
    const delivery = input("delivery");
    if (!delivery.view.consequences) throw Error("fixture");
    const zeroDelivery = delivery.view.consequences.supplyContracts[0]?.deliveries[0];
    if (!zeroDelivery) throw Error("fixture");
    zeroDelivery.deliveredMarked = "0";
    expect(outcomeCards(delivery).some((c) => c.kind === "delivery")).toBe(false);
    expect(outcomeCue.waiting).toBeUndefined();
  });
  it("uses identical signature keys across offer/contract; positive installments keep one first-delivery key", () => {
    const current = input("delivery"),
      c = current.view.consequences?.supplyContracts[0];
    if (!c) throw Error("fixture");
    c.offerId = "fixture-offer";
    current.offers = [{ id: "fixture-offer", version: 1, signedBy: [contextOwner] }];
    const first = outcomeCards(current);
    expect(first.filter((c) => c.key === "signature:fixture-offer:1:preview-owner")).toHaveLength(1);
    const map = new Map<string, string>();
    const memory = new MilestoneMemory(contextOwner, {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        map.set(k, v);
      },
    });
    memory.observe([]);
    expect(memory.observe(first).filter((c) => c.kind === "delivery")).toHaveLength(1);
    const nextDelivery = c.deliveries[0];
    if (!nextDelivery) throw Error("fixture");
    nextDelivery.installments++;
    nextDelivery.deliveredMarked = "1200";
    expect(memory.observe(outcomeCards(current))).toEqual([]);
    const reloaded = new MilestoneMemory(contextOwner, { getItem: (k) => map.get(k) ?? null, setItem: () => {} });
    expect(reloaded.observe(outcomeCards(current))).toEqual([]);
    expect(reloaded.observe(outcomeCards(current))).toEqual([]);
  });
  it("consumes reconnect history quietly and keeps exact default consequence outside flavour", () => {
    const map = new Map<string, string>(),
      memory = new MilestoneMemory(contextOwner, {
        getItem: (k) => map.get(k) ?? null,
        setItem: (k, v) => {
          map.set(k, v);
        },
      });
    memory.observe([]);
    expect(memory.observe(outcomeCards(input("build")), true)).toEqual([]);
    expect(memory.observe(outcomeCards(input("build")))).toEqual([]);
    const html = renderToStaticMarkup(<OutcomeCards {...input("default")} />);
    expect(html).toContain("Recorded consequence: underfunded");
    expect(html).toContain("data-outcome-fact");
    const factual = outcomeCards(input("default")).find((c) => c.kind === "default");
    expect(factual?.text).not.toContain("Bean");
  });
});
