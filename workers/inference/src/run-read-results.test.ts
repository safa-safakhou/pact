import type { KingdomWorldView } from "@pact/kingdom";
import { describe, expect, it } from "vitest";
import {
  boundedCommandReceiptResult,
  boundedRecordResult,
  boundedReportResult,
  boundedWorldResult,
} from "./run-read-results.js";

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

  it("does not persist oversized approval or receipt content", () => {
    for (const kind of ["receipt", "approval"] as const) {
      const result = boundedRecordResult(kind, "record-id", { text: "x".repeat(10_000) });
      expect(JSON.parse(result)).toEqual({ kind, recordId: "record-id", truncated: true });
      expect(Buffer.byteLength(result, "utf8")).toBeLessThanOrEqual(3_600);
    }
  });

  it("keeps versioned command references and explicitly truncates oversized receipts", () => {
    const commandId = "11111111-1111-4111-8111-111111111111";
    const receipt = {
      schemaVersion: "pact.command.v1" as const,
      commandId,
      code: "COMMITTED" as const,
      charged: [],
      recordVersions: { [`supply-offer:${commandId}`]: 1 },
      committedEventIds: ["22222222-2222-4222-8222-222222222222"],
    };
    expect(JSON.parse(boundedCommandReceiptResult(receipt))).toMatchObject({
      commandId,
      recordVersions: { [`supply-offer:${commandId}`]: 1 },
    });
    const oversized = boundedCommandReceiptResult({
      ...receipt,
      recordVersions: Object.fromEntries(Array.from({ length: 400 }, (_, index) => [`record-${index}`, index])),
    });
    expect(JSON.parse(oversized)).toEqual({ commandId, code: "COMMITTED", truncated: true });
    expect(Buffer.byteLength(oversized, "utf8")).toBeLessThanOrEqual(3_600);
  });
});
