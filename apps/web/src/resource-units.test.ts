import { describe, expect, it } from "vitest";
import { wholeResourceAmount } from "./resource-units.js";

describe("whole-resource display", () => {
  it("uses the rules' 600 internal units per whole resource", () => {
    expect(wholeResourceAmount("0")).toBe(0);
    expect(wholeResourceAmount("600")).toBe(1);
    expect(wholeResourceAmount("1200")).toBe(2);
    expect(wholeResourceAmount("300")).toBe(0.5);
  });
});
