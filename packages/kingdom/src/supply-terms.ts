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
      const maximum = markedValue(
        flow.resource,
        flow.wholePerHour * Math.min(terms.durationHours, supply.maxBondFlowHours),
      );
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
