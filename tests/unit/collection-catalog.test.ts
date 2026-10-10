import { collectionAsset, collectionPieces, collectionSets } from "@pact/contracts";
import { describe, expect, it } from "vitest";

describe("versioned collection catalog", () => {
  it("defines four sets, sixteen unique pieces and four cosmetic-only trophies", () => {
    expect(collectionSets).toHaveLength(4);
    expect(collectionPieces).toHaveLength(16);
    expect(new Set(collectionPieces.map((p) => p.id)).size).toBe(16);
    expect(new Set([...collectionPieces.map((p) => p.item), ...collectionSets.map((s) => s.trophy)]).size).toBe(20);
    for (const set of collectionSets) expect(collectionPieces.filter((p) => p.set === set.id)).toHaveLength(4);
  });
  it("preserves the eight original once-only Gem pieces without rewarding raw activity", () => {
    expect(
      collectionPieces
        .filter((p) => p.earnedGems === 25)
        .map((p) => p.id)
        .sort(),
    ).toEqual(
      [
        "first_stone",
        "first_pact",
        "kept_the_table",
        "answered_the_call",
        "breach",
        "came_back",
        "own_your_words",
        "winter_stores",
      ].sort(),
    );
    expect(collectionPieces.filter((p) => p.earnedGems === 0)).toHaveLength(8);
    expect(collectionPieces.reduce((n, p) => n + p.earnedGems, 0)).toBe(200);
    for (const p of collectionPieces) expect(collectionAsset(p.item)).toMatch(/^\/assets\/collections\/[a-z_-]+\.svg$/);
  });
});
