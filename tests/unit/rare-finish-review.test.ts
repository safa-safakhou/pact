import { expect, it } from "vitest";
import { rareFinishReview, reviewFinishAt } from "../../scripts/evaluation/rare-finishes.js";

it("enumerates the complete candidate integer distribution and forces only the thirtieth draw", () => {
  const counts = { common: 0, uncommon: 0, rare: 0, mythic: 0 };
  for (let draw = 0; draw < 10000; draw++) {
    const ordinary = reviewFinishAt(draw, 0);
    counts[ordinary.finish]++;
    expect(ordinary.protected).toBe(false);
    expect(reviewFinishAt(draw, 29)).toEqual({ finish: "mythic", nextMisses: 0, protected: true });
  }
  expect(counts).toEqual({ common: 7500, uncommon: 2000, rare: 400, mythic: 100 });
  expect(reviewFinishAt(0, 28).nextMisses).toBe(29);
  expect(reviewFinishAt(9999, 28).nextMisses).toBe(0);
  for (const args of [
    [-1, 0],
    [10000, 0],
    [0, 30],
    [0.1, 0],
  ])
    expect(() => reviewFinishAt(args[0] ?? -1, args[1] ?? -1)).toThrow("INVALID_REVIEW_DRAW");
  const review = rareFinishReview();
  expect(review.activation).toBe("disabled");
  expect(review.longRunMythicPercent).toBeGreaterThan(3.8);
  expect(review.longRunMythicPercent).toBeLessThan(3.9);
});
