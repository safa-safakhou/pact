import { GameActionV2Schema } from "@pact/contracts";
import { rulesCatalog, upgradeCost, wholeResources } from "@pact/domain";
import type { OwnerKingdomView, SocialOverview } from "@pact/kingdom";
import { describe, expect, it } from "vitest";
import { calculateDecisionSupport, DecisionSupportReader } from "./decision-support.js";

const id = "00000000-0000-4000-8000-000000000001";
function world(): OwnerKingdomView {
  return {
    audience: "owner",
    profile: { kingdomId: id },
    asOfGameTimeMs: 60000,
    committedTickSequence: "1",
    worldStatus: "active",
    balances: Object.fromEntries(
      ["iron", "silver", "grain"].map((k) => [k, { ordinaryUnits: "0", foundingAllowanceUnits: "1000000000000" }]),
    ),
    buildings: Object.keys(rulesCatalog.buildingBaseCosts).map((kind) => ({ kind, level: 1 })),
    builders: [
      { slot: 1, state: null },
      { slot: 2, state: null },
    ],
    troops: [],
    training: [],
    charges: [],
    upkeep: { perMinuteUnits: "80", hungry: false },
    forecast: { assumption: "conditional" },
  } as unknown as OwnerKingdomView;
}
describe("exact optional decision facts", () => {
  it("matches all shared upgrade quotes and never permits founding grants to fund troops", () => {
    const view = world();
    for (let level = 1; level < 6; level++) {
      view.buildings = view.buildings.map((b) => ({ ...b, level }));
      const support = calculateDecisionSupport(view);
      for (const c of support.candidates) {
        if (c.action) expect(GameActionV2Schema.safeParse(c.action).success).toBe(true);
        if (c.action?.kind === "game.building.queue") {
          const cost = upgradeCost(c.action.building, level + 1);
          expect(c.effects.costMarkedUnits).toEqual({ iron: cost.iron.toString(), silver: cost.silver.toString() });
          expect(c.checks.affordable).toBe(true);
        }
        if (c.action?.kind === "game.training.queue") expect(c.checks.affordable).toBe(false);
      }
      expect(support.candidates.some((c) => c.kind === "wait")).toBe(true);
      expect(support.candidates.some((c) => c.kind === "read")).toBe(true);
    }
  });
  it("shows exact resource exposure and conditional peer delivery, never ranks or certifies a claim", () => {
    const offer = {
      id: "00000000-0000-4000-8000-000000000002",
      kingdomId: "00000000-0000-4000-8000-000000000003",
      kingdomA: id,
      kingdomB: "00000000-0000-4000-8000-000000000003",
      version: 3,
      status: "open",
      expiresGameTimeMs: "120000",
      signedBy: [],
      terms: {
        aToB: { resource: "grain", wholePerHour: 12 },
        bToA: { resource: "iron", wholePerHour: 2 },
        aBond: { resource: "silver", wholeAmount: 1 },
        bBond: null,
        durationHours: 6,
        noticeHours: 1,
      },
    };
    const social = { kingdomId: id, supplyOffers: [offer] } as unknown as SocialOverview;
    const support = calculateDecisionSupport(world(), social);
    expect(support.proposals[0]?.maximumAuthorityExposureMarkedUnits).toEqual({
      grain: wholeResources(72).toString(),
      silver: wholeResources(1).toString(),
    });
    expect(support.proposals[0]?.outgoingPerMinuteMarkedUnits).toBe("120");
    expect(support.candidates.some((c) => c.id.includes(":decline:"))).toBe(true);
    expect(support.meaning).toContain("Not an action whitelist");
    expect(JSON.stringify(support)).not.toContain('"trust"');
    expect(() => calculateDecisionSupport({ ...world(), audience: "public" } as unknown as OwnerKingdomView)).toThrow(
      "OWNER_VIEW_REQUIRED",
    );
    expect(() => calculateDecisionSupport(world(), { ...social, kingdomId: offer.kingdomB })).toThrow(
      "OBSERVATION_OWNER_MISMATCH",
    );
  });
  it("refreshes own facts without acknowledging message summaries or accepting a caller-supplied subject", async () => {
    const calls: unknown[] = [];
    const reader = new DecisionSupportReader(
      {
        readSelf: async (accountId) => {
          calls.push(accountId);
          return world();
        },
      },
      {
        read: async (accountId, options) => {
          calls.push({ accountId, options });
          return null;
        },
      },
    );
    expect(await reader.read("authenticated-owner")).not.toBeNull();
    expect(calls).toEqual([
      "authenticated-owner",
      { accountId: "authenticated-owner", options: { acknowledgeDeliveredMessages: false } },
    ]);
  });
  it("resolves only current owner candidates and invalidates changed facts within the same tick", async () => {
    const view = world();
    const reader = new DecisionSupportReader({ readSelf: async () => view });
    const menu = calculateDecisionSupport(view);
    const id = menu.candidates.find((c) => c.kind === "wait")?.id;
    if (!id) throw Error("fixture");
    expect(await reader.read("owner", id)).toMatchObject({ candidate: { kind: "wait" } });
    expect(await reader.read("owner", "another-owner-choice")).toMatchObject({ code: "CANDIDATE_STALE" });
    view.balances.iron.ordinaryUnits = "1";
    expect(await reader.read("owner", id)).toMatchObject({ code: "CANDIDATE_STALE" });
  });
  it("bounds fifty observed proposals and pages choices without losing or duplicating IDs", () => {
    const social = {
      kingdomId: id,
      supplyOffers: Array.from({ length: 50 }, (_, i) => ({
        id: `00000000-0000-4000-8000-${String(i + 2).padStart(12, "0")}`,
        kingdomId: "00000000-0000-4000-8000-000000000100",
        kingdomA: id,
        kingdomB: "00000000-0000-4000-8000-000000000100",
        version: 1,
        status: "open",
        expiresGameTimeMs: "120000",
        signedBy: [],
        terms: {
          aToB: { resource: "grain", wholePerHour: 1 },
          bToA: null,
          aBond: null,
          bBond: null,
          durationHours: 1,
          noticeHours: 0,
        },
      })),
    } as unknown as SocialOverview;
    const seen = new Set<string>();
    let offset: number | null = 0;
    do {
      const page = calculateDecisionSupport(world(), social, offset);
      expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThan(64000);
      for (const proposal of page.proposals) {
        expect(seen.has(proposal.offerId)).toBe(false);
        seen.add(proposal.offerId);
      }
      offset = page.proposalsNextOffset;
      expect(page.proposalCoverage.additionalRecordsMayExist).toBe(true);
    } while (offset !== null);
    expect(seen.size).toBe(50);
    expect(() => calculateDecisionSupport(world(), social, -1)).toThrow("INVALID_PROPOSAL_OFFSET");
  });
});
