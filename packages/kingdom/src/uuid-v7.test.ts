import { describe, expect, it } from "vitest";
import { uuidV7 } from "./uuid-v7.js";

describe("immutable troop UUIDv7", () => {
  it("encodes the real creation millisecond and version/variant bits", () => {
    const now = new Date("2026-09-23T12:34:56.789Z");
    const ids = Array.from({ length: 8 }, () => uuidV7(now));
    expect(new Set(ids).size).toBe(8);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(Number.parseInt(id.replaceAll("-", "").slice(0, 12), 16)).toBe(now.getTime());
    }
    expect(() => uuidV7(new Date(Number.NaN))).toThrow("INVALID_UUID_V7_TIME");
  });
});
