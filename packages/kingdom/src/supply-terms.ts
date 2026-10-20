import { rulesCatalog, wholeResources } from "@pact/domain";

export type SupplyResource = "iron" | "silver" | "grain";
export interface SupplyFlow {
  resource: SupplyResource;
  wholePerHour: number;
}
export interface SupplyBond {
  resource: SupplyResource;
  wholeAmount: number;
}
export interface SupplyTerms {
  aToB: SupplyFlow | null;
  bToA: SupplyFlow | null;
  aBond: SupplyBond | null;
  bBond: SupplyBond | null;
  durationHours: 1 | 6 | 24 | 72;
  noticeHours: 0 | 1 | 6;
}

/** Worst-case authority reservation, not a promise of future peer delivery. */
export function supplyExposure(
  flow: SupplyFlow | null,
  bond: SupplyBond | null,
  durationHours: number,
): Partial<Record<SupplyResource, bigint>> {
  if (!Number.isSafeInteger(durationHours) || durationHours < 1) throw new Error("INVALID_SUPPLY_DURATION");
  const values: Partial<Record<SupplyResource, bigint>> = {};
  if (flow) values[flow.resource] = wholeResources(flow.wholePerHour) * BigInt(durationHours);
  if (bond) values[bond.resource] = (values[bond.resource] ?? 0n) + wholeResources(bond.wholeAmount);
  return values;
}

/** Exact display direction for an already-authorized party; no commitments or arithmetic. */
export function supplyPerspective(terms: SupplyTerms, ownerIsA: boolean) {
  return { youSend: ownerIsA ? terms.aToB : terms.bToA, youReceive: ownerIsA ? terms.bToA : terms.aToB };
}

/** Read-only parameters from the same canonical rules/value function as admission. */
export function supplyTermsRules() {
  const supply = rulesCatalog.supply;
  return {
    schemaVersion: "pact.supply-terms.v1",
    durationHours: supply.durationHours,
    noticeHours: supply.noticeHours,
    maxBondFlowHours: supply.maxBondFlowHours,
    valueUnitsPerWhole: Object.fromEntries(
      (["iron", "silver", "grain"] as const).map((resource) => [resource, String(markedValue(resource, 1))]),
    ),
    minOfferExpiryMinutes: supply.minOfferExpiryMinutes,
    maxOfferExpiryMinutes: supply.maxOfferExpiryMinutes,
    outgoingRateLimit: "storage_capacity_whole_per_hour",
  };
}

export function validateSupplyTerms(terms: SupplyTerms): void {
  const supply = rulesCatalog.supply;
  if (
    !supply.durationHours.includes(terms.durationHours) ||
    !supply.noticeHours.includes(terms.noticeHours) ||
    terms.noticeHours > terms.durationHours
  )
    throw new Error("INVALID_SUPPLY_DURATION_OR_NOTICE");
  if (!terms.aToB && !terms.bToA) throw new Error("ZERO_SUPPLY_FLOWS");
  for (const [flow, bond] of [
    [terms.aToB, terms.aBond],
    [terms.bToA, terms.bBond],
  ] as const) {
    if (flow && (!isResource(flow.resource) || !validPositive(flow.wholePerHour)))
      throw new Error("INVALID_SUPPLY_FLOW");
    if (bond && (!isResource(bond.resource) || !validPositive(bond.wholeAmount)))
      throw new Error("INVALID_SUPPLY_BOND");
    if (bond && !flow) throw new Error("BOND_WITHOUT_FLOW");
    if (bond && flow) {
      const markedBond = markedValue(bond.resource, bond.wholeAmount);
      const maximum =
        markedValue(flow.resource, flow.wholePerHour) * BigInt(Math.min(terms.durationHours, supply.maxBondFlowHours));
      if (markedBond > maximum) throw new Error("BOND_EXCEEDS_FLOW");
    }
  }
}

function validPositive(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && wholeResources(value) <= 9_223_372_036_854_775_807n;
}

function isResource(value: string): value is SupplyResource {
  return value === "iron" || value === "silver" || value === "grain";
}

/** Integer quarters of a displayed resource. */
function markedValue(resource: SupplyResource, amount: number): bigint {
  return BigInt(amount) * (resource === "iron" ? 4n : resource === "silver" ? 8n : 1n);
}
