import type { KingdomWorldView } from "@pact/kingdom";
import { describe, expect, it } from "vitest";
import { boundedReportResult, boundedWorldResult } from "./run-read-results.js";

describe("bounded model read results", () => {
  it("omits oversized private report content with an explicit truncation marker", () => {
    const result = boundedReportResult("scout", "record-id", { privateText: "x".repeat(10_000) });
    expect(JSON.parse(result)).toEqual({ kind: "scout", recordId: "record-id", truncated: true });
    expect(Buffer.byteLength(result, "utf8")).toBeLessThanOrEqual(3_600);
  });

  it("keeps an authorized audience but drops oversized lists", () => {
    const view = {
      audience: "public",
      profile: { kingdomId: "id", handle: "handle", displayName: "Name", portrait: "portrait.wolf" },
      asOfGameTimeMs: 0,
      committedTickSequence: "1",
      worldStatus: "active",
      publicEvents: Array.from({ length: 200 }, (_, index) => ({
        kind: "battle",
        id: `event-${index}`,
        gameTimeMs: index,
        parties: ["a", "b"],
        outcome: "resolved",
      })),
    } as KingdomWorldView;
    const result = boundedWorldResult(view);
    expect(JSON.parse(result)).toMatchObject({ audience: "public", truncated: true });
    expect(Buffer.byteLength(result, "utf8")).toBeLessThanOrEqual(3_600);
  });
});
