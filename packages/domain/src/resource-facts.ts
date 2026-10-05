/** Exact human-readable projection of PACT's 1/600 whole resource units. */
export function wholeUnitText(marked: string | bigint): string {
  const value = BigInt(marked),
    negative = value < 0n,
    absolute = negative ? -value : value;
  const scale = 1_000_000n,
    scaled = (absolute * scale) / 600n;
  const integer = scaled / scale,
    fraction = (scaled % scale).toString().padStart(6, "0").replace(/0+$/, "");
  const approx = (absolute * scale) % 600n !== 0n ? "\u2248" : "";
  return approx + (negative ? "-" : "") + integer + (fraction ? `.${fraction}` : "");
}
export function resourceRateFacts(gross: string | bigint, upkeep: string | bigint = 0n) {
  const g = BigInt(gross),
    u = BigInt(upkeep);
  const rate = (n: bigint) => ({
    perMinuteWhole: wholeUnitText(n),
    perHourWhole: wholeUnitText(n * 60n),
    label: `${wholeUnitText(n)}/min = ${wholeUnitText(n * 60n)}/hour`,
  });
  return {
    gross: rate(g),
    upkeep: rate(u),
    net: rate(g - u),
    excludes: "Trade, storage overflow and temporary allowance expiry; forecasts carry their own assumptions.",
  };
}
