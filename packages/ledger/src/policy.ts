export type Resource = "iron" | "silver" | "grain";
export type SpendPurpose =
  | "construction"
  | "upkeep"
  | "training"
  | "trade"
  | "bond"
  | "scout"
  | "raid_provisions"
  | "transfer";

export function assertAmount(value: bigint): void {
  if (value < 0n) throw new Error("NEGATIVE_RESOURCE_AMOUNT");
}

export function creditToCap(current: bigint, cap: bigint, requested: bigint): { credited: bigint; overflow: bigint } {
  assertAmount(current);
  assertAmount(cap);
  assertAmount(requested);
  if (current > cap) throw new Error("BALANCE_EXCEEDS_CAP");
  const space = cap - current;
  const credited = requested < space ? requested : space;
  return { credited, overflow: requested - credited };
}

export function allocateSpend(input: {
  resource: Resource;
  purpose: SpendPurpose;
  ordinary: bigint;
  allowance: bigint;
  requested: bigint;
}): { ordinarySpent: bigint; allowanceSpent: bigint; fullyFunded: boolean } {
  const { resource, purpose, ordinary, allowance, requested } = input;
  assertAmount(ordinary);
  assertAmount(allowance);
  assertAmount(requested);
  if (purpose === "construction" && resource === "grain") throw new Error("ALLOWANCE_PURPOSE_FORBIDDEN");
  if (purpose === "upkeep" && resource !== "grain") throw new Error("ALLOWANCE_PURPOSE_FORBIDDEN");
  let ordinarySpent: bigint;
  let allowanceSpent: bigint;
  if (purpose === "construction") {
    allowanceSpent = allowance < requested ? allowance : requested;
    const remaining = requested - allowanceSpent;
    ordinarySpent = ordinary < remaining ? ordinary : remaining;
  } else {
    ordinarySpent = ordinary < requested ? ordinary : requested;
    const remaining = requested - ordinarySpent;
    allowanceSpent = purpose === "upkeep" ? (allowance < remaining ? allowance : remaining) : 0n;
  }
  const fullyFunded = ordinarySpent + allowanceSpent === requested;
  if (!fullyFunded && purpose !== "upkeep") throw new Error("INSUFFICIENT_STOCK");
  return { ordinarySpent, allowanceSpent, fullyFunded };
}
