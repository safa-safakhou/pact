// PACT-165 review only: no runtime import, random source, persistence or minting.
export const REVIEW_FINISH_WEIGHTS = [7500, 2000, 400, 100] as const;
export function reviewFinishAt(draw: number, priorMisses: number) {
  if (
    !Number.isInteger(draw) ||
    draw < 0 ||
    draw >= 10000 ||
    !Number.isInteger(priorMisses) ||
    priorMisses < 0 ||
    priorMisses > 29
  )
    throw new Error("INVALID_REVIEW_DRAW");
  if (priorMisses === 29) return { finish: "mythic", nextMisses: 0, protected: true } as const;
  const finish = draw < 7500 ? "common" : draw < 9500 ? "uncommon" : draw < 9900 ? "rare" : "mythic";
  return { finish, nextMisses: finish === "mythic" ? 0 : priorMisses + 1, protected: false } as const;
}
export function rareFinishReview() {
  // E[min(Geom(1/100),30)] = sum(k=0..29) (99/100)^k, exact rational.
  const denominator = 100n ** 29n;
  let numerator = 0n;
  for (let k = 0n; k < 30n; k++) numerator += 99n ** k * 100n ** (29n - k);
  const expectedDraws = Number(numerator) / Number(denominator);
  return {
    schemaVersion: "pact.rare-finish-review.v1",
    activation: "disabled",
    baseWeightsPer10000: REVIEW_FINISH_WEIGHTS,
    ordinaryMythicPercent: 1,
    protectedDrawNumber: 30,
    protectedNextMythicPercent: 100,
    expectedDrawsPerMythic: expectedDraws,
    longRunMythicPercent: 100 / expectedDraws,
    expectedDrawsExact: { numerator: numerator.toString(), denominator: denominator.toString() },
    chanceReachProtectedDrawPercent: 100 * 0.99 ** 29,
    qualification:
      "Pure candidate-table enumeration and probability arithmetic. No eligibility ledger, random issuance, battle changes, model calls or human comprehension evidence. Draws are not days: eligible event frequency remains unmeasured.",
  };
}
