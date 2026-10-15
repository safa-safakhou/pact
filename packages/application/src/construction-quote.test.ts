import { readFileSync } from "node:fs";
import { rulesCatalog } from "@pact/domain";
import type { OwnerKingdomView } from "@pact/kingdom";
import { expect, it } from "vitest";
import { constructionAdmissionQuote } from "./construction-quote.js";
import { calculateDecisionSupport, DecisionSupportReader } from "./decision-support.js";

const replays = JSON.parse(
  readFileSync(new URL("../../../tests/fixtures/admission-replays-20261014.json", import.meta.url), "utf8"),
);
function required<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw Error("fixture evidence missing");
  return value;
}
function view(building: string, target: number): OwnerKingdomView {
  return {
    audience: "owner",
    profile: { kingdomId: "00000000-0000-4000-8000-000000000001" },
    asOfGameTimeMs: 60000,
    committedTickSequence: "1",
    worldStatus: "active",
    balances: Object.fromEntries(
      ["iron", "silver", "grain"].map((asset) => [
        asset,
        { ordinaryUnits: "100000000", foundingAllowanceUnits: "0", lockedUnits: "0", version: "1" },
      ]),
    ),
    buildings: Object.keys(rulesCatalog.buildingBaseCosts).map((kind) => ({
      kind,
      level: kind === building ? target - 1 : target,
    })),
    builders: [],
    troops: [],
    training: [],
    charges: [],
    upkeep: { hungry: false },
    forecast: {},
    authority: {
      schemaVersion: "pact.authority-observation.v1",
      asOfGameTimeMs: 60000,
      mandateVersion: 3,
      allowedActions: ["building.queue"],
      troopLimit: 0,
      troopReserved: 0,
      resources: Object.fromEntries(
        ["iron", "silver"].map((asset) => [
          asset,
          {
            ceilingUnits: "600000000",
            legacySpentUnits: "0",
            rollingSpentUnits: "0",
            reservedUnits: "0",
            headroomUnits: "600000000",
            reserveFloorUnits: "0",
            releaseSchedule: [],
            reservations: [],
          },
        ]),
      ),
      meaning: "fixture",
    },
  } as unknown as OwnerKingdomView;
}
it("replays all 106 retained quota causes through authoritative construction quotes", () => {
  expect(replays.quotaRefusals).toHaveLength(106);
  for (const r of replays.quotaRefusals) {
    const v = view(r.building, r.target);
    for (const asset of ["iron", "silver"]) {
      const a = r.permissionWhole[asset],
        units = (n: number) => String(Math.round(n * 600));
      required(v.authority).resources[asset] = {
        ceilingUnits: units(a.limit),
        legacySpentUnits: units(a.legacy),
        rollingSpentUnits: units(a.rolling_spent),
        reservedUnits: units(a.reserved),
        headroomUnits: units(a.remaining),
        reserveFloorUnits: "0",
        releaseSchedule: [],
        reservations: [],
      };
    }
    const q = constructionAdmissionQuote(v, r.building, r.target, 1);
    expect(q.admission.allowed, `case ${r.case}`).toBe(false);
    for (const asset of r.overLimitAssets)
      expect(q.admission.blockers, `case ${r.case}`).toContain(`INSUFFICIENT_ALLOWANCE:${asset}`);
    expect(required(q.resources.iron).requiredReservationUnits).toBe(String(Math.round(r.costWhole.iron * 600)));
  }
});
it("reconstructs all seventeen documented stock/prerequisite waits with zero floors", () => {
  expect(replays.waitingOrders).toHaveLength(17);
  for (const r of replays.waitingOrders) {
    const v = view(r.building, r.target);
    if (r.reasons.includes("hall_limit")) required(v.buildings.find((b) => b.kind === "hall")).level = r.target - 2;
    if (r.reasons.includes("hall_prerequisite"))
      required(v.buildings.find((b) => b.kind === "farm")).level = r.target - 1;
    for (const asset of ["iron", "silver"] as const) {
      v.balances[asset].ordinaryUnits = r.resources[asset].ordinary;
      v.balances[asset].foundingAllowanceUnits = r.resources[asset].allowance;
      expect(r.resources[asset].floor).toBe("0");
    }
    const q = constructionAdmissionQuote(v, r.building, r.target, 1);
    expect(q.admission.allowed, `case ${r.case}`).toBe(true);
    expect(q.immediateStart.possible, `case ${r.case}`).toBe(false);
    if (r.reasons.some((reason: string) => reason.startsWith("insufficient_")))
      expect(q.immediateStart.blockers).toContain("INSUFFICIENT_STOCK");
    if (r.reasons.some((reason: string) => reason.startsWith("hall_")))
      expect(q.immediateStart.blockers).toContain("PREREQUISITE");
    expect(q.immediateStart.blockers.some((b) => b.startsWith("RESERVE_FLOOR"))).toBe(false);
  }
});
it("separates grant provenance, floors, busy slots and authority from immediate start", () => {
  const v = view("farm", 2);
  let q = constructionAdmissionQuote(v, "farm", 2, 1);
  expect(q.immediateStart.possible).toBe(true);
  required(required(v.authority).resources.iron).reserveFloorUnits = "100000000";
  q = constructionAdmissionQuote(v, "farm", 2, 1);
  expect(q.immediateStart.blockers).toContain("RESERVE_FLOOR:iron");
  v.balances.iron.foundingAllowanceUnits = "100000000";
  q = constructionAdmissionQuote(v, "farm", 2, 1);
  expect(required(q.resources.iron).ordinaryDebitAtStartUnits).toBe("0");
  expect(q.immediateStart.blockers).not.toContain("RESERVE_FLOOR:iron");
  v.builders = [
    {
      slot: 1,
      state: "active",
      kind: "mine",
      instructionId: "00000000-0000-4000-8000-000000000002",
      dueGameTimeMs: 120000,
    },
  ];
  q = constructionAdmissionQuote(v, "farm", 2, 1);
  expect(q.admission.allowed).toBe(true);
  expect(q.immediateStart.blockers).toContain("BUILDER_ACTIVE");
  required(v.builders[0]).state = "waiting";
  expect(constructionAdmissionQuote(v, "farm", 2, 1).admission.blockers).toContain("SLOT_BUSY");
});
it("invalidates selected quote IDs when only authority changes inside the same tick", async () => {
  const v = view("mine", 2),
    reader = new DecisionSupportReader({ readSelf: async () => v });
  const candidate = calculateDecisionSupport(v).candidates.find((c) => c.action?.kind === "game.building.queue");
  expect(candidate).toBeDefined();
  required(required(v.authority).resources.iron).headroomUnits = "0";
  expect(await reader.read("authenticated-owner", required(candidate).id)).toMatchObject({ code: "CANDIDATE_STALE" });
});

it("shows conditional rolling relief, permanent ceiling barriers and paused admission separately", () => {
  const v = view("hall", 3),
    a = required(required(v.authority).resources.iron);
  Object.assign(a, {
    ceilingUnits: "600000",
    headroomUnits: "60000",
    rollingSpentUnits: "300000",
    reservedUnits: "240000",
    releaseSchedule: [{ gameTimeMs: 86460000, units: "300000" }],
  });
  const q = constructionAdmissionQuote(v, "hall", 3, 1);
  expect(required(q.resources.iron).conditionalAuthorityReliefGameTimeMs).toBe(86460000);
  expect(required(q.resources.iron).exceedsFullCeiling).toBe(false);
  const higher = view("hall", 4);
  Object.assign(required(required(higher.authority).resources.iron), a);
  expect(required(constructionAdmissionQuote(higher, "hall", 4, 1).resources.iron)).toMatchObject({
    exceedsFullCeiling: true,
    conditionalAuthorityReliefGameTimeMs: null,
  });
  v.worldStatus = "paused";
  expect(constructionAdmissionQuote(v, "hall", 3, 1).admission.blockers).toContain("WORLD_PAUSED");
});
