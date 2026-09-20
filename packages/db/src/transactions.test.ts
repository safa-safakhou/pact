import { describe, expect, it } from "vitest";
import { stableLockOrder } from "./transactions.js";

describe("stable lock order", () => {
  it("deduplicates and sorts aggregate IDs before row locks are requested", () => {
    expect(stableLockOrder(["b", "a", "c", "a"])).toEqual(["a", "b", "c"]);
  });
});
