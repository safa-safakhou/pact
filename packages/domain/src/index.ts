export type KingdomId = string & { readonly __brand: "KingdomId" };

export interface KingdomDraft {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly version: number;
}

export * from "./combat.js";
export * from "./communication-policy.js";
export * from "./rational.js";
export * from "./resource-facts.js";
export * from "./rules-catalog.js";
export * from "./training-quote.js";
export * from "./upkeep.js";
