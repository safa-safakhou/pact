export type KingdomId = string & { readonly __brand: "KingdomId" };

export interface KingdomDraft {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly version: number;
}

export * from "./rational.js";
export * from "./rules-catalog.js";
